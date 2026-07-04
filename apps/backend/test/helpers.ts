import { app } from '../src/app.js';

/**
 * Shared route-test helpers (P7/P8): sign a fresh user up and talk to the app
 * as them via bearer auth.
 *
 * `signUpToken` retries (with a fresh email) on a specific **known upstream
 * flake**: better-auth 1.6's sign-up handler passes `ctx.request?.clone()` to
 * `sendVerificationEmail`, and undici intermittently throws `TypeError:
 * unusable` when the clone races the body stream's tee pump — a 500 *after*
 * the user row is created. It is rare (~1% of sign-ups under load), unrelated
 * to what any test here asserts, and not our code; `test/auth.test.ts`, which
 * tests sign-up itself, deliberately does NOT retry. Re-check when better-auth
 * 1.7 lands.
 */

const SIGN_UP_ATTEMPTS = 3;

/** Sign up a fresh user and return their bearer token. */
export async function signUpToken(email: string): Promise<string> {
  let lastFailure = '';
  for (let attempt = 0; attempt < SIGN_UP_ATTEMPTS; attempt++) {
    // A retried attempt uses a fresh address — the failed one may have
    // half-created its user (the 500 fires after the insert).
    const attemptEmail = attempt === 0 ? email : `retry-${attempt}-${email}`;
    const res = await app.request('/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: attemptEmail,
        password: 'a-strong-password-123',
        name: 'Tester',
      }),
    });
    const token = res.headers.get('set-auth-token');
    if (token) return token;
    lastFailure = `${res.status} ${await res.text()}`;
    if (res.status !== 500) break; // only the clone race is retryable
  }
  throw new Error(`sign-up failed: ${lastFailure}`);
}

/** Bearer + JSON headers for an authed request. */
export const authed = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});
