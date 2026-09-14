<script lang="ts">
	import Header from './Header.svelte';
	import { page } from '$app/state';
	import './layout.css';

	let { children } = $props();
	let isEditor = $derived(page.url.pathname.startsWith('/project/'));
</script>

<div class="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 antialiased">
	{#if !isEditor}
		<Header />
		<main class="mx-auto w-full max-w-6xl flex-1 p-6">
			{@render children()}
		</main>
	{:else}
		<main class="flex h-screen w-full flex-1 flex-col overflow-hidden">
			{@render children()}
		</main>
	{/if}
</div>
