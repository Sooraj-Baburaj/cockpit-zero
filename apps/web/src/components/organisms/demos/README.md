# Live launcher demos

Self-contained, scripted recreations of the real launcher's interactions for the marketing site.
They render live in the browser (no video), make **zero network / IPC / filesystem calls**, and
use no raster assets — backdrops are pure CSS, icons are mono glyphs. The one real cost is the
`@cockpitzero/shared` import (the `fzf` ranking): shared ships as a single flat bundle, so the
page pulls ~30 kB gz of it. If that ever matters, give `shared` a `./search` subpath export and
import that instead.

## What's real vs. scripted

- **Real:** the fuzzy ranking + highlight ranges (`fuzzyRank` / `toRanges` from
  `@cockpitzero/shared` — the exact engine the desktop launcher ships), the domain shapes (demo
  data is typed with the real `Action` / `Workflow` types), the glass styling (site launcher-bar
  tokens: `--bar-bg`, 22px blur, 18px radius, `--bar-shadow`), and the hotkey (⌘J — the product's
  `CommandOrControl+J` default).
- **Scripted:** everything else. The query types on a timer, results re-rank live per keystroke,
  and the post-Enter payoff (browser window / app window / terminal / clipboard / step checklist)
  is a mock.
- **Mirrored, not imported:** subtitle + badge rules copy the desktop renderer's `format.ts`
  (`rows.tsx` documents this) — apps can't import from each other, so keep the two in sync if the
  desktop labels ever change.

## Coverage

| Surface       | Demo                   | Payoff                                  |
| ------------- | ---------------------- | --------------------------------------- |
| `open-url`    | `OpenUrlDemo`          | Mock browser window opens the URL       |
| `open-app`    | `OpenAppDemo`          | App launch → window appears             |
| `run-command` | `RunCommandDemo`       | Terminal streams output, exits 0        |
| `snippet`     | `SnippetDemo`          | Clipboard toast → pasted into a message |
| Workflow      | `WorkflowDemo`         | Steps tick through in sequence          |
| Fuzzy search  | `SearchEverythingDemo` | Typo query (`chrme`) still finds Chrome |
| AI memory     | `MemoryDemo`           | Recall chips surface, reply streams in  |

`StepMedia` maps the shared "How it works" step order (Search → Actions → Workflows → AI
Cockpit) to OpenApp / RunCommand / Workflow / Memory — use it wherever a surface walks those
steps so home and product stay in sync.

Where they're used: the home hero band ("Why it exists") runs `SearchEverythingDemo` inside
`ExpandOnScroll` (scroll-driven grow-and-pin); the home "How it works" stepper
(`organisms/StickyFeatures.tsx`) and the `/product` feature bands both render `StepMedia` per
step (remounted — and therefore replayed — on each step change). The home "Tiny demos" carousel
(`organisms/DemoCarousel.tsx`, all five action-type demos at `size="compact"`) and the `/product`
"Live demos" gallery are currently hidden behind `{false && …}` in their pages.

Not yet covered: parameterized actions (Level 2 argument capture — `gh anthropic claude`) and
alias-keyword matching; both are pure `shared` logic (`resolveQuery`), so a future demo can drive
them the same way.

## Dropping a demo into a page

All demos are client components; import from the single entry point and render — no props
required beyond an optional `className`:

```tsx
import { RunCommandDemo } from '@/components/demos';

<RunCommandDemo className="w-full" />;
```

Shared props: `size` (`'compact' | 'default' | 'large'` — compact fits carousel cards: 2 result
rows, no footer hints, 4/5 aspect), `frameless` (skip the scene's own border/radius when a parent
card supplies the frame), `className`. `ExpandOnScroll` wraps any child in a 220vh scroll track
that pins it centered and scales it from ~62% to full size as you scroll (static full-size under
reduced motion).

Behavior every demo shares (from `useDemoPlayer`):

- Auto-plays once ~30% scrolled into view, pauses (freezes) off-screen, resumes on re-entry.
- Replayable via the ↻ chip (a full-scene button) after it finishes.
- `prefers-reduced-motion`: no timers ever run; the scene renders its static end-state.
- Fully responsive: the scene is `aspect-[4/5]` on mobile, `16/10` from `sm:` up.

## Building a new demo

Compose `LauncherScene` with your data — it handles the whole hotkey → type → rank → select →
Enter arc; you supply the payoff:

```tsx
<LauncherScene
  variant="dawn" // backdrop: 'dawn' | 'haze' | 'ion'
  label="Open URL" // mono chip naming the demo
  query="pulls" // what gets typed
  rows={ROWS} // DemoRow[] — build via rowFromAction / rowFromWorkflow / systemRow
  targetId="gh-pulls" // the row Enter runs; selection walks down to it if it ranks below #1
  playout={{ steps: 3, stepMs: 650, render: (step, done) => <YourPayoff step={step} /> }}
/>
```

Backdrops (`DemoBackdrop`) are pure-CSS wallpaper compositions in the site palette — warm
neutrals + a restrained Ion glow (orange is retired on the web surface per `DESIGN.md`), each with
a light and a dim rendition keyed off the site theme, grain overlay included (The Grain Rule).
