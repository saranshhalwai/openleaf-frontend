import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const messageSync = 0;
const messageAwareness = 1;
const messageInit = 2;

const USER_COLORS = [
	'#2563eb', // Blue
	'#059669', // Emerald
	'#d97706', // Amber
	'#dc2626', // Red
	'#7c3aed', // Violet
	'#db2777', // Pink
	'#0891b2', // Cyan
	'#4f46e5'  // Indigo
];

export function getUserColor(id: string): string {
	let hash = 0;
	for (let i = 0; i < id.length; i++) {
		hash = (hash << 5) - hash + id.charCodeAt(i);
		hash |= 0;
	}
	return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

export interface UserPresence {
	id: string;
	name: string;
	color: string;
}

export class CollabProvider {
	doc: Y.Doc;
	awareness: awarenessProtocol.Awareness;
	ws: WebSocket | null = null;
	status: 'connecting' | 'connected' | 'disconnected' = 'disconnected';

	private url: string;
	private initialDoc: string;
	private shouldConnect = true;
	private initFallbackTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private statusListeners: Array<(status: 'connecting' | 'connected' | 'disconnected') => void> = [];
	private awarenessListeners: Array<(users: UserPresence[]) => void> = [];

	constructor(
		backendUrl: string,
		projectId: string,
		fileId: string,
		token: string,
		user: { id: string; name: string },
		initialDoc: string = ''
	) {
		this.doc = new Y.Doc();
		this.awareness = new awarenessProtocol.Awareness(this.doc);
		this.initialDoc = initialDoc;

		const userColor = getUserColor(user.id);
		this.awareness.setLocalStateField('user', {
			name: user.name || 'Anonymous',
			color: userColor,
			colorLight: userColor + '33'
		});

		// Derive WebSocket URL from HTTP backend URL
		const wsBase = backendUrl.replace(/^http/, 'ws');
		this.url = `${wsBase}/api/projects/${projectId}/files/${fileId}/collaborate?token=${encodeURIComponent(token)}`;

		// Listen to local doc updates and broadcast to peers
		this.doc.on('update', (update: Uint8Array, origin: unknown) => {
			if (origin !== this) {
				const encoder = encoding.createEncoder();
				encoding.writeVarUint(encoder, messageSync);
				syncProtocol.writeUpdate(encoder, update);
				this.send(encoding.toUint8Array(encoder));
			}
		});

		// Listen to local awareness (cursor/selection) updates and broadcast
		this.awareness.on(
			'update',
			({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
				const changedClients = added.concat(updated, removed);
				if (origin !== this) {
					const encoder = encoding.createEncoder();
					encoding.writeVarUint(encoder, messageAwareness);
					encoding.writeVarUint8Array(
						encoder,
						awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
					);
					this.send(encoding.toUint8Array(encoder));
				}
				this.notifyAwarenessChange();
			}
		);

		this.connect();
	}

	private connect() {
		if (!this.shouldConnect) return;
		this.setStatus('connecting');

		try {
			this.ws = new WebSocket(this.url);
			this.ws.binaryType = 'arraybuffer';

			this.ws.onopen = () => {
				this.setStatus('connected');

				// Fallback: If no init message received within 1.5s and doc is empty, seed initial doc
				this.initFallbackTimer = setTimeout(() => {
					const ytext = this.doc.getText('codemirror');
					if (ytext.length === 0 && this.initialDoc) {
						ytext.insert(0, this.initialDoc);
					}
				}, 1500);

				// Step 1: Send SyncStep1 to request initial state from peers
				const encoder = encoding.createEncoder();
				encoding.writeVarUint(encoder, messageSync);
				syncProtocol.writeSyncStep1(encoder, this.doc);
				this.send(encoding.toUint8Array(encoder));

				// Step 2: Send current local awareness
				const awarenessStates = this.awareness.getStates();
				if (awarenessStates.size > 0) {
					const awarenessEncoder = encoding.createEncoder();
					encoding.writeVarUint(awarenessEncoder, messageAwareness);
					encoding.writeVarUint8Array(
						awarenessEncoder,
						awarenessProtocol.encodeAwarenessUpdate(
							this.awareness,
							Array.from(awarenessStates.keys())
						)
					);
					this.send(encoding.toUint8Array(awarenessEncoder));
				}
			};

			this.ws.onmessage = async (event: MessageEvent) => {
				let buffer: ArrayBuffer;
				if (event.data instanceof ArrayBuffer) {
					buffer = event.data;
				} else if (event.data instanceof Blob) {
					buffer = await event.data.arrayBuffer();
				} else {
					return;
				}

				const decoder = decoding.createDecoder(new Uint8Array(buffer));
				const msgType = decoding.readVarUint(decoder);

				if (msgType === messageInit) {
					if (this.initFallbackTimer) {
						clearTimeout(this.initFallbackTimer);
						this.initFallbackTimer = null;
					}
					const peerCount = decoding.readVarUint(decoder);
					// If peerCount == 0, we are the first client in the room: seed initial doc
					if (peerCount === 0) {
						const ytext = this.doc.getText('codemirror');
						if (ytext.length === 0 && this.initialDoc) {
							ytext.insert(0, this.initialDoc);
						}
					}
				} else if (msgType === messageSync) {
					if (this.initFallbackTimer) {
						clearTimeout(this.initFallbackTimer);
						this.initFallbackTimer = null;
					}
					const encoder = encoding.createEncoder();
					encoding.writeVarUint(encoder, messageSync);
					syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);
					if (encoding.length(encoder) > 1) {
						this.send(encoding.toUint8Array(encoder));
					}
				} else if (msgType === messageAwareness) {
					awarenessProtocol.applyAwarenessUpdate(
						this.awareness,
						decoding.readVarUint8Array(decoder),
						this
					);
					this.notifyAwarenessChange();
				}
			};

			this.ws.onclose = () => {
				this.setStatus('disconnected');
				if (this.initFallbackTimer) {
					clearTimeout(this.initFallbackTimer);
					this.initFallbackTimer = null;
				}
				if (this.shouldConnect) {
					this.reconnectTimeout = setTimeout(() => {
						this.connect();
					}, 2500);
				}
			};

			this.ws.onerror = (err) => {
				console.warn('[CollabProvider] WebSocket error:', err);
			};
		} catch (e) {
			console.error('[CollabProvider] Connection failed:', e);
			this.setStatus('disconnected');
		}
	}

	private send(message: Uint8Array) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(message);
		}
	}

	private setStatus(status: 'connecting' | 'connected' | 'disconnected') {
		if (this.status !== status) {
			this.status = status;
			for (const listener of this.statusListeners) {
				listener(status);
			}
		}
	}

	private notifyAwarenessChange() {
		const users: UserPresence[] = [];
		this.awareness.getStates().forEach((state, clientID) => {
			if (state.user && state.user.name) {
				users.push({
					id: String(clientID),
					name: state.user.name,
					color: state.user.color || '#3b82f6'
				});
			}
		});
		for (const listener of this.awarenessListeners) {
			listener(users);
		}
	}

	onStatusChange(listener: (status: 'connecting' | 'connected' | 'disconnected') => void): () => void {
		this.statusListeners.push(listener);
		listener(this.status);
		return () => {
			this.statusListeners = this.statusListeners.filter((l) => l !== listener);
		};
	}

	onAwarenessChange(listener: (users: UserPresence[]) => void): () => void {
		this.awarenessListeners.push(listener);
		this.notifyAwarenessChange();
		return () => {
			this.awarenessListeners = this.awarenessListeners.filter((l) => l !== listener);
		};
	}

	destroy() {
		this.shouldConnect = false;
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
		}
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.awareness.destroy();
		this.doc.destroy();
		this.statusListeners = [];
		this.awarenessListeners = [];
	}
}
