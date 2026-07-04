import { shell } from 'electron';
import { createBackendClient } from '../../infra/auth/backend-client.js';
import { openLoopback } from '../../infra/auth/loopback.js';
import { secretsService } from '../secrets/index.js';
import { createAuthService } from './auth-service.js';

/**
 * The wired auth service the IPC layer uses — pure flows (auth-service.ts)
 * coupled to their concrete ports: fetch (backend-client), the P2 vault, the
 * system browser, and the loopback listener. The backend client is shared
 * with the sync service so both talk to the same origin.
 */
export const backendClient = createBackendClient();

export const authService = createAuthService({
  http: backendClient,
  vault: secretsService,
  openExternal: (url) => shell.openExternal(url),
  openLoopback,
});
