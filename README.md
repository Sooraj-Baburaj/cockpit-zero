# CockpitZero

A keyboard-first, cross-platform desktop launcher — summon a command bar with a global hotkey,
fuzzy-search your actions, and run one with Enter.

This is a Turborepo + pnpm monorepo. For architecture, conventions, and how to extend things, see
**[CLAUDE.md](./CLAUDE.md)**.

## Quick start

```bash
corepack enable          # ensure pnpm 10
pnpm install
pnpm dev                 # run desktop + backend + web via Turborepo
```

| App                       | Command                                   | Notes                                |
| ------------------------- | ----------------------------------------- | ------------------------------------ |
| Desktop (Electron)        | `pnpm --filter @cockpitzero/desktop dev`  | Hotkey: `Cmd/Ctrl+Shift+Space`       |
| Backend (Hono)            | `pnpm --filter @cockpitzero/backend dev`  | http://localhost:8787                |
| Web (Next.js)             | `pnpm --filter @cockpitzero/web dev`      | http://localhost:3000                |

## Common scripts

```bash
pnpm build       # build everything (shared first)
pnpm lint        # eslint
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest
pnpm format      # prettier --write
pnpm changeset   # record a version bump for packages/*
```

## Layout

```
apps/desktop   Electron launcher (electron-vite, React, Tailwind v4)
apps/backend   Hono API (Drizzle + SQLite, Postgres-swappable)
apps/web       Next.js 15 marketing + download site
packages/shared          Zod schemas (source of truth), types, IPC contract, utils
packages/eslint-config   Shared ESLint 9 flat configs
packages/tsconfig        Shared TypeScript configs
```
