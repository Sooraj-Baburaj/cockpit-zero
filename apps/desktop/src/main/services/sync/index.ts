import { getConfig } from '../config-service.js';
import { authService, backendClient } from '../auth/index.js';
import { createMemorySyncStateStore } from '../../infra/agent/memory-sync-state.js';
import { embedder, store } from '../memory/index.js';
import { createSyncService } from './sync-service.js';
import { createMemorySyncService } from './memory-sync-service.js';

/**
 * The wired sync services: config sync (P7) and memory sync (P8), both over the
 * shared backend client, authenticated with the vault-held session token (read
 * in-process via the auth service — plaintext never crosses the bridge).
 */
export const syncService = createSyncService({
  http: backendClient,
  getToken: () => authService.token(),
  getConfig,
});

/** Cloud memory delta sync (P8) against the local LanceDB store — opt-in
 *  (`ai.memorySync`) + signed-in only; the cursor lives per-device in userData. */
export const memorySyncService = createMemorySyncService({
  http: backendClient,
  getToken: () => authService.token(),
  getConfig,
  store,
  embedder,
  state: createMemorySyncStateStore(),
});
