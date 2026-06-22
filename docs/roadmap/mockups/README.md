# Roadmap mockups (design reference)

These are **local, render-faithful copies** of the eight Roadmap screens from the CockpitZero
**Claude Design** project ("CockpitZero Design System", the _Sahara — warm minimalism_ language).
They exist so each phase doc in `../` is self-contained: open the HTML in a browser and you see the
exact target surface, pixel-for-pixel, without needing the design tool.

Open any file directly in a browser — they link the local `styles.css` token bundle in this folder
(`tokens/*.css`), so they render offline. Fonts (EB Garamond / Manrope) load from Google Fonts when
online and fall back to system serif/sans otherwise.

| File | Screen | Phase | Roadmap tag |
| ---- | ------ | ----- | ----------- |
| `ai-mode.html` | Launcher shifts to AI mode when nothing matches | [Phase 2](../phase-2-ai-mode-and-ask.md) | Next |
| `ai-ask.html` | Ask AI — answer + suggested actions behind the bar | [Phase 2](../phase-2-ai-mode-and-ask.md) | Next |
| `cockpit-ai.html` | Settings window "AI" tab (model / memory / tools) | [Phase 3](../phase-3-cockpit-ai-settings.md) | Next |
| `ai-workflow.html` | Describe an outcome → AI drafts an editable workflow | [Phase 4](../phase-4-ai-workflows.md) | Next |
| `routine-digest.html` | Proactive notification digest, ranked into one briefing | [Phase 5](../phase-5-routines-digest.md) | Next |
| `yaml-config.html` | Hand-edit config as YAML — tree, validation, outline | [Phase 6](../phase-6-yaml-config-editor.md) | Config |
| `ai-task.html` | Agentic task with memory + tools + streamed progress | [Phase 7](../phase-7-ai-task-memory-tools.md) | Exploring |
| _(not copied)_ `launcher-searching` | Shimmer-loader search — **already shipped** | — | Shipped |

## Source of truth

The live design project is the source of truth — these copies can drift. To re-fetch the latest:

- **Project:** `CockpitZero Design System` (`PROJECT_TYPE_DESIGN_SYSTEM`)
- **Project ID:** `d37cd0fc-1f1d-427a-9ae4-6f9916c0d2ff`
- **URL:** <https://claude.ai/design/p/d37cd0fc-1f1d-427a-9ae4-6f9916c0d2ff>
- **How:** the `DesignSync` MCP tool (`get_file` / `list_files`) or the `/design-sync` skill. The
  original screen files live under `ui_kits/<name>/index.html`; the design guide is `readme.md`
  and `SKILL.md` at the project root.

> The only edit applied when copying here: the stylesheet href was changed from `../../styles.css`
> to `styles.css` so the bundle resolves from this folder. Markup and inline styles are verbatim.

## Reading the design tokens

`tokens/` holds the full Sahara token set, mirrored from the design project:

- `colors.css` — warm-linen backdrop, burnt-sienna accent (`--cz-accent #c2652a`), warm neutrals.
- `typography.css` — EB Garamond serif headings, Manrope sans UI, mono for paths/commands.
- `spacing.css` — 4-pt grid, radii (4 / 6 / 8 / 12 / 16 + full).
- `effects.css` — ultra-soft warm shadows, soft sienna focus ring, motion durations/easing.
- `primitives.css` — `.cz-glass` / `.cz-backdrop` / `.cz-inset` / `.cz-heading` helper classes.

The shipped renderer (`apps/desktop/src/renderer/styles.css`) already uses this same `--cz-*` token
language. **When implementing, reuse the renderer's existing tokens** — do not introduce a parallel
set. If a token referenced by a mockup is missing in the renderer, add it to the renderer's
`styles.css` matching the value here.
