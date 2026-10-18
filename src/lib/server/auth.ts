import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';

let authInstance: ReturnType<typeof createAuthInstance> | null = null;

function createAuthInstance(platformEnv?: any) {
	const origin = platformEnv?.ORIGIN || env.ORIGIN || 'https://openleaf.saranshhalwai.me';
	const secret = platformEnv?.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET;
	const githubClientId = platformEnv?.GITHUB_CLIENT_ID || env.GITHUB_CLIENT_ID;
	const githubClientSecret = platformEnv?.GITHUB_CLIENT_SECRET || env.GITHUB_CLIENT_SECRET;
	const googleClientId = platformEnv?.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID;
	const googleClientSecret = platformEnv?.GOOGLE_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET;
	const resendApiKey = platformEnv?.RESEND_API_KEY || env.RESEND_API_KEY;
	const emailFrom = platformEnv?.EMAIL_FROM || env.EMAIL_FROM || 'Openleaf <onboarding@resend.dev>';

	const socialProviders: Record<string, any> = {};
	if (githubClientId && githubClientSecret) {
		socialProviders.github = {
			clientId: githubClientId,
			clientSecret: githubClientSecret
		};
	}
	if (googleClientId && googleClientSecret) {
		socialProviders.google = {
			clientId: googleClientId,
			clientSecret: googleClientSecret
		};
	}

	return betterAuth({
		baseURL: origin,
		secret: secret,
		database: drizzleAdapter(db, { provider: 'pg' }),
		emailAndPassword: { enabled: true },
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			sendVerificationEmail: async ({ user, url }) => {
				if (resendApiKey) {
					try {
						const res = await fetch('https://api.resend.com/emails', {
							method: 'POST',
							headers: {
								Authorization: `Bearer ${resendApiKey}`,
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({
								from: emailFrom,
								to: [user.email],
								subject: 'Verify your email address - Openleaf',
								html: `
									<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
										<div style="text-align: center; margin-bottom: 24px;">
											<div style="display: inline-block; background: #ecfdf5; border-radius: 12px; padding: 12px; font-size: 24px;">🍃</div>
											<h2 style="color: #0f172a; margin: 12px 0 4px 0; font-size: 20px; font-weight: 700;">Verify your Openleaf email</h2>
											<p style="color: #64748b; font-size: 14px; margin: 0;">Welcome to Openleaf, ${user.name || 'there'}!</p>
										</div>
										<p style="color: #334155; font-size: 14px; line-height: 1.6;">Please confirm your email address by clicking the button below:</p>
										<div style="text-align: center; margin: 28px 0;">
											<a href="${url}" style="background-color: #059669; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block;">Verify Email Address</a>
										</div>
										<p style="color: #94a3b8; font-size: 12px; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px;">If you didn't create an Openleaf account, you can safely ignore this email.</p>
									</div>
								`,
								text: `Hi ${user.name || 'there'},\n\nPlease verify your Openleaf account by opening this link:\n${url}\n\nThanks,\nThe Openleaf Team`
							})
						});
						if (!res.ok) {
							const errData = await res.text();
							console.error('[Resend Error]:', errData);
						} else {
							return;
						}
					} catch (err) {
						console.error('[Resend Fetch Error]:', err);
					}
				}
				console.log(`[Verification Email Fallback for ${user.email}]: ${url}`);
			}
		},
		socialProviders,
		plugins: [
			sveltekitCookies(getRequestEvent)
		]
	});
}

export function getAuth(platformEnv?: any) {
	if (authInstance) {
		const configuredProviders = Object.keys((authInstance.options as any).socialProviders || {}).length;
		const hasPlatformSecrets = Boolean(platformEnv?.GITHUB_CLIENT_ID || platformEnv?.GOOGLE_CLIENT_ID);
		// Reuse instance if it already has social providers or no new platform secrets are provided
		if (configuredProviders > 0 || !hasPlatformSecrets) {
			return authInstance;
		}
	}
	const instance = createAuthInstance(platformEnv);
	authInstance = instance;
	return instance;
}

export const auth = getAuth();
