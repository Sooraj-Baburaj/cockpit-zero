---
name: CockpitZero
description: Marketing site for the keyboard-first launcher — one hotkey, everything under it.
colors:
  ion-cyan: '#00e1ff'
  ion-blue: '#0031ff'
  ion-deep: '#0000f0'
  ink: '#1a1916'
  ink-muted: '#6f6a60'
  paper: '#ffffff'
  paper-warm: '#f5f3ef'
  paper-deep: '#ece8e1'
  night: '#111110'
  night-ink: '#f6f4ef'
  night-muted: '#a8a294'
typography:
  display:
    fontFamily: 'Hanken Grotesk, system-ui, sans-serif'
    fontSize: 'clamp(2.625rem, 7.6vw, 5.375rem)'
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: '-0.032em'
  headline:
    fontFamily: 'Hanken Grotesk, system-ui, sans-serif'
    fontSize: 'clamp(1.75rem, 4.2vw, 2.75rem)'
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: '-0.02em'
  title:
    fontFamily: 'Hanken Grotesk, system-ui, sans-serif'
    fontSize: '1.375rem'
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: '-0.01em'
  body:
    fontFamily: 'Hanken Grotesk, system-ui, sans-serif'
    fontSize: 'clamp(1rem, 1.8vw, 1.1875rem)'
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: 'IBM Plex Mono, ui-monospace, monospace'
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1
    letterSpacing: '0.12em'
rounded:
  sm: '6px'
  md: '10px'
  lg: '18px'
  xl: '26px'
  pill: '999px'
spacing:
  xs: '8px'
  sm: '12px'
  md: '20px'
  lg: '34px'
  section: 'clamp(48px, 7vw, 100px)'
components:
  button-primary:
    backgroundColor: '{colors.ink}'
    textColor: '#fbfaf8'
    rounded: '{rounded.pill}'
    padding: '13px 25px'
  button-primary-hover:
    backgroundColor: '#38352d'
  button-tonal:
    backgroundColor: 'rgba(111,106,96,0.10)'
    textColor: '{colors.ink}'
    rounded: '{rounded.pill}'
    padding: '13px 24px'
  button-tonal-hover:
    backgroundColor: '{colors.paper-deep}'
  kbd-chip:
    backgroundColor: '{colors.paper-deep}'
    textColor: '{colors.ink-muted}'
    rounded: '{rounded.sm}'
    padding: '3px 8px'
  badge:
    textColor: '{colors.ink-muted}'
    rounded: '{rounded.sm}'
    padding: '4px 7px'
---

# Design System: CockpitZero

## 1. Overview

**Creative North Star: "The Convergence Point"**

Everything on this site pulls toward one point, the way the logo's eight rays pull toward their
center and the way the whole product pulls toward one hotkey. Warm, quiet, paper-like surfaces
carry generous type and dry copy — and then one electric thing happens: the Ion gradient. The
launcher bar floats, the brand tile glows cyan-to-blue, media cards hum with film grain. The
restraint of everything else exists to make that convergence moment land.

The system explicitly rejects the enterprise SaaS template (metric heroes, logo walls, feature
grids), the hacker/terminal costume (green-on-black, ASCII chrome), and the AI-gradient hype site
(purple-pink mesh, sparkle icons). It is a personal tool sold with wit, not a procurement pitch.
Motion is part of the plan, not an afterthought: the site will grow scroll-expansion, scroll
reveals, and pointer-reactive moments — surfaces are designed flat so motion can add the depth.

**Key Characteristics:**

- Warm neutral canvas (white → warm papers → near-black ink), one electric Ion accent family
- The noisy Ion gradient (`.cz-brand-grad`) is the only decorated surface — logo tile, media cards, favicon
- Hanken Grotesk speaks; IBM Plex Mono annotates (kbd hints, badges, metadata)
- Pill CTAs, 1px borders, flat surfaces; depth is reserved for motion and the floating launcher
- Dry, confident copy is a visual element — short lines, big type, room to breathe

## 2. Colors: The Ion Palette

A warm-neutral stage with one electric performer: cyan-to-blue, always with grain.

### Primary

- **Ion Cyan** (#00e1ff): The gradient's bright pole. Dark-mode accent (links, focus, caret,
  active states) where it holds 11.9:1 on Night. Never used as body text on light backgrounds.
