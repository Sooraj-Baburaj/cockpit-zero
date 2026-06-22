/**
 * The secrets vault service (production Phase 2). The one place secrets live —
 * BYOP provider keys (P3), the backend session token (P7), OAuth refresh tokens
 * (P10). Secrets are encrypted at rest via the OS keychain and are deliberately
 * **outside** the synced `config.json`.
 *
 * Dependency-inverted like the rest of the main process: the encrypt/persist
 * adapter (`SecretStore`) is injected, so the rules here (validation, the
 * no-plaintext-when-unavailable rule, the status projection) stay pure and
 * unit-testable with an in-memory fake — no `electron`, no disk.
 *
 * **No-plaintext contract.** `get` returns plaintext for **in-process** callers
 * only (P3 reads the provider key here, in main). The IPC layer exposes
 * `set`/`delete`/`status` but **never** `get` — plaintext never crosses the
 * preload bridge.
 */

/** The persistence + crypto port — an in-memory fake in tests, `safeStorage` +
 *  an encrypted file under `userData/secrets/` in production. */
export interface SecretStore {
  /** Whether OS-keychain-backed encryption is available right now. On Linux
   *  without a keyring this is false — we then refuse to persist (no plaintext). */
  isAvailable(): boolean;
  /** Persist an **encrypted** blob for `name`. Only called when `isAvailable()`. */
  set(name: string, value: string): void;
  /** Decrypt and return the plaintext for `name`, or null if absent/undecryptable. */
  get(name: string): string | null;
  /** Remove a secret (no-op if absent). */
  delete(name: string): void;
  /** Whether a secret is currently stored for `name`. */
  has(name: string): boolean;
  /** Every currently-stored secret name. */
  names(): string[];
}

export interface SecretsService {
  /** Whether secure storage is available — surfaces the "can't save keys here" case. */
  isAvailable(): boolean;
  /** Store/replace a secret. `{ ok: false }` when secure storage is unavailable or
   *  the (trimmed) value is empty — we never fall back to writing plaintext. */
  set(name: string, value: string): { ok: boolean };
  /** **In-process only** plaintext read — never wired to IPC. Null if unset. */
  get(name: string): string | null;
  /** Remove a secret. Idempotent (`{ ok: true }` even if it wasn't set). */
  delete(name: string): { ok: boolean };
  /** Whether a secret is currently set. */
  has(name: string): boolean;
  /** name → present, for every currently-set secret. Never returns values; an
   *  unset name is simply absent (the renderer reads `status[name] ?? false`). */
  status(): Record<string, boolean>;
}

export function createSecretsService({ store }: { store: SecretStore }): SecretsService {
  return {
    isAvailable() {
      return store.isAvailable();
    },

    set(name, value) {
      // Refuse to persist when there's no OS keychain — never a plaintext fallback.
      if (!store.isAvailable()) return { ok: false };
      const trimmed = value.trim();
      if (trimmed === '') return { ok: false };
      store.set(name, trimmed);
      return { ok: true };
    },

    get(name) {
      return store.get(name);
    },

    delete(name) {
      store.delete(name);
      return { ok: true };
    },

    has(name) {
      return store.has(name);
    },

    status() {
      return Object.fromEntries(store.names().map((name) => [name, true]));
    },
  };
}
