# Production Phase 7 — Backend auth + real cloud sync

> **Status:** 🔜 Next · **Depends on:** P2 (vault, for the desktop session token) · **Blocks:** P8
> (cloud memory), P9 (managed inference), P10 (per-user OAuth). **Risk:** high — real accounts +
> the security boundary. Can run as a parallel backend track from day one.

The backend `/auth` and `/sync` are **stubs** (`token: 'stub-token'`, `requireAuth` fakes a user,
`/sync` persists nothing). This phase makes accounts and cross-device config sync **real**, so a
logged-in user's data actually lives in the backend. **Billing is deferred** (per the locked
decision) — paid features gate on a flag until a later Stripe phase.

## Goal

A user can create an account / sign in (email + password and/or OAuth), the desktop app stores the
session securely (P2 vault), `requireAuth` validates real sessions, and `/sync` persists + returns the
user's `Config` from the database (validated by `ConfigSchema`). Free/local users are unaffected — no
login is ever required.

## Locked decisions honored

- **Auth now, billing later.** Stand up accounts + sync; defer Stripe.
- Auth implementation = **better-auth** (Drizzle adapter, fits the existing Hono + Drizzle +
  SQLite/Postgres backend; no auth vendor lock-in). *Managed (Clerk/WorkOS) is the documented
  fallback if self-hosting auth proves too heavy.*
- Session token on the desktop lives in the **P2 secrets vault**, never `config.json`.

## Scope

**In**

- better-auth wired into the Hono app: email/password + at least one OAuth provider (Google and/or
  GitHub), email verification + password reset (real email via a provider like Resend, or log-link in
  dev), session management.
- Drizzle schema for auth (users/sessions/accounts/verification per better-auth) — replace the toy
  `users` table; keep/extend the `configs` table.
- `requireAuth` validates a **real** session/bearer token (remove the stub user).
- Real `/sync`: `POST` upserts the user's `Config` (ConfigSchema-validated) into `configs`;
  `GET` returns the latest (or `null`). Add a `updatedAt`/version for last-write-wins or simple
  conflict handling.
- Desktop **login flow**: a Console "Account" panel → sign in (OAuth opens the system browser with a
  loopback/deep-link callback; email/password inline) → store the session token in the vault →
  authenticated `window.api` calls to the backend. Sign out clears the token.
- A `whoami`/session-status path so the desktop knows logged-in state + (later) plan/entitlements.

**Out**

- Stripe / metered billing (a later phase). Add an `entitlements`/`plan` field now (default `free`)
  that a flag can flip for testing P9, but no payment.
- Cloud **memory** sync (P8) and managed **inference** (P9) — separate phases; this just gives them
  real auth + a user id.

## Packages to add

```
better-auth                 # backend auth (sessions, OAuth, email/password)
# an email sender for verification/reset, e.g. resend (or a dev console transport)
```

## Data model & schema changes

- `apps/backend/src/db/schema.ts` — adopt better-auth's required tables (users, sessions, accounts,
  verifications) via its Drizzle adapter; extend `users` with `plan` (`free`/`pro`, default `free`)
  and keep `configs(userId, payload, updatedAt)`. Regenerate migrations (`drizzle-kit generate`).
