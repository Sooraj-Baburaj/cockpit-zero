import { createServer } from 'node:http';
import type { LoopbackHandle } from '../../services/auth/auth-service.js';

/**
 * The one-shot loopback listener for desktop OAuth (P7). Binds 127.0.0.1 on an
 * ephemeral port; the backend's `/desktop-auth/complete` redirects the browser
 * here with a one-time code, which resolves `code` (the auth-service then
 * exchanges it for the session token). Anything other than a code lands a
 * plain error page. The server only ever serves this single round-trip —
 * `close()` runs in the auth-service's `finally`, success or not.
 */

/** Shown in the browser tab after the redirect lands. */
const page = (title: string, detail: string) => `<!doctype html>
<meta charset="utf-8"><title>CockpitZero</title>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#faf6f0;color:#3d2c1e;font:15px/1.5 system-ui">
  <div style="text-align:center;max-width:26rem;padding:1rem">
    <div style="font-size:1.15rem;font-weight:600;margin-bottom:.35rem">${title}</div>
    <div style="opacity:.7">${detail}</div>
  </div>
</body>`;

export function openLoopback(): Promise<LoopbackHandle> {
  return new Promise((resolve, reject) => {
    let resolveCode: (code: string) => void;
    const code = new Promise<string>((res) => {
      resolveCode = res;
    });

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const received = url.pathname === '/callback' ? url.searchParams.get('code') : null;
      res.writeHead(received ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        received
          ? page('You’re signed in', 'You can close this tab and return to CockpitZero.')
          : page('Sign-in didn’t complete', 'Return to CockpitZero and try again.'),
      );
      if (received) resolveCode(received);
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not bind the sign-in listener.'));
        return;
      }
      resolve({
        port: address.port,
        code,
        close: () => server.close(),
      });
    });
  });
}
