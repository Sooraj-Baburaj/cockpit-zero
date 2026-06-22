import { createSafeStorageSecretStore } from '../../infra/secrets/secret-store.js';
import { createSecretsService } from './secrets-service.js';

/**
 * The wired secrets vault the IPC layer (and, from P3, in-process provider/auth
 * callers) use. The single place that couples the pure service to its concrete
 * `safeStorage` adapter — the `electron`/`fs` touch lives only in the adapter, so
 * the service stays unit-tested with an in-memory fake. Construction is cheap and
 * the store resolves its path lazily, so importing this before `app` is ready is
 * safe.
 */
export const secretsService = createSecretsService({
  store: createSafeStorageSecretStore(),
});
