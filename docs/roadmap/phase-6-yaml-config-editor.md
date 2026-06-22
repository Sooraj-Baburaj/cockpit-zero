# Phase 6 — YAML config editor

> **Status:** ⚙️ Config · **Screen:** `mockups/yaml-config.html` ·
> **Depends on:** only the **config schema** (`ConfigSchema`, and `RoutineSchema` from
> [Phase 5](phase-5-routines-digest.md) if editing `routines.yaml`). **AI-independent — can run in
> parallel with any other phase, or first.**

A power-user surface to **edit the config by hand**: a file tree (`config.yaml`, `aliases.yaml`,
`workflows.yaml`, `routines.yaml`), a warm-syntax YAML editor, **live schema validation**, and an
outline panel. "The schemas lead" — this is a thin, faithful YAML view over the same Zod schemas the
GUI edits, so hand-edits and GUI edits are interchangeable.

## Goal

Open the editor, pick `routines.yaml`, see the config serialized as warm-highlighted YAML with line
numbers; edits validate live against the schema (✓ "Schema valid · 2 routines", ⚠ "standup_prep has
no schedule — runs on demand only"); an outline lists the entries; **Save** (`⌘S`) writes back
through the same validated config path the GUI uses. Format (`⌥⇧F`) and Validate (`⌘↵`) too.

## Scope

**In**

- YAML **serialize/deserialize** of the config, split into logical files: `config.yaml` (settings +
  actions), `aliases.yaml`, `workflows.yaml`, `routines.yaml`.
- A YAML editor surface (file tree + editor + validation/outline side panel + status bar) matching
  the mockup.
- **Live validation** against the Zod schemas; surfaced as ✓/⚠ rows with the offending key.
- **Save** = parse YAML → validate with the schema → write via the existing config path (so a bad
  edit can never corrupt config; on parse/validate failure, block save and show the error).
- **Format** (canonicalize YAML) and **Outline** (structural list).

**Out**

- A full IDE (multi-cursor, find/replace, etc.). A focused editor is enough; reuse a lightweight
  editor/highlighter rather than embedding a heavy IDE if it fits CSP.
- Editing files the schema doesn't own. Only the config-backed YAML files.
- Two-way *live* binding with the GUI while both are open simultaneously — Save-then-reload is fine.

## Data model & schema changes

**No schema changes.** This phase adds a **YAML <-> config** mapping layer, not new config shape:

- `packages/shared` (or a desktop service) — pure functions:
  - `configToYamlFiles(config): Record<filename, string>` — serialize each slice to YAML.
  - `yamlFileToConfigSlice(filename, text): Result<Partial<Config>, ValidationError[]>` — parse +
    validate one file back to a config slice.
  - `validateYaml(filename, text): ValidationIssue[]` — the live ✓/⚠ feed (schema errors +
    soft-warnings like "no schedule → on-demand only").
- Keep these **pure and in `shared`** where possible so they're unit-tested without electron, and so
  the same serialization can back `/sync` later. YAML lib: add one to the catalog (e.g. `yaml`).

> The mockup's `routines.yaml` uses snake_case (`rank_by`, `max_items`) while the TS schema is
> camelCase. Decide one canonical YAML casing and map it in the serializer (snake_case reads more
> natural in YAML and matches the mockup — prefer it, and convert at the boundary). Document the
> mapping.

## IPC channels (four-step recipe)

```ts
// IpcChannels
readConfigYaml:  'config:read-yaml',     // -> { [filename]: string }
writeConfigYaml: 'config:write-yaml',    // (filename, text) -> { ok, issues }
validateConfigYaml: 'config:validate-yaml', // (filename, text) -> issues (no write)

// IpcApi
readConfigYaml(): Promise<Record<string, string>>;
writeConfigYaml(file: string, text: string): Promise<{ ok: boolean; issues: ValidationIssue[] }>;
validateConfigYaml(file: string, text: string): Promise<ValidationIssue[]>;
```

> Validation can also run **purely in the renderer** if the mapping functions live in `shared`
> (imported by the renderer) — that gives instant feedback with no round-trip. Use IPC only for the
> authoritative read/write against the on-disk config. Prefer renderer-side live validation + an
> IPC write that re-validates server-side before persisting.

## Main-process work

- A `services/config-yaml-service.ts` wrapping the shared mapping fns over the existing config store:
  read current config → `configToYamlFiles`; on write, parse + validate + (if ok) merge the slice into
  the full config and persist through the **existing** validated `setConfig`/store path. Never write
  unvalidated YAML straight to disk.
- If the editor is a separate window, add a vite HTML entry + window-open channel (CLAUDE.md
  multi-entry + window patterns). It can also be a tab inside Settings — simpler. Decide and note it;
  a Settings tab avoids a new window.

## Renderer work

- **Surface `YamlConfigEditor`** (mirrors `yaml-config.html`): a 3-column body — file tree (200px),
  editor (flex), validation/outline side panel (232px) — inside the window frame with a titlebar
  (filename + unsaved dot, Format / Save) and a status bar (YAML · Ln/Col · UTF-8 · Spaces: 2 ·
  Validated · synced).
- **Editor.** Reuse a small, CSP-friendly code editor or a controlled `<textarea>` overlaid with a
  syntax-highlight layer using the mockup's token classes (`.k` key, `.s` string, `.num`, `.cm`
  comment, `.pl` plain). The mockup renders highlighted lines with a left gutter and an active-line
  highlight (`--cz-accent-soft` + `inset 2px 0 0 --cz-accent`). Don't pull in a heavy IDE if a
  highlighter satisfies the look within CSP.
