<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let isSignUp = $state(false);
	let loading = $state(false);
</script>

<div class="flex min-h-[80vh] flex-col items-center justify-center px-4">
	<div class="w-full max-w-md rounded-xl border border-gray-100 bg-white p-8 shadow-lg">
		<div class="mb-8 text-center">
			<div
				class="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl font-bold text-emerald-700"
			>
				🍃
			</div>
			<h1 class="text-2xl font-bold tracking-tight text-gray-900">Openleaf</h1>
			<p class="mt-1 text-sm text-gray-500">Lightweight Collaborative LaTeX Editor</p>
		</div>

		<!-- Tabs -->
		<div class="mb-6 flex rounded-lg bg-gray-100 p-1">
			<button
				type="button"
				class="flex-1 rounded-md py-1.5 text-sm font-medium transition-all {!isSignUp
					? 'bg-white text-gray-900 shadow-sm'
					: 'text-gray-500 hover:text-gray-900'}"
				onclick={() => {
					isSignUp = false;
				}}
			>
				Sign In
			</button>
			<button
				type="button"
				class="flex-1 rounded-md py-1.5 text-sm font-medium transition-all {isSignUp
					? 'bg-white text-gray-900 shadow-sm'
					: 'text-gray-500 hover:text-gray-900'}"
				onclick={() => {
					isSignUp = true;
				}}
			>
				Create Account
			</button>
		</div>

		{#if form?.message}
			<div
				class="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
			>
				<span>⚠️</span>
				<span>{form.message}</span>
			</div>
		{/if}

		<form
			method="post"
			action={isSignUp ? '?/signUp' : '?/signIn'}
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					loading = false;
					await update();
				};
			}}
			class="space-y-4"
		>
			{#if isSignUp}
				<div>
					<label
						for="name"
						class="mb-1 block text-xs font-semibold tracking-wider text-gray-600 uppercase"
						>Full Name</label
					>
					<input
						type="text"
						id="name"
						name="name"
						required
						placeholder="Jane Doe"
						class="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-emerald-500 focus:outline-none"
					/>
				</div>
			{/if}

			<div>
				<label
					for="email"
					class="mb-1 block text-xs font-semibold tracking-wider text-gray-600 uppercase"
					>Email</label
				>
				<input
					type="email"
					id="email"
					name="email"
					required
					placeholder="you@example.com"
					class="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-emerald-500 focus:outline-none"
				/>
			</div>

			<div>
				<label
					for="password"
					class="mb-1 block text-xs font-semibold tracking-wider text-gray-600 uppercase"
					>Password</label
				>
				<input
					type="password"
					id="password"
					name="password"
					required
					placeholder="••••••••"
					class="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-emerald-500 focus:outline-none"
				/>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow transition duration-150 hover:bg-emerald-700 disabled:opacity-50"
			>
				{#if loading}
					<span
						class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
					></span>
					Processing...
				{:else}
					{isSignUp ? 'Create Account' : 'Sign In'}
				{/if}
			</button>
		</form>
	</div>
</div>
