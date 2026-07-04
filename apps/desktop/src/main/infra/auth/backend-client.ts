import type { BackendHttp } from '../../services/auth/auth-service.js';

/**
 * The concrete backend HTTP adapter (fetch). The base URL defaults to the dev
 * backend and is overridable via COCKPITZERO_API_URL (packaging will bake the
 * production origin). Every request is time-boxed so a dead backend fails the
 * flow with an error instead of hanging the Console.
 */

const DEFAULT_BASE_URL = 'http://localhost:8787';
const REQUEST_TIMEOUT_MS = 15_000;

export function createBackendClient(baseUrl?: string): BackendHttp {
  const base = (baseUrl ?? process.env.COCKPITZERO_API_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  return {
    baseUrl: base,
    request(path, { method = 'GET', json, token, timeoutMs, signal } = {}) {
      const timeout = AbortSignal.timeout(timeoutMs ?? REQUEST_TIMEOUT_MS);
      return fetch(`${base}${path}`, {
        method,
        headers: {
          ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: json !== undefined ? JSON.stringify(json) : undefined,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    },
  };
}