- **File tree.** The four YAML files with kind glyphs; active file `--cz-glass-3`; an unsaved dot.
- **Side panel.** Validation rows (✓ `--cz-success`, ⚠ `--cz-warn`) with the offending `code`;
  Outline (entries + sub-lines); Shortcuts list (`⌘S`, `⌥⇧F`, `⌘↵`).
- **Shortcuts.** `⌘S` save, `⌥⇧F` format, `⌘↵` validate. Block save on invalid; show the error inline.

## Design reference (from `yaml-config.html`)

- **Window:** `.cz-glass`, 1140×700; rows `50px / 1fr / 40px` (titlebar / body / statusbar). macOS
  traffic-light dots are decorative.
- **YAML syntax colors:** keys `--cz-accent-bright`; strings `#5a7d3f` (a warm green — the one place
  green appears, kept for code only); numbers `--cz-tertiary`; comments `--cz-fg-faint` italic; plain
  values `--cz-fg`; punctuation `--cz-fg-subtle`. Mono font, 13px, line-height 1.78.
- **Active line:** `background: --cz-accent-soft; box-shadow: inset 2px 0 0 --cz-accent;` gutter
  number turns `--cz-accent-bright`.
- **Validation rows:** ✓ circle-check `--cz-success`; ⚠ triangle `--cz-warn`; inline `code` in
  `--cz-accent-bright` mono.
- **Status bar:** mono micro-text; "Validated · synced" with a `--cz-success` dot.
- **Accent restraint:** accent is the active line + keys; the green is scoped strictly to YAML string
  values. Don't let it leak into chrome.

## Acceptance criteria

- [ ] The four config files render as YAML with correct warm syntax highlighting + gutter.
- [ ] Editing updates live validation (✓/⚠) against the schema; a schema-invalid edit shows the
      error and **blocks Save**.
- [ ] **Save** round-trips through the validated config path; reopening the GUI reflects the change
      and vice-versa (GUI edit → reopened YAML shows it).
- [ ] Snake/camel casing maps cleanly both directions with no data loss.
- [ ] `⌘S` / `⌥⇧F` / `⌘↵` work; status bar reflects state.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

## Test plan

- `packages/shared`: round-trip property test — `config → yaml → config` is identity for valid
  configs; `validateYaml` flags known-bad inputs (missing required key, wrong type) and soft warnings
  (routine without schedule). Casing-map tests.
- `apps/desktop`: write path re-validates and refuses bad YAML; the on-disk config is never left
  partially written.
- Manual parity pass on `yaml-config.html` (syntax colors, active line, panels).

## Risks / open questions

- **CSP / editor choice** — the renderer is sandboxed with a strict CSP (`'self'`). Pick a
  highlighter/editor that needs no remote workers/eval. A controlled textarea + a token-span overlay
  is the safe default; a small lib is fine if CSP-clean.
- **Casing convention** — settle snake_case-in-YAML ↔ camelCase-in-TS once, centrally, and test it.
- **Separate window vs Settings tab** — a Settings tab is lower-cost (no new vite entry). Default to a
  tab unless a standalone window is explicitly wanted.
- **`routines.yaml` depends on Phase 5's schema** — if building Phase 6 first, ship the three
  AI-independent files (`config`/`aliases`/`workflows`) and add `routines.yaml` once `RoutineSchema`
  exists. The editor shell is schema-agnostic, so this is additive.
