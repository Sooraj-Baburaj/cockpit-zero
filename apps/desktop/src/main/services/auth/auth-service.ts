import { SecretName } from '@cockpitzero/shared';
import type { AccountStatus, PasswordCredentials, Plan, SignInMethod } from '@cockpitzero/shared';

/**
 * Backend account sign-in/out + whoami (production P7). Dependency-inverted
 * like the rest of the main process: HTTP, the vault, the system browser, and
 * the loopback listener are injected ports, so the flows here stay pure and
 * unit-testable with fakes — no `electron`, no sockets.
 *
 * The session token lives **only** in the P2 vault (`SecretName.sessionToken`)
 * — never `config.json` (it syncs) and never across the preload bridge. IPC
 * exposes sign-in/out/status; in-process callers (sync) read the token via
 * `token()`.
 */

/** Minimal backend HTTP port (a thin fetch in infra; a stub in tests). */
export interface BackendHttp {
  /** The API origin — used to build browser-facing URLs (OAuth start). */
  baseUrl: string;
  request(
    path: string,
    init?: {
      method?: 'GET' | 'POST' | 'DELETE';
      json?: unknown;
      token?: string;
      /** Override the default request time-box (large knowledge uploads,
       *  long-lived inference streams). */
      timeoutMs?: number;
      /** Caller-side cancellation (e.g. aborting a streamed answer) — combined
       *  with the time-box, whichever fires first. */
      signal?: AbortSignal;
    },
  ): Promise<Response>;
}

/** The slice of the secrets vault the auth flows need (SecretsService satisfies it). */
export interface TokenVault {
  set(name: string, value: string): { ok: boolean };
  get(name: string): string | null;
  delete(name: string): { ok: boolean };
}

/** A one-shot loopback HTTP listener for the OAuth code redirect. */
export interface LoopbackHandle {
  port: number;
  /** Resolves with the one-time code when the browser lands on /callback. */
  code: Promise<string>;
  close(): void;
}

export interface AuthPorts {
  http: BackendHttp;
  vault: TokenVault;
  /** Open a URL in the system browser (never an embedded webview). */
  openExternal(url: string): void | Promise<void>;
  openLoopback(): Promise<LoopbackHandle>;
  /** How long to wait for the browser OAuth round-trip (default 3 minutes). */
  oauthTimeoutMs?: number;
}

export interface AuthService {
  signIn(
    method: SignInMethod,
    credentials?: PasswordCredentials,
  ): Promise<{ ok: boolean; error?: string }>;
  signOut(): Promise<void>;
  status(): Promise<AccountStatus>;
  /** In-process only — the bearer token for backend calls (sync), or null. */
  token(): string | null;
  /** The last plan `status()` observed — synchronous, for gates that can't await
   *  the network (the managed provider's `ready()`). Null = unknown/signed out. */
  plan(): Plan | null;
}

/** Extract better-auth's error message from a non-OK response, if present. */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}

export function createAuthService(ports: AuthPorts): AuthService {
  const { http, vault } = ports;

  /** Last plan seen by `status()` — the synchronous read `plan()` serves. Starts
   *  unknown (null) on launch; a successful whoami sets it, sign-out clears it. */
  let cachedPlan: Plan | null = null;

  /** Persist the session token; refuses (with a user-facing reason) when the
   *  OS keychain is unavailable — the token is never stored in plaintext. */
  function storeToken(token: string): { ok: boolean; error?: string } {
    const stored = vault.set(SecretName.sessionToken, token);
    return stored.ok
      ? { ok: true }
      : { ok: false, error: 'Secure storage is unavailable, so the session can’t be saved.' };
  }

  async function signInPassword(
    credentials: PasswordCredentials,
  ): Promise<{ ok: boolean; error?: string }> {
    const path = credentials.create ? '/auth/sign-up/email' : '/auth/sign-in/email';
    const json = credentials.create
      ? {
          email: credentials.email,
          password: credentials.password,
          name: credentials.name?.trim() || credentials.email.split('@')[0],
        }
      : { email: credentials.email, password: credentials.password };

    const res = await http.request(path, { method: 'POST', json });
    if (!res.ok) {
      const fallback = credentials.create ? 'Could not create the account.' : 'Sign-in failed.';
      return { ok: false, error: await errorMessage(res, fallback) };
    }
    // The bearer plugin returns the session token in this header.
    const token = res.headers.get('set-auth-token');
    if (!token) return { ok: false, error: 'The backend returned no session token.' };
    return storeToken(token);
  }

  async function signInOAuth(
    provider: 'google' | 'github',
  ): Promise<{ ok: boolean; error?: string }> {
    const loopback = await ports.openLoopback();
    const timeoutMs = ports.oauthTimeoutMs ?? 180_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await ports.openExternal(
        `${http.baseUrl}/desktop-auth/start?provider=${provider}&port=${loopback.port}`,
      );
      const code = await Promise.race([
        loopback.code,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Sign-in timed out.')), timeoutMs);
        }),
      ]);
      const res = await http.request('/desktop-auth/exchange', { method: 'POST', json: { code } });
      if (!res.ok) {
        return { ok: false, error: await errorMessage(res, 'Sign-in could not be completed.') };
      }
      const { token } = (await res.json()) as { token?: string };
      if (!token) return { ok: false, error: 'The backend returned no session token.' };
      return storeToken(token);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      if (timer) clearTimeout(timer);
      loopback.close();
    }
  }

  return {
    async signIn(method, credentials) {
      try {
        if (method === 'password') {
          if (!credentials) return { ok: false, error: 'Email and password are required.' };
          return await signInPassword(credentials);
        }
        return await signInOAuth(method);
      } catch (err) {
        // Network failures land here — surface a message instead of throwing
        // across the IPC boundary.
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async signOut() {
      const token = vault.get(SecretName.sessionToken);
      if (token) {
        // Best-effort server-side revocation — the local token is cleared
        // regardless, which is what actually signs the app out.
        try {
          await http.request('/auth/sign-out', { method: 'POST', json: {}, token });
        } catch {
          /* offline sign-out is still a sign-out */
        }
      }
      vault.delete(SecretName.sessionToken);
      cachedPlan = null;
    },

    async status() {
      const token = vault.get(SecretName.sessionToken);
      if (!token) {
        cachedPlan = null;
        return { signedIn: false };
      }
      try {
        const res = await http.request('/auth/get-session', { token });
        if (!res.ok) return { signedIn: false };
        const body = (await res.json()) as { user?: { email: string; plan?: string } } | null;
        if (!body?.user) return { signedIn: false };
        cachedPlan = body.user.plan === 'pro' ? 'pro' : 'free';
        return { signedIn: true, email: body.user.email, plan: cachedPlan };
      } catch {
        // Unreachable backend reads as signed out for now; the token stays in
        // the vault, so a later status() recovers once we're back online.
        return { signedIn: false };
      }
    },

    token() {
      return vault.get(SecretName.sessionToken);
    },

    plan() {
      return cachedPlan;
    },
  };
}
