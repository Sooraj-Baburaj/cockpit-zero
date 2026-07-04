# Shipping plan — from production phases to public launch

The phase docs (P1–P10) cover **product completion**. This doc covers
everything else required to ship: the launch definition, the parallel
ship-readiness track, and post-launch work. Decisions locked 2026-07-03.

## Launch definition

- **Full product launch**: all 10 production phases done before public release.
- **Platforms**: macOS + Windows + Linux at launch.
- **Billing**: designed now, built post-launch — launch offers Free/BYOP plus a
  **Pro waitlist**; the `plan` field (P7) and `usage` metering (P9) are shaped
  for Stripe from day one.
- **Infra**: self-hosted VPS (Hetzner) — see [`deploy/`](../../../deploy/README.md).
- **Pace**: dependency-ordered waves, no hard date.

## Status

| Track | Item                                                                                                        | Status                             |
| ----- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| A     | P1–P6 (Console → agent loop)                                                                                | ✅ done                            |
| A     | P7 auth + sync (better-auth, Postgres + Docker dev, desktop Account panel)                                  | ✅ done                            |
| A     | P8 cloud memory + knowledge (pgvector, memory sync, ingestion)                                              | ✅ done                            |
| A     | P9 managed inference · P10 integrations                                                                     | ⬜ per phase docs                  |
| B     | B1 CI/CD (`.github/workflows/`)                                                                             | ✅ done                            |
| B     | B4 deploy stack scaffolding (`deploy/`)                                                                     | ✅ done (VPS provisioning pending) |
| B     | B2 platform parity · B3 signing/updates · B5 onboarding · B6 telemetry · B7 hardening/perf · B8 docs/launch | ⬜ below                           |

## Execution waves

```
Wave 1  A0 land P6 · B1 CI/CD · B4 deploy scaffolding          ✅
Wave 2  A1 = P7 (auth + sync, on Postgres from day one) ✅ · B2 platform parity ⬜
Wave 3  A2 = P8 ✅ · A3 = P9 (parallel) · B3 signing + auto-update
Wave 4  A4 = P10 (Slack + Google minimum) · B5 onboarding · B6 telemetry
Wave 5  B7 security + perf gate · B8 docs + web → LAUNCH
Post    C1 billing (Stripe) · C2 distribution (brew/winget) · C3 more connectors
```

**Plan delta vs the phase docs:** P7 goes straight to **Postgres** (Docker
Compose for dev) instead of SQLite-then-migrate — the VPS runs Postgres anyway
and P8 needs pgvector; one migration story, not two.

## Track B — ship-readiness phases

### B2 — Platform parity (Linux + Windows are launch targets)

- Linux app search: `.desktop` entry scan (`/usr/share/applications`,
  `~/.local/share/applications`, flatpak/snap dirs) as a new infra adapter
  behind the existing search-provider port; time-boxed, degrades to `[]`.
- Linux file search: `plocate` when present, else skip files gracefully.
- Linux secrets: `safeStorage` needs libsecret — verify the degradation UX
  (AI disabled with explanation, never broken).
- Linux hotkey: X11 fine; **Wayland has no Electron global hotkeys** — detect
  and offer a "bind a system shortcut to `cockpitzero --toggle`" fallback
  (single instance + second-instance signal). Budget real time here.
- Windows QA: SystemIndex reliability, `.lnk` icons, NSIS install/uninstall,
  hotkey conflicts, frameless behaviors, per-monitor DPI.

### B3 — Packaging, signing, auto-update

- macOS: Developer ID cert, hardened runtime (configured), notarization via
  `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID` CI secrets.
- Windows: Azure Trusted Signing (configure `win.azureSignOptions`).
- Linux: AppImage first.
- Auto-update: `electron-updater` against GitHub Releases (publish config is
  in `electron-builder.yml`; **switch owner/repo to the public mirror before
  launch**). UX: silent check, badge in Console, install on quit.
- App icons + installer branding still needed under `apps/desktop/build/`.

### B5 — Onboarding + first-run

- First-run window (new electron-vite entry like `digest.html`): hotkey intro
  → try the bar → choose "use my own key" / "sign in" / "skip".
- Seed starter actions/aliases so the bar is never empty.
- Audit every AI surface for the keyless nudge state (AiOfferPanel pattern).

### B6 — Telemetry + crash reporting (opt-in, privacy-first)

- Crash: `@sentry/electron`, opt-in at first run, `beforeSend` scrubbing (no
  query text, paths, or memory content).
- Product telemetry: Aptabase (Electron SDK, self-hostable later) — counts
  only, never content. Web analytics: self-hosted umami.
- Default **off** for BYOP users; asked once for everyone.

### B7 — Security + performance gate (blocks launch)

- Security: full-branch security review; Electron checklist (CSP everywhere,
  isolation/sandbox stay on, Zod-validate every IPC input at the main
  boundary); backend rate limits (per-IP auth, **per-user token budgets on
  `/inference`**); GDPR basics (privacy policy, data export + account
  deletion endpoints).
- Performance budgets (regression-tested, not felt): hotkey→bar **<100 ms** ·
  config results **<15 ms** · system search **<250 ms** · first AI token
  **<1.5 s** · local recall **<150 ms** · idle RAM **<250 MB**. Lazy-load
  LanceDB/transformers on first AI use; launcher window created once and
  shown/hidden; pre-warm embedder on idle.

### B8 — Docs, web, launch

- Docs replace the `/docs` stub: quickstart, actions/workflows guide, BYOP
  setup per provider, agent + memory explainer, privacy page.
- Landing: real screenshots (≤1600px), Free/BYOP vs Pro (waitlist CTA),
  downloads wired to the latest GitHub Release.
- **Launch checklist**: all A-phases green · signed + notarized builds on all
  three platforms · auto-update verified old→new · staging burn-in · security
  review clean · onboarding tested on fresh VMs · docs + privacy policy live.

## Personas (acceptance lens)

Keyboard Purist (free, no AI) · BYOP Developer (free, key, local-first) ·
Managed Pro (paid, no keys, auto-routed) · Multi-Device Power User (paid,
sync) · Team Lead (future, C4). Every wave should leave all active personas
un-broken — the free/local path is the default and must never regress.
