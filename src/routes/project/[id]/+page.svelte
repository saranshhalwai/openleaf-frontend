<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { ApiClient, type Project, type ProjectFile } from '$lib/api';
	import LatexEditor from '$lib/components/LatexEditor.svelte';
	import {
		ArrowLeft,
		Plus,
		Trash2,
		CheckCircle2,
		AlertCircle,
		Play,
		FileCode,
		Loader2,
		PanelRightClose,
		PanelRightOpen
	} from 'lucide-svelte';

	let sessionToken = $derived(page.data.sessionToken);
	let projectId = $derived(page.params.id as string);

	let api = $derived(new ApiClient(sessionToken || ''));

	// State
	let project = $state<Project | null>(null);
	let files = $state<ProjectFile[]>([]);
	let activeFile = $state<ProjectFile | null>(null);
	let fileContent = $state<string>('');
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Autosave state
	let saveStatus = $state<'saved' | 'saving' | 'unsaved'>('saved');
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// UI layout
	let showPreview = $state(true);
	let showNewFileModal = $state(false);
	let newFilePath = $state('');
	let creatingFile = $state(false);

	async function loadProjectData() {
		loading = true;
		error = null;
		try {
			const [p, fileList] = await Promise.all([
				api.getProject(projectId),
				api.listFiles(projectId)
			]);
			project = p;
			files = fileList;

			// Select root file by default, or first file
			const initialFile = fileList.find((f) => f.id === p.rootFileId) || fileList[0];
			if (initialFile) {
				await selectFile(initialFile);
			}
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Failed to load project';
		} finally {
			loading = false;
		}
	}

	async function selectFile(file: ProjectFile) {
		// Save pending changes of current file if any
		if (saveStatus === 'unsaved' && activeFile) {
			await saveCurrentFile();
		}

		try {
			const fullFile = await api.getFile(projectId, file.id);
			activeFile = fullFile;
			fileContent = fullFile.content || '';
			saveStatus = 'saved';
		} catch (err: unknown) {
			alert(err instanceof Error ? err.message : 'Failed to open file');
		}
	}

	function handleContentChange(newContent: string) {
		fileContent = newContent;
		saveStatus = 'unsaved';

		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			saveCurrentFile();
		}, 1000);
	}

	async function saveCurrentFile() {
		if (!activeFile || saveStatus === 'saving') return;
		saveStatus = 'saving';

		try {
			await api.updateFileContent(projectId, activeFile.id, fileContent);
			saveStatus = 'saved';
		} catch (err: unknown) {
			saveStatus = 'unsaved';
			console.error('Failed to save file:', err);
		}
	}

	async function handleCreateFile(e: SubmitEvent) {
		e.preventDefault();
		if (!newFilePath.trim()) return;
		creatingFile = true;

		try {
			const created = await api.createFile(
				projectId,
				newFilePath.trim(),
				'% ' + newFilePath.trim() + '\n'
			);
			files = [...files, created];
			showNewFileModal = false;
			newFilePath = '';
			await selectFile(created);
		} catch (err: unknown) {
			alert(err instanceof Error ? err.message : 'Failed to create file');
		} finally {
			creatingFile = false;
		}
	}

	async function handleDeleteFile(file: ProjectFile) {
		if (file.id === project?.rootFileId) {
			alert('Cannot delete the root LaTeX document (main.tex).');
			return;
		}

		if (!confirm(`Are you sure you want to delete "${file.path}"?`)) {
			return;
		}

		try {
			await api.deleteFile(projectId, file.id);
			files = files.filter((f) => f.id !== file.id);

			if (activeFile?.id === file.id) {
				const next = files[0];
				if (next) await selectFile(next);
				else {
					activeFile = null;
					fileContent = '';
				}
			}
		} catch (err: unknown) {
			alert(err instanceof Error ? err.message : 'Failed to delete file');
		}
	}

	onMount(() => {
		loadProjectData();
	});

	onDestroy(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
	});
</script>

<div
	class="flex h-screen flex-col overflow-hidden bg-slate-100 font-sans text-slate-900 select-none"
