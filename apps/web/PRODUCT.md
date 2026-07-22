# Product

## Register

brand

## Users

People who feel slowed down by their own computer — knowledge workers, creators, students, and
developers alike. The broader productivity crowd, not just terminal natives: they may know
Spotlight or Alfred by reputation, but they should never need to know what a shell command is to
understand this site. They arrive skeptical and time-poor (word of mouth, a social clip, a
recommendation), evaluate in under a minute, and decide whether to download. Their job to be done:
"make my computer feel instant without learning a whole system."

## Product Purpose

The marketing site for CockpitZero — a free, keyboard-first, cross-platform launcher (macOS /
Windows / Linux): one hotkey to search apps, files, and custom actions, chain them into workflows,
with an optional paid tier for managed AI and cross-device sync. The site's single success outcome
is **free downloads**. No account, no credit card, no trial timer — the site's job is to make
pressing "Download" feel obvious and risk-free. Pro/Team revenue comes later, in-product; the site
informs about paid tiers but never gates on them.

## Brand Personality

**Fast, dry-witted, confident.** Speed is the promise, humor is the hook, and there is zero
enterprise hedging. The voice says "Your mouse had a good run." and "esc · disappear like nothing
happened" — cheeky, but never smug, and never at the reader's expense. For the broader audience:
keep the wit, drop the jargon. Every joke must land for someone who has never opened a terminal.

## Anti-references

- **Enterprise SaaS template.** No hero-metric numbers, logo walls, "Trusted by 10,000 teams",
  or interchangeable feature grids. This is a personal tool, not a procurement pitch.
- **Hacker/terminal costume.** No green-on-black, ASCII art, or fake CLI chrome as decoration —
  it would gatekeep the exact audience this site now targets.
- **AI-gradient hype site.** No purple-pink mesh gradients, sparkle iconography, or "Supercharge
  your workflow with AI" copy. The AI Cockpit is a feature, not the identity.

## Design Principles

1. **Show the launcher, don't describe it.** The typing hero demo is the argument; live,
   product-shaped moments beat feature prose everywhere they can exist.
2. **Respect the visitor's time like the product respects keystrokes.** One dominant idea per
   fold, scannable copy, a site that loads and moves as fast as the launcher it sells.
3. **Wit for everyone, jargon for no one.** Dry humor is the brand; CLI-culture references are
   not. If a line requires technical context to land, rewrite it.
4. **Free means free.** No dark patterns, fake urgency, or account walls — honesty ("No account.
   No credit card.") is a differentiator worth designing around.
5. **One mark, everywhere.** The convergence mark on its noisy cyan-blue gradient is the single
   brand signature — carried consistently from favicon to hero to app icon, never diluted by
   competing motifs.

## Accessibility & Inclusion

WCAG 2.1 AA: body text ≥4.5:1 contrast, all interactions keyboard-reachable with visible focus
(global `:focus-visible` ring is in place), `prefers-reduced-motion` honored for every animation
(typing demo, particles, and reveals already degrade to static). Semantic landmarks and
`aria-current` navigation state are established patterns in this codebase — keep them.
