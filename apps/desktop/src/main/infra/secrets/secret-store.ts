import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { SecretStore } from '../../services/secrets/secrets-service.js';

/**
 * The on-disk secrets vault (production Phase 2) — the only `safeStorage`/`fs`
 * touch behind the pure `SecretsService`. Secrets are encrypted with the OS
 * keychain (Keychain on macOS, DPAPI on Windows, libsecret on Linux) and stored
 * **outside** the synced `config.json`:
 *
 * | macOS   | ~/Library/Application Support/CockpitZero/secrets/vault.json |
 * | Windows | %APPDATA%/CockpitZero/secrets/vault.json                     |
 * | Linux   | ~/.config/CockpitZero/secrets/vault.json                     |
 *
 * The file is one JSON map of `name → base64(safeStorage ciphertext)`, so opening
 * it reveals only ciphertext, never a key. The path is resolved **lazily** (the
 * singleton may be constructed before `app` is ready, and `app.getPath` needs a
 * ready app — same pattern as `memory-store.ts`).
 *
 * **No plaintext fallback.** When `safeStorage.isEncryptionAvailable()` is false
 * (e.g. Linux without a keyring) the service refuses to call `set`, so nothing is
 * ever written unencrypted.
 */

interface VaultFile {
  version: 1;
  /** name → base64-encoded `safeStorage.encryptString` ciphertext. */
  secrets: Record<string, string>;
}

export function createSafeStorageSecretStore(): SecretStore {
  let cache: Record<string, string> | null = null;
  let filePath: string | null = null;

  const path = () => (filePath ??= join(app.getPath('userData'), 'secrets', 'vault.json'));

  function load(): Record<string, string> {
    if (cache) return cache;
    try {
      if (!existsSync(path())) return (cache = {});
      const raw = JSON.parse(readFileSync(path(), 'utf8')) as Partial<VaultFile>;
      cache = raw.secrets && typeof raw.secrets === 'object' ? raw.secrets : {};
    } catch {
      // A corrupt/unreadable vault degrades to empty rather than throwing — a bad
      // file shouldn't brick the app; the user can re-enter their keys.
      cache = {};
    }
    return cache;
  }

  function persist(secrets: Record<string, string>): void {
    cache = secrets;
    const file: VaultFile = { version: 1, secrets };
    mkdirSync(dirname(path()), { recursive: true });
    // 0o600: owner-only, defensive even though the contents are already encrypted.
    writeFileSync(path(), JSON.stringify(file, null, 2), { mode: 0o600 });
  }

  return {
    isAvailable() {
      return safeStorage.isEncryptionAvailable();
    },

    set(name, value) {
      const ciphertext = safeStorage.encryptString(value).toString('base64');
      persist({ ...load(), [name]: ciphertext });
    },

    get(name) {
      const stored = load()[name];
      if (stored === undefined) return null;
      try {
        return safeStorage.decryptString(Buffer.from(stored, 'base64'));
      } catch {
        // Undecryptable (e.g. keychain reset, different machine) — treat as unset.
        return null;
      }
    },

    delete(name) {
      const secrets = load();
      if (!(name in secrets)) return;
      const next = { ...secrets };
      delete next[name];
      persist(next);
    },

    has(name) {
      return name in load();
    },

    names() {
      return Object.keys(load());
    },
  };
}
