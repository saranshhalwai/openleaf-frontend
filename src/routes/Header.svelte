<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';

	let user = $derived(page.data.user);
</script>

<header
	class="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-xs"
>
	<div class="flex items-center gap-3">
		<a
			href={resolve('/')}
			class="flex items-center gap-2.5 text-lg font-bold text-gray-900 transition hover:opacity-90"
		>
			<span class="text-2xl">🍃</span>
			<span class="font-extrabold tracking-tight text-emerald-800">Openleaf</span>
		</a>
		<span
			class="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
		>
			v0.1
		</span>
	</div>

	<div class="flex items-center gap-4">
		{#if user}
			<div class="flex items-center gap-3">
				<div class="text-right">
					<div class="text-xs font-semibold text-gray-800">{user.name}</div>
					<div class="text-[11px] text-gray-500">{user.email}</div>
				</div>
				<form method="post" action="/login?/signOut" use:enhance>
					<button
						type="submit"
						class="cursor-pointer rounded-md border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-rose-50 hover:text-rose-600"
					>
						Sign Out
					</button>
				</form>
			</div>
		{:else if page.url.pathname !== '/login'}
			<a
				href={resolve('/login')}
				class="rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs transition hover:bg-emerald-700"
			>
				Sign In
			</a>
		{/if}
	</div>
</header>
