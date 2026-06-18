# CockpitZero

A keyboard-first, cross-platform desktop launcher — summon a command bar with a global hotkey,
fuzzy-search your actions, and run one with Enter.

This is a Turborepo + pnpm monorepo. For architecture, conventions, and how to extend things, see
**[CLAUDE.md](./CLAUDE.md)** and **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**.

## Features

- **Launch anything** — open URLs and apps, run shell commands, copy snippets.
- **Parameterized actions** (Level 2) — `{token}` templates turn one action into many: an
  alias `npm` → `https://www.npmjs.com/package/{query}` runs `npm react` straight to the package
  page; `g hello world` → a Google search. The bar shows a live preview as you type.
- **Workflows** (Level 3) — chain several actions under one name and run them in sequence.
- **System search** (Level 4) — type anything that isn't a configured item and the launcher also
  finds **installed apps and files**, cross-platform: Spotlight (`mdfind`) and `/Applications` on
  macOS; the Start-Menu and Search index on Windows. Results are grouped into sections.
- **Fuzzy search** — fzf-powered ranking with match highlighting, across actions, apps and files.
- **GUI config editor** — manage actions, aliases, workflows, the global hotkey, and theme in the
  settings window; changes persist and the hotkey re-registers instantly.

Roadmap: live/dynamic provider results and plugins (L5) — the schemas and layering are already set
up for them.

## Quick start

```bash
corepack enable          # ensure pnpm 10
pnpm install
pnpm dev                 # run desktop + backend + web via Turborepo
```

| App                | Command                                  | Notes                          |
| ------------------ | ---------------------------------------- | ------------------------------ |
| Desktop (Electron) | `pnpm --filter @cockpitzero/desktop dev` | Hotkey: `Cmd/Ctrl+Shift+Space` |
| Backend (Hono)     | `pnpm --filter @cockpitzero/backend dev` | http://localhost:8787          |
| Web (Next.js)      | `pnpm --filter @cockpitzero/web dev`     | http://localhost:3000          |

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
