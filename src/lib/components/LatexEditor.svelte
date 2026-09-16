<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, basicSetup } from 'codemirror';
	import { EditorState } from '@codemirror/state';
	import { yCollab } from 'y-codemirror.next';
	import type { CollabProvider } from '$lib/collab/provider';

	interface Props {
		content: string;
		readOnly?: boolean;
		provider?: CollabProvider | null;
		onchange?: (newContent: string) => void;
	}

	let { content, readOnly = false, provider = null, onchange }: Props = $props();

	let editorContainer: HTMLDivElement;
	let view: EditorView | null = null;
	let internalUpdate = false;

	const theme = EditorView.theme({
		'&': {
			height: '100%',
			fontSize: '13.5px',
			fontFamily: 'var(--font-mono), monospace',
			backgroundColor: '#ffffff'
		},
		'.cm-scroller': {
			overflow: 'auto',
			lineHeight: '1.6'
		},
		'.cm-content': {
			padding: '12px 0'
		},
		'.cm-line': {
			padding: '0 16px'
		},
		'&.cm-focused': {
			outline: 'none'
		},
		'.cm-gutters': {
			backgroundColor: '#f8fafc',
			color: '#94a3b8',
			borderRight: '1px solid #e2e8f0',
			paddingRight: '4px'
		},
		'.cm-activeLineGutter': {
			backgroundColor: '#f1f5f9',
			color: '#334155'
		},
		'.cm-activeLine': {
			backgroundColor: '#f8fafc'
		},
		'.cm-ySelection': {
			mixBlendMode: 'multiply'
		},
		'.cm-ySelectionInfo': {
			position: 'absolute',
			top: '-1.3em',
			left: '-1px',
			fontSize: '10px',
			fontFamily: 'sans-serif',
			fontWeight: '600',
			lineHeight: 'normal',
			userSelect: 'none',
			color: '#ffffff',
			padding: '1px 5px',
			borderRadius: '3px',
			whiteSpace: 'nowrap',
			zIndex: '20',
			boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
			pointerEvents: 'none'
		}
	});

	function createEditor(initialDoc: string, currentProvider: CollabProvider | null) {
		if (!editorContainer) return;
		if (view) {
			view.destroy();
			view = null;
		}

		const extensions = [
			basicSetup,
			theme,
			EditorState.readOnly.of(readOnly)
		];

		if (currentProvider) {
			const ytext = currentProvider.doc.getText('codemirror');
			extensions.push(yCollab(ytext, currentProvider.awareness));
		}

		extensions.push(
			EditorView.updateListener.of((update) => {
				if (update.docChanged && !internalUpdate) {
					const docText = update.state.doc.toString();
					if (onchange) {
						onchange(docText);
					}
				}
			})
		);

		const state = EditorState.create({
			doc: currentProvider ? undefined : initialDoc,
			extensions
		});

		view = new EditorView({
			state,
			parent: editorContainer
		});
	}

	// Recreate editor when provider instance changes (e.g. switching files)
	let lastProvider: CollabProvider | null = null;
	$effect(() => {
		if (provider !== lastProvider) {
			lastProvider = provider;
			createEditor(content, provider);
		}
	});

	// If running without collaboration provider, update editor when content changes externally
	$effect(() => {
		if (!provider && view && content !== view.state.doc.toString()) {
			internalUpdate = true;
			view.dispatch({
				changes: {
					from: 0,
					to: view.state.doc.length,
					insert: content
				}
			});
			internalUpdate = false;
		}
	});

	onMount(() => {
		createEditor(content, provider);
	});

	onDestroy(() => {
		if (view) {
			view.destroy();
			view = null;
		}
	});
</script>

<div bind:this={editorContainer} class="h-full w-full overflow-hidden"></div>
