import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { ConnectOutcome } from '../../services/integrations/connector.js';

/**
 * The desktop OAuth framework for integration connectors (production P10),
 * mirroring P7's sign-in pattern: open the provider's consent page in the
 * **system browser**, catch the authorization-code redirect on a one-shot
 * 127.0.0.1 loopback listener, then hand the code to the connector's exchange
 * step (which uses the service's official SDK/helper — token exchange is never
 * hand-rolled where a helper exists). Only the glue lives here.
 *
 * OAuth app credentials are read from the environment at call time
 * (`COCKPITZERO_<APP>_CLIENT_ID` / `_CLIENT_SECRET`), so a dev can export them
 * and connect without a rebuild. When they're absent the source's OAuth button
 * is disabled in the Console and token-paste (where the service supports it)
 * remains the connect path.
 */

/** An OAuth app registration (ours), read from the environment. */
export interface OAuthAppCredentials {
  clientId: string;
  clientSecret: string;
}

/** The env-configured OAuth app for `app` (SLACK / GOOGLE / GITHUB), or null. */
export function oauthAppFor(app: 'slack' | 'google' | 'github'): OAuthAppCredentials | null {
  const prefix = `COCKPITZERO_${app.toUpperCase()}`;
  const clientId = process.env[`${prefix}_CLIENT_ID`]?.trim();
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Shown in the browser tab after the redirect lands (same style as P7's page). */
const page = (title: string, detail: string) => `<!doctype html>
<meta charset="utf-8"><title>CockpitZero</title>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#faf6f0;color:#3d2c1e;font:15px/1.5 system-ui">
  <div style="text-align:center;max-width:26rem;padding:1rem">
    <div style="font-size:1.15rem;font-weight:600;margin-bottom:.35rem">${title}</div>
    <div style="opacity:.7">${detail}</div>
  </div>
</body>`;

/** A one-shot loopback listener for the OAuth authorization-code redirect. */
export interface OAuthLoopback {
  /** The redirect URI to register/pass to the provider. */
  redirectUri: string;
  /** Resolves with the callback query params when the browser lands on /callback. */
  result: Promise<Record<string, string>>;
  close(): void;
}

export function openOAuthLoopback(): Promise<OAuthLoopback> {
  return new Promise((resolve, reject) => {
    let resolveResult: (params: Record<string, string>) => void;
    const result = new Promise<Record<string, string>>((res) => {
      resolveResult = res;
    });

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const isCallback = url.pathname === '/callback';
      const ok = isCallback && url.searchParams.has('code');
      res.writeHead(ok ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        ok
          ? page('Connected', 'You can close this tab and return to CockpitZero.')
          : page('Connection didn’t complete', 'Return to CockpitZero and try again.'),
      );
      if (isCallback) resolveResult(Object.fromEntries(url.searchParams));
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not bind the connect listener.'));
        return;
      }
      resolve({
        redirectUri: `http://127.0.0.1:${address.port}/callback`,
        result,
        close: () => server.close(),
      });
    });
  });
}

/** How long we wait for the user to finish the browser consent (3 minutes). */
const OAUTH_TIMEOUT_MS = 180_000;

/**
 * Run one authorization-code round-trip: loopback up → browser out → code back
 * (with a CSRF `state` check + timeout) → the connector's `exchange`. Every
 * failure resolves to `{ ok: false, error }` — a connect can never throw across
 * the IPC boundary.
 */
export async function runOAuthFlow(opts: {
  openExternal: (url: string) => void | Promise<void>;
  /** Build the provider's consent URL for this round-trip. */
  buildAuthorizeUrl: (redirectUri: string, state: string) => string;
  /** Exchange the authorization code for tokens (via the official SDK helper). */
  exchange: (code: string, redirectUri: string) => Promise<ConnectOutcome>;
  timeoutMs?: number;
}): Promise<ConnectOutcome> {
  const loopback = await openOAuthLoopback();
  const state = randomBytes(16).toString('hex');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await opts.openExternal(opts.buildAuthorizeUrl(loopback.redirectUri, state));
    const params = await Promise.race([
      loopback.result,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Connecting timed out — try again.')),
          opts.timeoutMs ?? OAUTH_TIMEOUT_MS,
        );
      }),
    ]);
    if (params.state !== state) return { ok: false, error: 'The connect callback was invalid.' };
    if (!params.code) {
      return { ok: false, error: params.error_description || params.error || 'Access was denied.' };
    }
    return await opts.exchange(params.code, loopback.redirectUri);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    if (timer) clearTimeout(timer);
    loopback.close();
  }
}

/** Map an unknown SDK error to a short, user-facing message. */
export function connectorError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim() !== '') return err.message;
  return fallback;
}