- `packages/shared` — add a small `Session`/`AccountStatus` wire type if the desktop needs a typed
  shape for `whoami` (don't duplicate better-auth internals; just what crosses to the app).
- `ConfigSchema` unchanged (it's already the `/sync` body).

## IPC channels (desktop)

```ts
// IpcChannels
signIn: 'auth:sign-in',
signOut: 'auth:sign-out',
authStatus: 'auth:status',
syncPush: 'sync:push',
syncPull: 'sync:pull',

// IpcApi
signIn(method: 'google' | 'github' | 'password', creds?: {...}): Promise<{ ok: boolean }>;
signOut(): Promise<void>;
authStatus(): Promise<{ signedIn: boolean; email?: string; plan?: 'free' | 'pro' }>;
syncPush(): Promise<{ ok: boolean; syncedAt: string }>;   // pushes current Config
syncPull(): Promise<{ ok: boolean; config: Config | null }>;
```

## Backend work

- Mount better-auth on the Hono app (`/auth/*`), backed by the Drizzle adapter over the existing DB.
- Rewrite `middleware/auth.ts` `requireAuth` to validate a real session (cookie or bearer) → set the
  real `userId`. Remove the stub.
- Rewrite `routes/sync.ts`: `POST` upserts `configs` for `userId` (ConfigSchema-validated);
  `GET` returns the latest config or `null`. Add `updatedAt` and reject stale writes if you implement
  optimistic concurrency.
- Tests via `app.request(...)` with a seeded session — no live server.

## Main-process / desktop work

- `services/auth/auth-service.ts` + `infra/auth/` adapter: perform the sign-in (OAuth via system
  browser + loopback redirect, or password POST), store the returned session token in the vault
  (`SecretName.sessionToken`), attach it to backend calls, expose `authStatus`.
- A `sync-service.ts` that serializes the local `Config` and calls `/sync` (push/pull), with the
  token from the vault. Decide merge policy (last-write-wins to start; surface conflicts later).

## Renderer work

- Console "Account" panel: signed-out (sign-in buttons + email/password) ↔ signed-in (email, plan
  badge, "Sync now", sign out). Make crystal-clear that **login is optional** and the app is fully
  usable free/local. Sahara styling; keyboard-first.

## Acceptance criteria

- [ ] A real account can be created and signed into (email/password + at least one OAuth provider);
      verification/reset emails are sent (or dev-logged).
- [ ] `requireAuth` rejects missing/invalid sessions and accepts real ones (the stub is gone).
- [ ] `POST /sync` persists the user's `Config` to the DB; `GET /sync` returns it; round-trips through
      `ConfigSchema`.
- [ ] The desktop stores the session token in the **vault** (not `config.json`); sign-out clears it.
- [ ] Free/local usage requires **no** login and is unchanged.
- [ ] Backend tests (`app.request`) cover auth-gated sync (200 with session, 401 without).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

## Test plan

- `apps/backend/test/auth.test.ts` + `sync.test.ts` — seed a session; assert protected routes 401
  without it, succeed with it; sync upsert+read round-trips and validates against `ConfigSchema`.
- Desktop `auth-service`/`sync-service` tests with a fake HTTP client + fake vault (electron-free).

## Risks / open questions

- **OAuth on desktop.** Use system-browser + loopback (`http://127.0.0.1:<port>`) or a custom
  protocol deep link; don't embed an OAuth webview. Validate the redirect.
- **Conflict resolution.** Start last-write-wins with `updatedAt`; design real merge later (it's
  config, so coarse-grained LWW is acceptable initially).
- **Self-host vs managed auth.** Going with better-auth. If email deliverability / social-login upkeep
  becomes a burden, the fallback is Clerk/WorkOS — keep the desktop's `auth-service` port stable so the
  backend can swap without touching the app.
- **DB swap.** SQLite for dev; the schema must stay Postgres-clean for prod (P8 wants pgvector
  anyway). Re-author with `drizzle-orm/pg-core` when moving to Postgres.

---

### Kickoff prompt

> Read `docs/roadmap/production/phase-7-backend-auth-sync.md` and `CLAUDE.md`, then make backend auth +
> cloud sync **real** (replacing the stubs). Use **better-auth** (Drizzle adapter over the existing
> Hono backend) for email/password + OAuth (Google/GitHub) + verification/reset; rewrite `requireAuth`
> to validate real sessions; rewrite `/sync` to upsert+return the user's `Config` (ConfigSchema-
> validated) from the DB. Add a desktop Account panel + auth/sync IPC; store the session token in the
> **P2 vault** (never `config.json`). **Login stays optional** — free/local usage must be unchanged.
> Defer Stripe billing; add a `plan` field (default `free`) only as a test flag for P9. Backend tests
> via `app.request`; run `pnpm typecheck`, `pnpm lint`, `pnpm test`.
