/**
 * Stable names for everything kept in the OS-keychain-backed **secrets vault**
 * (Electron `safeStorage`, main process). These are deliberately **outside**
 * `config.json` — secrets are never synced and never cross the preload bridge in
 * plaintext (see CLAUDE.md → "Secrets never touch config.json or the renderer").
 *
 * Pure, electron-free: callers (renderer + main) use these helpers instead of
 * stringly-typed names so a key can't be misspelled on one side. The actual
 * encrypt/decrypt + persistence lives in the desktop main process
 * (`infra/secrets/secret-store.ts` + `services/secrets/secrets-service.ts`).
 *
 * Production phase 2 builds the vault; later phases populate it:
 *   - P3  → `providerKey(provider)`  (BYOP provider API keys)
 *   - P7  → `sessionToken`           (backend auth session token)
 *   - P10 → `oauth(source)`          (per-connector OAuth refresh tokens)
 */
export const SecretName = {
  /** A BYOP provider's API key, e.g. `provider:anthropic` (P3). */
  providerKey: (provider: string) => `provider:${provider}` as const,
  /** The backend auth session token (P7). */
  sessionToken: 'auth:session' as const,
  /** A connector's OAuth refresh token, e.g. `oauth:google` (P10). */
  oauth: (source: string) => `oauth:${source}` as const,
} as const;
