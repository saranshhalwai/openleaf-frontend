<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let isSignUp = $state(false);
	let loading = $state(false);

	let isVerified = $derived(page.url.searchParams.get('verified') === 'true');
	let checkEmail = $derived(page.url.searchParams.get('check-email') === 'true');
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

		{#if isVerified}
			<div
				class="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
			>
				<span>✅</span>
				<span>Your email has been verified! You can now sign in below.</span>
			</div>
		{/if}

		{#if checkEmail}
			<div
				class="mb-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"
			>
				<span>📬</span>
				<span>A verification link has been sent to your email. Please check your inbox.</span>
			</div>
		{/if}

		<!-- Social Login Buttons -->
		<div class="mb-5 space-y-2.5">
			<form method="post" action="?/signInSocial" use:enhance>
				<input type="hidden" name="provider" value="github" />
				<button
					type="submit"
					class="flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-2xs transition duration-150 hover:bg-gray-50"
				>
					<svg class="h-4 w-4 fill-current" viewBox="0 0 24 24">
						<path
							d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
						/>
					</svg>
					<span>Continue with GitHub</span>
				</button>
			</form>

			<form method="post" action="?/signInSocial" use:enhance>
				<input type="hidden" name="provider" value="google" />
				<button
					type="submit"
					class="flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-2xs transition duration-150 hover:bg-gray-50"
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24">
						<path
							fill="#4285F4"
							d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.02h3.88c2.27-2.09 3.66-5.17 3.66-9.11z"
						/>
						<path
							fill="#34A853"
							d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.02c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.94H1.24v3.12C3.26 21.36 7.33 24 12 24z"
						/>
						<path
							fill="#FBBC05"
							d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.59H1.24C.45 8.24 0 10.07 0 12s.45 3.76 1.24 5.41l4.04-3.12z"
						/>
						<path
							fill="#EA4335"
							d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.59l4.04 3.12c.95-2.84 3.6-4.96 6.72-4.96z"
						/>
					</svg>
					<span>Continue with Google</span>
				</button>
			</form>
		</div>

		<!-- Divider -->
		<div class="relative mb-5 flex items-center justify-center">
			<div class="absolute inset-0 flex items-center">
				<div class="w-full border-t border-gray-200"></div>
			</div>
			<span class="relative bg-white px-3 text-xs uppercase text-gray-400 font-medium"
				>or continue with email</span
			>
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
