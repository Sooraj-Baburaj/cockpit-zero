# Production Phase 2 — Secrets vault (OS keychain via `safeStorage`)

> **Status:** 🔜 Next · **Depends on:** nothing · **Blocks:** P3 (BYOP keys), P7 (session token),
> P10 (OAuth tokens). **Risk:** medium — touches OS keychain + the trust boundary.

Every later phase needs to store **secrets** — BYOP provider API keys (P3), the backend session token
(P7), OAuth refresh tokens (P10). They must **never** land in `config.json` (synced!) or cross the
preload bridge in plaintext. This phase builds the one place secrets live: an encrypted vault in the
main process backed by Electron `safeStorage` (which uses the OS keychain — Keychain on macOS, DPAPI
on Windows, libsecret on Linux).

## Goal

A main-process `SecretsService` can `set(name, value)` / `get(name)` / `delete(name)` / `has(name)`,
persisting **encrypted** blobs under `userData` (not in `config.json`). The renderer can set/clear a
secret and read its **status** (present/absent), but can **never read the plaintext back**. P3+ read
secrets only inside the main process.

## Scope

**In**

- `SecretsService` (services) + `infra/secrets/secret-store.ts` adapter using `safeStorage` +
  an encrypted file (or per-key files) under `userData/secrets/`.
- A small, named-key contract in `shared` so callers don't pass stringly-typed names.
- IPC: `setSecret(name, value)`, `clearSecret(name)`, `secretStatus()` → `Record<name, boolean>`.
  **No `getSecret` over IPC** — plaintext never leaves main.
- Graceful degradation when `safeStorage.isEncryptionAvailable()` is false (Linux without a keyring):
  refuse to persist plaintext; surface a clear "secure storage unavailable" status so the UI can warn.

**Out**

- The provider/auth/OAuth flows that _use_ the vault (P3 / P7 / P10). This phase is just the vault +
  its IPC + a generic "API keys" affordance the Console can reuse.

## Data model & schema changes

`packages/shared/src/secrets.ts` (new) — the key catalog (pure, no electron):

```ts
/** Stable names for everything kept in the OS-keychain-backed vault. NOT in config.json. */
export const SecretName = {
  providerKey: (provider: string) => `provider:${provider}` as const, // P3 BYOP keys
  sessionToken: 'auth:session' as const, // P7
  oauth: (source: string) => `oauth:${source}` as const, // P10 refresh tokens
} as const;
```

No `ConfigSchema` change — secrets are deliberately _outside_ config.

## IPC channels

```ts
// IpcChannels
setSecret: 'secret:set',
clearSecret: 'secret:clear',
secretStatus: 'secret:status',

// IpcApi
/** Store/replace a secret by name. Resolves false if secure storage is unavailable. */
setSecret(name: string, value: string): Promise<{ ok: boolean }>;
/** Remove a secret. */
clearSecret(name: string): Promise<{ ok: boolean }>;
/** Which secrets are currently set — names → present. Never returns values. */
secretStatus(): Promise<Record<string, boolean>>;
```

## Main-process work

- `infra/secrets/secret-store.ts` — the only `safeStorage`/`fs` touch:
  - `isAvailable()` → `safeStorage.isEncryptionAvailable()`.
  - Persist `safeStorage.encryptString(value)` (a Buffer) per key under `userData/secrets/<sanitized>`
    (or one JSON map of base64 ciphertexts). Decrypt via `safeStorage.decryptString` on read.
  - Lazy-resolve `app.getPath('userData')` (app may not be ready at import — same pattern as
    `memory-store.ts`).
- `services/secrets/secrets-service.ts` — DI over the store; pure logic (validation, the no-plaintext
  rule). Exposes `get` for **in-process** callers (P3 reads the provider key here).
- `ipc/index.ts` — handlers for the three channels above; never expose `get`.

## Renderer work

- A reusable **"API key" field** molecule for the Console: a password input + "Save"/"Clear" + a
  status pill driven by `secretStatus()`. P3's provider panel uses it. The field shows masked
  `••••• set` when present; it cannot reveal the stored value (there's no read path).
- Add `setSecret`/`clearSecret`/`secretStatus` to the dev mock `window.api` (in-memory map) so
  browser/dev mode works without electron.

## Acceptance criteria

- [ ] Setting a secret writes an **encrypted** blob under `userData/secrets/` — opening the file shows
      ciphertext, not the key; `config.json` is unchanged.
- [ ] `secretStatus()` flips the right name to `true` after `setSecret`, `false` after `clearSecret`.
- [ ] There is **no IPC path** that returns a secret's plaintext to the renderer.
- [ ] On a machine without secure storage, `setSecret` resolves `{ ok: false }` and status reflects it
      (no silent plaintext write).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

## Test plan

- `test/secrets-service.test.ts` — inject a fake store; assert set/clear/has logic, the no-plaintext
  contract (service exposes `get` but the IPC layer doesn't), and the unavailable-storage branch.
- Keep electron-free: the `safeStorage` call lives in infra; tests use a fake store.
- Contract test for the three channels.

## Risks / open questions

- **Linux without a keyring.** `safeStorage` may be unavailable. Decision: **never** fall back to
  plaintext — degrade to "secure storage unavailable" and let the user know BYOP keys can't be saved
  on this machine (they can still paste a key per-session in memory if we choose to allow it later).
- **Key rotation / multiple keys per provider.** Keep it one key per provider for now; the
  `SecretName.providerKey(provider)` shape leaves room to extend.

---

### Kickoff prompt

> Read `docs/roadmap/production/phase-2-secrets-vault.md` and `CLAUDE.md`, then implement it. Build a
> main-process secrets vault using Electron `safeStorage` (OS keychain), persisting **encrypted**
> blobs under `userData/secrets/` — never in `config.json`, never readable by the renderer in
> plaintext. Add `setSecret`/`clearSecret`/`secretStatus` IPC (no `getSecret`), a reusable masked
> "API key" field for the Console, and the `shared/secrets.ts` key catalog. Handle the
> secure-storage-unavailable case without ever writing plaintext. Follow the repo's port/adapter +
> typed-IPC patterns; add tests; run `pnpm typecheck`, `pnpm lint`, `pnpm test`.