>
	<!-- Top App Bar -->
	<div
		class="z-20 flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-xs"
	>
		<div class="flex items-center gap-3">
			<a
				href={resolve('/')}
				class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-emerald-700"
				title="Back to Projects"
			>
				<ArrowLeft class="h-3.5 w-3.5" />
				<span>Projects</span>
			</a>

			<div class="h-4 w-px bg-slate-200"></div>

			<div class="flex items-center gap-2">
				<span class="text-sm font-bold tracking-tight text-slate-800">
					{project?.name || 'Loading...'}
				</span>
				{#if activeFile}
					<span class="text-xs text-slate-400">/</span>
					<span
						class="rounded bg-emerald-50 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-800"
					>
						{activeFile.path}
					</span>
				{/if}
			</div>
		</div>

		<!-- Actions / Status -->
		<div class="flex items-center gap-3">
			<!-- Save Indicator -->
			<div class="flex items-center gap-1.5 text-xs text-slate-500">
				{#if saveStatus === 'saving'}
					<Loader2 class="h-3.5 w-3.5 animate-spin text-emerald-600" />
					<span class="text-[11px]">Saving...</span>
				{:else if saveStatus === 'saved'}
					<CheckCircle2 class="h-3.5 w-3.5 text-emerald-600" />
					<span class="text-[11px]">All changes saved</span>
				{:else}
					<span class="h-2 w-2 rounded-full bg-amber-500"></span>
					<span class="text-[11px] text-amber-700">Unsaved</span>
				{/if}
			</div>

			<div class="h-4 w-px bg-slate-200"></div>

			<!-- Compile Button -->
			<button
				type="button"
				class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700"
				title="Compile PDF (Phase 2)"
				onclick={() => {
					alert(
						'LaTeX Compilation pipeline is scheduled for Phase 2! Cloud Tasks + Cloud Run LaTeX sandbox will compile the project and render live PDF previews.'
					);
				}}
			>
				<Play class="h-3.5 w-3.5 fill-current" />
				<span>Recompile</span>
			</button>

			<!-- Toggle Split View -->
			<button
				type="button"
				class="cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
				title={showPreview ? 'Hide Preview' : 'Show Preview'}
				onclick={() => {
					showPreview = !showPreview;
				}}
			>
				{#if showPreview}
					<PanelRightClose class="h-4 w-4" />
				{:else}
					<PanelRightOpen class="h-4 w-4" />
				{/if}
			</button>
		</div>
	</div>

	<!-- Error Alert if failed to load -->
	{#if error}
		<div
			class="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700"
		>
			<AlertCircle class="h-4 w-4 shrink-0" />
			<span>{error}</span>
		</div>
	{/if}

	<!-- Main Workspace Split -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Left Sidebar: File Tree -->
		<div class="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
			<div class="flex items-center justify-between border-b border-slate-200 p-3">
				<span class="text-xs font-bold tracking-wider text-slate-500 uppercase">Project Files</span>
				<button
					type="button"
					onclick={() => {
						showNewFileModal = true;
					}}
					class="cursor-pointer rounded p-1 text-slate-600 transition hover:bg-slate-200 hover:text-emerald-700"
					title="Add New File"
				>
					<Plus class="h-4 w-4" />
				</button>
			</div>

			<div class="flex-1 space-y-0.5 overflow-y-auto p-2">
				{#if loading}
					<div class="p-3 text-xs text-slate-400">Loading files...</div>
				{:else}
					{#each files as file (file.id)}
						<div
							class="group flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 font-mono text-xs transition {activeFile?.id ===
							file.id
								? 'bg-emerald-100 font-semibold text-emerald-900 shadow-2xs'
								: 'text-slate-600 hover:bg-slate-200/60'}"
							onclick={() => selectFile(file)}
							role="button"
							tabindex="0"
							onkeydown={(e) => {
								if (e.key === 'Enter') selectFile(file);
							}}
						>
							<div class="flex items-center gap-2 truncate">
								<FileCode
									class="h-3.5 w-3.5 shrink-0 {activeFile?.id === file.id
										? 'text-emerald-700'
										: 'text-slate-400'}"
								/>
								<span class="truncate">{file.path}</span>
							</div>

							{#if file.id !== project?.rootFileId}
								<button
									type="button"
									onclick={(e) => {
										e.stopPropagation();
										handleDeleteFile(file);
									}}
									class="cursor-pointer rounded p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600"
									title="Delete file"
								>
									<Trash2 class="h-3 w-3" />
								</button>
							{/if}
						</div>
					{/each}
				{/if}
			</div>

			<div class="border-t border-slate-200 bg-white/50 p-3 text-[11px] text-slate-400">
				Max 6 concurrent editors per file
			</div>
		</div>

		<!-- Center: Code Editor -->
		<div class="flex flex-1 flex-col overflow-hidden bg-white">
			{#if activeFile}
				<div class="flex-1 overflow-hidden">
					<LatexEditor content={fileContent} onchange={handleContentChange} />
				</div>
				<!-- Editor Status Bar -->
				<div
					class="flex h-6 shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-4 font-mono text-[11px] text-slate-500"
				>
					<div class="flex items-center gap-3">
						<span>LaTeX</span>
						<span>UTF-8</span>
					</div>
					<div>
						<span>{activeFile.path}</span>
					</div>
				</div>
			{:else}
				<div class="flex flex-1 items-center justify-center text-xs text-slate-400">
					Select a file from the sidebar to start editing.
				</div>
			{/if}
		</div>

		<!-- Right: PDF Preview Placeholder (Phase 2 ready) -->
		{#if showPreview}
			<div class="flex w-[45%] flex-col overflow-hidden border-l border-slate-200 bg-slate-100">
				<div
					class="flex h-8 shrink-0 items-center justify-between border-b border-slate-300 bg-slate-200/80 px-3 text-xs font-medium text-slate-600"
				>
					<span>PDF Document Preview</span>
					<span class="rounded bg-slate-300 px-1.5 py-0.5 font-mono text-[10px]"
						>Phase 2 Target</span
					>
				</div>

				<div class="flex flex-1 flex-col items-center justify-center p-8 text-center">
					<div
						class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white text-3xl shadow-xs"
					>
						📄
					</div>
					<h4 class="text-sm font-bold text-slate-800">LaTeX Compilation Pipeline</h4>
					<p class="mt-1 max-w-sm text-xs text-slate-500">
						In Phase 2, clicking <strong>Recompile</strong> dispatches a Cloud Tasks job to the sandboxed
						Cloud Run LaTeX runner, rendering the compiled PDF preview here via PDF.js.
					</p>

					<div
						class="mt-6 w-full max-w-xs space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-left text-xs shadow-2xs"
					>
						<div class="flex items-center gap-2 text-slate-700">
							<span class="h-2 w-2 rounded-full bg-emerald-500"></span>
							<span>1. Project Source Archive (GCS)</span>
						</div>
						<div class="flex items-center gap-2 text-slate-700">
							<span class="h-2 w-2 rounded-full bg-blue-500"></span>
							<span>2. Cloud Tasks Queue</span>
						</div>
						<div class="flex items-center gap-2 text-slate-700">
							<span class="h-2 w-2 rounded-full bg-indigo-500"></span>
							<span>3. LaTeX Sandbox Container</span>
						</div>
						<div class="flex items-center gap-2 text-slate-700">
							<span class="h-2 w-2 rounded-full bg-emerald-500"></span>
							<span>4. PDF.js Live Viewer</span>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- New File Modal -->
{#if showNewFileModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
	>
		<div
			class="animate-in fade-in zoom-in-95 w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl duration-150"
		>
			<div class="mb-4 flex items-center gap-3">
				<div
					class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-base text-emerald-700"
				>
					📄
				</div>
				<div>
					<h3 class="text-base font-bold text-slate-900">Add File</h3>
					<p class="text-xs text-slate-500">Enter a file path</p>
				</div>
			</div>

			<form onsubmit={handleCreateFile} class="space-y-4">
				<div>
					<label for="filePath" class="mb-1 block text-xs font-semibold text-slate-700"
						>File Path</label
					>
					<input
						type="text"
						id="filePath"
						bind:value={newFilePath}
						placeholder="e.g. references.bib or chapters/intro.tex"
						required
						class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-transparent focus:ring-2 focus:ring-emerald-500 focus:outline-none"
					/>
				</div>

				<div class="flex items-center justify-end gap-2 pt-2">
					<button
						type="button"
						onclick={() => {
							showNewFileModal = false;
						}}
						disabled={creatingFile}
						class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={creatingFile || !newFilePath.trim()}
						class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
					>
						{#if creatingFile}
							<Loader2 class="h-3.5 w-3.5 animate-spin" />
							<span>Adding...</span>
						{:else}
							<span>Add File</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
