<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { ApiClient, BACKEND_URL, type Project, type ProjectFile } from '$lib/api';
	import LatexEditor from '$lib/components/LatexEditor.svelte';
	import { CollabProvider, type UserPresence } from '$lib/collab/provider';
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
		PanelRightOpen,
		FileText,
		ExternalLink,
		Terminal,
		X
	} from 'lucide-svelte';

	let sessionToken = $derived(page.data.sessionToken);
	let currentUser = $derived(page.data.user);
	let projectId = $derived(page.params.id as string);

	let api = $derived(new ApiClient(sessionToken || ''));

	// State
	let project = $state<Project | null>(null);
	let files = $state<ProjectFile[]>([]);
	let activeFile = $state<ProjectFile | null>(null);
	let fileContent = $state<string>('');
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Collaboration state (Phase 3)
	let collabProvider = $state<CollabProvider | null>(null);
	let collabStatus = $state<'connecting' | 'connected' | 'disconnected'>('disconnected');
	let activeCollaborators = $state<UserPresence[]>([]);
	let cleanupStatusListener: (() => void) | null = null;
	let cleanupAwarenessListener: (() => void) | null = null;

	// Autosave state
	let saveStatus = $state<'saved' | 'saving' | 'unsaved'>('saved');
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Compilation state (Phase 2)
	let compileStatus = $state<'idle' | 'queued' | 'running' | 'succeeded' | 'failed'>('idle');
	let compiling = $state(false);
	let compileError = $state<string | null>(null);
	let pdfUrl = $state<string | null>(null);
	let buildLog = $state<string>('');
	let showLogModal = $state(false);
	let compilePollTimer: ReturnType<typeof setInterval> | null = null;

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

		// Tear down active collaboration session before switching
		if (cleanupStatusListener) cleanupStatusListener();
		if (cleanupAwarenessListener) cleanupAwarenessListener();
		if (collabProvider) {
			collabProvider.destroy();
			collabProvider = null;
		}
		collabStatus = 'disconnected';
		activeCollaborators = [];

		try {
			const fullFile = await api.getFile(projectId, file.id);
			activeFile = fullFile;
			fileContent = fullFile.content || '';
			saveStatus = 'saved';

			// Start collaboration session if user and sessionToken exist
			if (sessionToken && currentUser) {
				const provider = new CollabProvider(
					BACKEND_URL,
					projectId,
					fullFile.id,
					sessionToken,
					{ id: currentUser.id, name: currentUser.name || 'Anonymous' },
					fullFile.content || ''
				);
				cleanupStatusListener = provider.onStatusChange((status) => {
					collabStatus = status;
				});
				cleanupAwarenessListener = provider.onAwarenessChange((users) => {
					activeCollaborators = users;
				});
				collabProvider = provider;
			}
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

	async function triggerCompilation() {
		if (compiling) return;
		if (saveStatus === 'unsaved' && activeFile) {
			await saveCurrentFile();
		}

		compiling = true;
		compileStatus = 'queued';
		compileError = null;

		try {
			const job = await api.compileProject(projectId);
			startPollingJob(job.id);
		} catch (err: unknown) {
			compiling = false;
			compileStatus = 'failed';
			compileError = err instanceof Error ? err.message : 'Failed to start compilation';
		}
	}

	function startPollingJob(jobId: string) {
		if (compilePollTimer) clearInterval(compilePollTimer);
		let attempts = 0;

		compilePollTimer = setInterval(async () => {
			attempts++;
			try {
				const status = await api.getCompileStatus(projectId);
				if (status.status === 'succeeded') {
					if (compilePollTimer) clearInterval(compilePollTimer);
					compilePollTimer = null;
					compiling = false;
					compileStatus = 'succeeded';
					await loadPdfPreview();
				} else if (status.status === 'failed') {
					if (compilePollTimer) clearInterval(compilePollTimer);
					compilePollTimer = null;
					compiling = false;
					compileStatus = 'failed';
					compileError = status.errorMessage || 'Compilation failed. Check build logs.';
					try {
						buildLog = await api.getCompileLog(projectId);
					} catch {
						// Ignore log error
					}
				} else if (attempts > 90) {
					if (compilePollTimer) clearInterval(compilePollTimer);
					compilePollTimer = null;
					compiling = false;
					compileStatus = 'failed';
					compileError = 'Compilation timed out after 90 seconds.';
				}
			} catch (e) {
				console.error('Error polling compile status:', e);
			}
		}, 1500);
	}

	async function loadPdfPreview() {
		try {
			const blob = await api.getCompilePdfBlob(projectId);
			if (pdfUrl) {
				URL.revokeObjectURL(pdfUrl);
			}
			pdfUrl = URL.createObjectURL(blob);
		} catch (err) {
			console.error('Failed to load compiled PDF preview:', err);
		}
	}

	async function checkInitialCompilation() {
		try {
			const status = await api.getCompileStatus(projectId);
			if (status && status.status === 'succeeded') {
				compileStatus = 'succeeded';
				await loadPdfPreview();
			}
		} catch {
			// No prior compilation, ignore
		}
	}

	async function openBuildLogs() {
		try {
			buildLog = await api.getCompileLog(projectId);
		} catch {
			buildLog = 'No compilation log available.';
		}
		showLogModal = true;
	}

	onMount(() => {
		loadProjectData();
		checkInitialCompilation();
	});

	onDestroy(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
		if (compilePollTimer) clearInterval(compilePollTimer);
		if (pdfUrl) URL.revokeObjectURL(pdfUrl);
		if (cleanupStatusListener) cleanupStatusListener();
		if (cleanupAwarenessListener) cleanupAwarenessListener();
		if (collabProvider) {
			collabProvider.destroy();
			collabProvider = null;
		}
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
			<!-- Real-time Collaboration Status & Presence -->
			<div class="flex items-center gap-2">
				{#if collabStatus === 'connected'}
					<div
						class="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20"
						title="Connected to real-time collaboration room"
					>
						<span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
						<span>Live</span>
					</div>
				{:else if collabStatus === 'connecting'}
					<div
						class="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-600/20"
						title="Connecting to collaboration room..."
					>
						<span class="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
						<span>Connecting</span>
					</div>
				{:else}
					<div
						class="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500"
						title="Collaboration disconnected (working offline)"
					>
						<span class="h-2 w-2 rounded-full bg-slate-400"></span>
						<span>Offline</span>
					</div>
				{/if}

				<!-- Active Collaborators Avatars -->
				{#if activeCollaborators.length > 0}
					<div class="flex items-center -space-x-1.5 overflow-hidden pl-1">
						{#each activeCollaborators as user (user.id)}
							<div
								class="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-2xs ring-2 ring-white"
								style="background-color: {user.color};"
								title="{user.name} is editing this file"
							>
								{user.name.slice(0, 1).toUpperCase()}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="h-4 w-px bg-slate-200"></div>

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
				disabled={compiling}
				class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-75"
				title="Compile LaTeX Document"
				onclick={triggerCompilation}
			>
				{#if compiling}
					<Loader2 class="h-3.5 w-3.5 animate-spin" />
					<span>Compiling...</span>
				{:else}
					<Play class="h-3.5 w-3.5 fill-current" />
					<span>Recompile</span>
				{/if}
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
					<LatexEditor
						content={fileContent}
						provider={collabProvider}
						onchange={handleContentChange}
					/>
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

		<!-- Right: Live PDF Preview Pane -->
		{#if showPreview}
			<div class="relative flex w-[45%] flex-col overflow-hidden border-l border-slate-200 bg-slate-100">
				<!-- Preview Header -->
				<div
					class="flex h-8 shrink-0 items-center justify-between border-b border-slate-300 bg-slate-200/80 px-3 text-xs font-medium text-slate-600"
				>
					<div class="flex items-center gap-2">
						<FileText class="h-3.5 w-3.5 text-slate-500" />
						<span class="font-semibold text-slate-700">PDF Preview</span>
						{#if compileStatus === 'succeeded'}
							<span class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
								<CheckCircle2 class="h-2.5 w-2.5 text-emerald-600" />
								<span>Up to date</span>
							</span>
						{:else if compileStatus === 'failed'}
							<button
								type="button"
								onclick={openBuildLogs}
								class="inline-flex cursor-pointer items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 transition hover:bg-rose-200"
								title="Click to view build error log"
							>
								<AlertCircle class="h-2.5 w-2.5 text-rose-600" />
								<span>Error (view log)</span>
							</button>
						{/if}
					</div>

					<div class="flex items-center gap-1.5">
						{#if pdfUrl}
							<a
								href={pdfUrl}
								target="_blank"
								rel="noreferrer"
								class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-300 hover:text-slate-900"
								title="Open PDF in new tab"
							>
								<ExternalLink class="h-3 w-3" />
								<span>Pop out</span>
							</a>
						{/if}
						<button
							type="button"
							onclick={openBuildLogs}
							class="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-300 hover:text-slate-900"
							title="View raw LaTeX build log"
						>
							<Terminal class="h-3 w-3" />
							<span>Logs</span>
						</button>
					</div>
				</div>

				<!-- Preview Content Area -->
				<div class="relative flex flex-1 flex-col overflow-hidden bg-slate-200/50">
					{#if compiling}
						<div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/85 backdrop-blur-xs">
							<div class="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white p-6 shadow-xl">
								<Loader2 class="h-8 w-8 animate-spin text-emerald-600" />
								<div class="text-center">
									<h4 class="text-xs font-bold text-slate-900">Compiling LaTeX document...</h4>
									<p class="mt-1 text-[11px] text-slate-500">Executing via Cloud Tasks & TeX Live Sandbox</p>
								</div>
							</div>
						</div>
					{/if}

					{#if compileStatus === 'failed'}
						<div class="flex flex-1 flex-col items-center justify-center p-6 text-center">
							<div class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
								<AlertCircle class="h-6 w-6" />
							</div>
							<h4 class="text-sm font-bold text-slate-800">Compilation Failed</h4>
							<p class="mt-2 max-w-sm text-xs text-rose-700 font-mono bg-rose-50 border border-rose-200 rounded-lg p-3 text-left leading-relaxed">
								{compileError || 'Unknown compiler error occurred.'}
							</p>
							<button
								type="button"
								onclick={openBuildLogs}
								class="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-900"
							>
								<Terminal class="h-3.5 w-3.5" />
								<span>View Full Build Log</span>
							</button>
						</div>
					{:else if pdfUrl}
						<iframe
							src={pdfUrl}
							title="Compiled PDF Preview"
							class="h-full w-full border-0 bg-white"
						></iframe>
					{:else}
						<div class="flex flex-1 flex-col items-center justify-center p-8 text-center">
							<div
								class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white text-3xl shadow-xs"
							>
								📄
							</div>
							<h4 class="text-sm font-bold text-slate-800">No PDF Generated Yet</h4>
							<p class="mt-1 max-w-sm text-xs text-slate-500">
								Click <strong>Recompile</strong> in the top bar to build and render the PDF document.
							</p>
							<button
								type="button"
								onclick={triggerCompilation}
								class="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700"
							>
								<Play class="h-3.5 w-3.5 fill-current" />
								<span>Compile Now</span>
							</button>
						</div>
					{/if}
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

<!-- Build Log Modal -->
{#if showLogModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
	>
		<div
			class="animate-in fade-in zoom-in-95 flex h-[80vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl duration-150"
		>
			<div class="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-slate-300">
				<div class="flex items-center gap-2 font-mono text-xs">
					<Terminal class="h-4 w-4 text-emerald-400" />
					<span class="font-bold text-white">LaTeX Compilation Log</span>
				</div>
				<button
					type="button"
					onclick={() => {
						showLogModal = false;
					}}
					class="cursor-pointer rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
				>
					<X class="h-4 w-4" />
				</button>
			</div>
			<div class="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-300 select-text">
				<pre class="whitespace-pre-wrap">{buildLog || 'No log output available.'}</pre>
			</div>
			<div class="flex justify-end border-t border-slate-800 bg-slate-950/60 px-4 py-2.5">
				<button
					type="button"
					onclick={() => {
						showLogModal = false;
					}}
					class="cursor-pointer rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
