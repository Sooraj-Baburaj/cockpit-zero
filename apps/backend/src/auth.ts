import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import { db, schema } from './db/index.js';
import { env } from './env.js';
import { sendEmail } from './email.js';

/**
 * The better-auth instance (P7) — email/password + optional Google/GitHub over
 * the existing Drizzle db. Mounted on the Hono app at `/auth/*` (basePath);
 * `requireAuth` (middleware/auth.ts) validates its sessions.
 *
 * The `bearer` plugin is what makes desktop auth work: sign-in responses carry
 * a `set-auth-token` header, and that token authenticates follow-up requests
 * via `Authorization: Bearer` — no cookies needed from the Electron main
 * process (the token lives in the P2 vault).
 */

/** Social providers are offered only when configured — email/password always works. */
const socialProviders = {
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
    : {}),
  ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
    : {}),
};

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  basePath: '/auth',
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'pg', usePlural: true, schema }),
  emailAndPassword: {
    enabled: true,
    // Verification is sent but not required to sign in — friction stays low at
    // launch; flip `requireEmailVerification` here if abuse shows up.
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Reset your CockpitZero password',
        text: `Click the link to reset your password: ${url}`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Verify your CockpitZero email',
        text: `Click the link to verify your email: ${url}`,
      });
    },
  },
  socialProviders,
  user: {
    additionalFields: {
      /** Entitlements flag (billing deferred): 'free' | 'pro'. Never client-writable. */
      plan: { type: 'string', defaultValue: 'free', input: false },
    },
  },
  plugins: [bearer()],
});

/** The signed-in user's plan, as surfaced on session reads. */
export type Plan = 'free' | 'pro';
