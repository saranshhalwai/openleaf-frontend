<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, basicSetup } from 'codemirror';
	import { EditorState } from '@codemirror/state';

	interface Props {
		content: string;
		readOnly?: boolean;
		onchange?: (newContent: string) => void;
	}

	let { content, readOnly = false, onchange }: Props = $props();

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
		}
	});

	function createEditor(initialDoc: string) {
		if (!editorContainer) return;
		if (view) view.destroy();

		const state = EditorState.create({
			doc: initialDoc,
			extensions: [
				basicSetup,
				theme,
				EditorState.readOnly.of(readOnly),
				EditorView.updateListener.of((update) => {
					if (update.docChanged && !internalUpdate) {
						const docText = update.state.doc.toString();
						if (onchange) {
							onchange(docText);
						}
					}
				})
			]
		});

		view = new EditorView({
			state,
			parent: editorContainer
		});
	}

	// Update editor doc when the active file or content changes externally
	$effect(() => {
		if (view && content !== view.state.doc.toString()) {
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
		createEditor(content);
	});

	onDestroy(() => {
		if (view) {
			view.destroy();
			view = null;
		}
	});
</script>

<div bind:this={editorContainer} class="h-full w-full overflow-hidden"></div>