- **Ion Blue** (#0031ff): The gradient's core and the light-mode accent — links, the demo caret,
  progress bars, pricing checks, the highlighted plan border. 7.3:1 on Paper; AA everywhere.
- **Ion Deep** (#0000f0): The gradient's dark pole. Only ever appears inside the gradient; never
  a standalone UI color.

### Neutral

- **Ink** (#1a1916): Warm near-black. Headlines, body, primary buttons in light mode.
- **Ink Muted** (#6f6a60): Secondary text on light surfaces. Passes 4.5:1 on Paper and Paper Warm.
- **Paper** (#ffffff) / **Paper Warm** (#f5f3ef) / **Paper Deep** (#ece8e1): The light-mode
  surface ladder — page, tinted panels, chips/kbd keys.
- **Night** (#111110) / **Night Ink** (#f6f4ef) / **Night Muted** (#a8a294): The dark-mode
  ladder; same warm undertone, inverted.

### Named Rules

**The Ion Rule.** The gradient `linear-gradient(160deg, #00e1ff, #0031ff 62%, #0000f0)` + the
feTurbulence grain (`.cz-brand-grad`) is the brand's entire color voice. Accents are always drawn
from its poles — Ion Blue in light mode, Ion Cyan in dark. No second hue family, ever.

**The Retired Ember Rule.** The orange accent (#d97757) is retired. Do not reintroduce it, or any
warm accent, anywhere on the web surface. Warmth lives in the neutrals and the copy, not in color.

**The Grain Rule.** The Ion gradient never appears flat. If a surface wears the gradient, it wears
the noise (`--cz-noise` overlay). A smooth cyan-blue gradient is off-brand — that's the AI-hype
look the brand explicitly rejects.

## 3. Typography

**Display/Body Font:** Hanken Grotesk (with system-ui fallback)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace fallback)

**Character:** A warm, slightly rounded grotesk doing all the talking, annotated by a matter-of-fact
mono that plays the role of the product's own UI — keyboard hints, badges, metadata. The pairing is
the product: human sentence, machine annotation.

### Hierarchy

- **Display** (500, clamp(42px, 7.6vw, 86px), 1.02, -0.032em): Hero statements only. One per page.
- **Headline** (600, clamp(28px, 4.2vw, 44px), 1.08, -0.02em): Section headings. `text-wrap: balance`.
- **Title** (600, 22–25px, 1.1–1.15, -0.01em): Card and step headings.
- **Body** (400, clamp(16px, 1.8vw, 19px), 1.55): Max measure ~58ch; muted color only when it
  still clears 4.5:1.
- **Label** (Plex Mono 500, 10–13px, 0.08–0.14em tracking, uppercase for badges): kbd chips,
  type badges, section eyebrows, footer meta.

### Named Rules

**The Two-Instrument Rule.** Hanken Grotesk carries every sentence; IBM Plex Mono carries every
annotation (hints, badges, timestamps, keys). Neither borrows the other's job. No third family.

## 4. Elevation

**Flat at rest, depth in motion.** Surfaces are flat with 1px borders (`--border`,
`--border-soft`); there are no resting card shadows. Depth is an _event_: the launcher bar floats
on its large soft shadow (`--bar-shadow`) because it is the product moment, and future motion —
scroll-driven expansion to full screen, reveals, pointer-reactive tilts — is what earns elevation.
When a card animates, it may cast; when it lands, it settles flat again.

### Shadow Vocabulary

- **Bar float** (`0 34px 74px -26px rgba(26,25,22,.34), 0 2px 10px rgba(26,25,22,.06)` /
  dark: `0 34px 74px -26px rgba(0,0,0,.62), 0 2px 10px rgba(0,0,0,.4)`): the launcher bar and any
  element in a "lifted" motion state. Nothing else.

### Named Rules

**The Only-The-Launcher-Levitates Rule.** At rest, exactly one element on any page carries a
shadow: the hero launcher bar. Everything else earns depth only while it moves.

## 5. Components

The current component set is final; new pages reuse it and add motion, not new primitives.

### Buttons

- **Shape:** Full pill (999px radius).
- **Primary:** Ink on light / Night Ink on dark (`--btn-primary-bg`), 13px × 25px padding,
  Hanken 500 at 15–16px. Hover deepens (`--btn-primary-hover`), 150ms color transition.
- **Tonal:** Translucent neutral fill (`--btn-tonal-bg`) + 1px soft border; hover fills to
  Paper Deep.
- **Focus:** Global 2px Ion accent `:focus-visible` outline, 2px offset.
- **Inverse contexts** (dark bands): white pill on dark; translucent white tonal with
  `--inverse-border`.

### Chips (kbd + badges)

- **Kbd:** Paper Deep fill, 1px soft border, 6px radius, Plex Mono 12px, muted ink.
- **Type badge:** transparent with 1px border, 6px radius, Plex Mono 10px uppercase 0.08em.
  On gradient surfaces: white text on `rgba(0,0,0,.35)` with `border-white/25`.

### Cards / Containers

- **Corner Style:** 20–26px radius (feature/plan cards), clamp(16px, 2vw, 28px) for media frames.
- **Background:** Surface white (light) / warm charcoal (dark); 1px `--border`.
- **Media cards:** the Ion gradient + grain (`.cz-brand-grad`), faint white logo watermark
  (25% opacity, ~46% height), centered label chip. Dark scrim (`rgba(0,0,0,.46)` to 58%) under
  any white text row.
- **Shadow Strategy:** none at rest (see Elevation).
- **Highlighted plan:** 1px Ion accent border via `data-accent` — never a side-stripe.

### Inputs / Fields

The site has no forms today. The launcher bar's search row is the only input-shaped element:
translucent bar surface, blurred backdrop, Ion caret (2px, 1s step blink), muted placeholder.

### Navigation

- Fixed 56px header, translucent `--nav-bg` + `backdrop-blur`, 1px soft bottom border.
- Links: Hanken 500 at 14.5px, muted → ink on hover with tonal pill; `aria-current="page"` is ink.
- Mobile (<860px): hamburger opens a full-screen sheet of 22px links + primary CTA.

### The Ion Cursor Trail (signature motion)

The home hero's pointer-reactive layer (`CursorTrail.tsx`): 28 spring-chained ribbons chase the
cursor, stroked only in the Ion band (hue oscillates 187°–239° — never a rainbow, per The Ion
Rule). Additive `lighter` glow on dark, plain low-alpha strokes on light. Pointer-events untouched
(never `preventDefault` a touch), parks itself after 3s of stillness, and disabled entirely under
`prefers-reduced-motion`. This is the template for future pointer animations: Ion-banded,
physics-driven, self-silencing.

### The Launcher Bar (signature)

The floating hero demo: 18px radius, translucent `--bar-bg` with 22px blur + saturation, 1px
`--bar-border`, Bar-float shadow, 7s idle float animation. Auto-types rotating queries with an Ion
caret; result rows highlight with the accent-soft tint. It is the product's handshake — never
redesign it casually, and keep its reduced-motion fallback (static query + visible results). Its
result area is a **fixed 72px** (one reserved row), so revealing/clearing results never resizes the
bar — a variable height there reflows the whole page.

### Layout: the hero fold

The home hero is a **full-height fold** (`min-h-svh`, content vertically centered, `pt` reserving
clearance below the 56px fixed header). `svh` — not `vh`/`dvh` — so the fold itself never reflows
when mobile browser chrome hides. On short viewports the section grows to contain its content
rather than clipping or sliding under the header.

## 6. Do's and Don'ts

### Do:

- **Do** draw every accent from the Ion poles: Ion Blue (#0031ff) on light, Ion Cyan (#00e1ff) on
  dark. Check 4.5:1 for text uses.
- **Do** put the grain on every gradient surface — `.cz-brand-grad`, never a bare CSS gradient.
- **Do** keep surfaces flat at rest and spend depth on motion (scroll expansion, reveals,
  pointer response) — with a `prefers-reduced-motion` fallback for every single animation.
- **Do** keep the mono voice for annotations only: kbd hints, badges, meta, footer small print.
- **Do** keep CTAs honest — "free forever", "no account" — and route every primary CTA to
  Download.

### Don't:

- **Don't** reintroduce the retired orange (#d97757) or any warm accent. The Retired Ember Rule
  is absolute.
- **Don't** build the "enterprise SaaS template": hero metrics, logo walls, "Trusted by 10,000
  teams", interchangeable feature grids (PRODUCT.md anti-reference, verbatim).
- **Don't** wear the "hacker/terminal costume": green-on-black, ASCII art, fake CLI chrome
  (PRODUCT.md anti-reference).
- **Don't** ship the "AI-gradient hype site": purple-pink mesh gradients, sparkle icons,
  "Supercharge your workflow with AI" copy (PRODUCT.md anti-reference). The Ion gradient stays
  grainy, branded, and singular.
- **Don't** use colored side-stripe borders, gradient text (`background-clip: text`), or resting
  card shadows.
- **Don't** animate without a reduced-motion alternative, and don't gate content visibility on a
  scroll-triggered class — reveals enhance an already-visible default.
