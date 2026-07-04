/**
 * Wire types for the backend account + sync state (production P7). Only what
 * crosses to the desktop app lives here — better-auth internals stay in the
 * backend. Pure types, no runtime dependency.
 */

/** Entitlements tier. Billing is deferred — `pro` is flipped manually (a test
 *  flag for P9) until the Stripe phase. */
export type Plan = 'free' | 'pro';

/** OAuth providers offered for desktop sign-in (system browser + loopback). */
export type OAuthProvider = 'google' | 'github';

/** How the Account panel signs in: a browser OAuth flow or inline credentials. */
export type SignInMethod = OAuthProvider | 'password';

/** Inline email/password credentials; `create` signs **up** instead of in. */
export interface PasswordCredentials {
  email: string;
  password: string;
  /** Display name for sign-up (defaults to the email's local part). */
  name?: string;
  /** True = create the account (sign-up) rather than sign in. */
  create?: boolean;
}

/** The desktop's view of the session — the `whoami` shape. Login is optional:
 *  `{ signedIn: false }` is the normal, fully-functional free/local state. */
export type AccountStatus = { signedIn: false } | { signedIn: true; email: string; plan: Plan };
