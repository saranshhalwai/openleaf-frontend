<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ApiClient, type Project } from '$lib/api';
	import { Plus, Trash2, ExternalLink, RefreshCw, AlertCircle, Clock } from 'lucide-svelte';

	let sessionToken = $derived(page.data.sessionToken);
	let projects = $state<Project[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Create project modal state
	let showCreateModal = $state(false);
	let newProjectName = $state('');
	let creating = $state(false);
	let createError = $state<string | null>(null);

	let deletingId = $state<string | null>(null);

	let api = $derived(new ApiClient(sessionToken || ''));

	async function loadProjects() {
		if (!sessionToken) return;
		loading = true;
		error = null;
		try {
			projects = await api.listProjects();
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'Failed to load projects';
		} finally {
			loading = false;
		}
	}

	async function handleCreateProject(e: SubmitEvent) {
		e.preventDefault();
		if (!newProjectName.trim()) return;
		creating = true;
		createError = null;

		try {
			const project = await api.createProject(newProjectName.trim());
			showCreateModal = false;
			newProjectName = '';
			goto(resolve(`/project/${project.id}`));
		} catch (err: unknown) {
			createError = err instanceof Error ? err.message : 'Failed to create project';
			creating = false;
		}
	}

	async function handleDeleteProject(id: string, name: string) {
		if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
			return;
		}
		deletingId = id;
		try {
			await api.deleteProject(id);
			projects = projects.filter((p) => p.id !== id);
		} catch (err: unknown) {
			alert(err instanceof Error ? err.message : 'Failed to delete project');
		} finally {
			deletingId = null;
		}
	}

	function formatDate(dateStr: string) {
		const d = new Date(dateStr);
		return d.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	onMount(() => {
		loadProjects();
	});
</script>

<div class="space-y-6">
	<!-- Top Bar -->
	<div
		class="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center"
	>
		<div>
			<h1 class="text-2xl font-bold tracking-tight text-slate-900">Your Projects</h1>
			<p class="mt-0.5 text-sm text-slate-500">Manage and collaborate on your LaTeX documents</p>
		</div>

		<div class="flex items-center gap-3">
			<button
				onclick={loadProjects}
				disabled={loading}
				class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-xs transition hover:bg-slate-50 disabled:opacity-50"
				title="Refresh list"
			>
				<RefreshCw class="h-3.5 w-3.5 {loading ? 'animate-spin' : ''}" />
				<span>Refresh</span>
			</button>

			<button
				onclick={() => {
					showCreateModal = true;
				}}
				class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
			>
				<Plus class="h-4 w-4" />
				<span>New Project</span>
			</button>
		</div>
	</div>

	<!-- Error Alert -->
	{#if error}
		<div
			class="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
		>
			<AlertCircle class="mt-0.5 h-5 w-5 shrink-0" />
			<div>
				<div class="font-semibold">Unable to fetch projects</div>
				<p class="mt-0.5 text-xs text-rose-600">
					{error}. Ensure the Go backend service is running on port 8080.
				</p>
			</div>
		</div>
	{/if}

	<!-- Projects List -->
	{#if loading}
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each [1, 2, 3] as skelId (skelId)}
				<div
					class="flex h-40 animate-pulse flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
				>
					<div class="space-y-3">
						<div class="h-5 w-3/4 rounded-md bg-slate-200"></div>
						<div class="h-3 w-1/2 rounded-md bg-slate-100"></div>
					</div>
					<div class="h-4 w-1/3 rounded-md bg-slate-100"></div>
				</div>
			{/each}
		</div>
	{:else if projects.length === 0 && !error}
		<div
			class="mx-auto my-12 max-w-lg rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center"
		>
			<div
				class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-600"
			>
				📄
			</div>
			<h3 class="text-base font-semibold text-slate-800">No projects yet</h3>
			<p class="mx-auto mt-1 max-w-sm text-xs text-slate-500">
				Create your first collaborative LaTeX project. We will automatically initialize a
				boilerplate <code class="rounded bg-emerald-50 px-1 py-0.5 text-emerald-700">main.tex</code> file.
			</p>
			<button
				onclick={() => {
					showCreateModal = true;
				}}
				class="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
			>
				<Plus class="h-4 w-4" />
				<span>Create Project</span>
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each projects as project (project.id)}
				<div
					class="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-slate-300 hover:shadow-md"
				>
					<div>
						<div class="mb-2 flex items-start justify-between gap-2">
							<a
								href={resolve(`/project/${project.id}`)}
								class="line-clamp-1 text-base font-bold text-slate-900 transition hover:text-emerald-700"
							>
								{project.name}
							</a>
							<span
								class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize {project.role ===
								'owner'
									? 'bg-emerald-100 text-emerald-800'
									: project.role === 'editor'
										? 'bg-blue-100 text-blue-800'
										: 'bg-slate-100 text-slate-700'}"
							>
								{project.role}
							</span>
						</div>

						<div class="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
							<Clock class="h-3.5 w-3.5" />
							<span>Updated {formatDate(project.updatedAt)}</span>
						</div>
					</div>

					<div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-5">
						<a
							href={resolve(`/project/${project.id}`)}
							class="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 transition hover:text-emerald-800"
						>
							<span>Open Editor</span>
							<ExternalLink class="h-3.5 w-3.5" />
						</a>

						{#if project.role === 'owner'}
							<button
								onclick={() => handleDeleteProject(project.id, project.name)}
								disabled={deletingId === project.id}
								class="cursor-pointer rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
								title="Delete Project"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Create Project Modal -->
{#if showCreateModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
	>
		<div
			class="animate-in fade-in zoom-in-95 w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl duration-150"
		>
			<div class="mb-4 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-lg text-emerald-700"
				>
					✍️
				</div>
				<div>
					<h3 class="text-lg font-bold text-slate-900">New LaTeX Project</h3>
					<p class="text-xs text-slate-500">Give your project a descriptive title</p>
				</div>
			</div>

			{#if createError}
				<div class="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
					{createError}
				</div>
			{/if}

			<form onsubmit={handleCreateProject} class="space-y-4">
				<div>
					<label for="projectName" class="mb-1 block text-xs font-semibold text-slate-700"
						>Project Name</label
					>
					<input
						type="text"
						id="projectName"
						bind:value={newProjectName}
						placeholder="e.g. NeurIPS 2026 Paper"
						required
						class="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-emerald-500 focus:outline-none"
					/>
				</div>

				<div class="flex items-center justify-end gap-3 pt-2">
					<button
						type="button"
						onclick={() => {
							showCreateModal = false;
						}}
						disabled={creating}
						class="cursor-pointer rounded-lg px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={creating || !newProjectName.trim()}
						class="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
					>
						{#if creating}
							<span
								class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"
							></span>
							<span>Creating...</span>
						{:else}
							<span>Create Project</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
