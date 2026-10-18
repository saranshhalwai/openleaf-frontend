import { fail, redirect, isRedirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAuth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		return redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	signIn: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const auth = getAuth(event.platform?.env);

		try {
			await auth.api.signInEmail({
				body: {
					email,
					password
				},
				headers: event.request.headers
			});
		} catch (error) {
			if (isRedirect(error)) throw error;
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Login failed' });
			}
			return fail(500, { message: 'Unexpected error occurred during login' });
		}

		return redirect(302, '/');
	},

	signUp: async (event) => {
		const formData = await event.request.formData();
		const name = formData.get('name')?.toString() ?? '';
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		if (!email || !password) {
			return fail(400, { message: 'Email and password are required' });
		}

		const auth = getAuth(event.platform?.env);

		try {
			await auth.api.signUpEmail({
				body: {
					name,
					email,
					password,
					callbackURL: '/login?verified=true'
				},
				headers: event.request.headers
			});
		} catch (error) {
			if (isRedirect(error)) throw error;
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Registration failed' });
			}
			return fail(500, { message: 'Unexpected error occurred during signup' });
		}

		return redirect(302, '/login?check-email=true');
	},

	signOut: async (event) => {
		const auth = getAuth(event.platform?.env);
		await auth.api.signOut({
			headers: event.request.headers
		});
		return redirect(302, '/login');
	},

	signInSocial: async (event) => {
		const formData = await event.request.formData();
		const provider = formData.get('provider')?.toString() as 'github' | 'google';
		if (!provider || (provider !== 'github' && provider !== 'google')) {
			return fail(400, { message: 'Invalid OAuth provider' });
		}

		const auth = getAuth(event.platform?.env);
		let redirectUrl: string | undefined;

		try {
			const res = await auth.api.signInSocial({
				body: {
					provider,
					callbackURL: '/'
				},
				headers: event.request.headers
			});
			if (res?.url) {
				redirectUrl = res.url;
			}
		} catch (error) {
			if (isRedirect(error)) throw error;
			if (error instanceof APIError) {
				return fail(400, { message: error.message || `${provider} login failed` });
			}
			console.error(`Unexpected error during ${provider} login:`, error);
			return fail(500, { message: `Unexpected error during ${provider} login` });
		}

		if (redirectUrl) {
			return redirect(302, redirectUrl);
		}

		return redirect(302, '/');
	}
};
