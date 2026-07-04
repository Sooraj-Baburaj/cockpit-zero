/**
 * The Console window nav tabs, in display order. Kept in its own module (free of
 * React / `electron`) so the ordering is a unit-testable invariant and so the
 * `INITIAL_CONSOLE_TAB` is provably a member. Only list tabs that exist in the
 * product: "Routines" arrives with Phase 5; "Scripts" is still out of scope, so
 * the mockup's full nav is intentionally not mirrored yet. "Config" is the
 * power-user YAML editor (Phase 6) — a hand-edit view over the same schemas the
 * other tabs edit via GUI.
 */
export const CONSOLE_TABS = [
  'actions',
  'ai',
  'memory',
  'workflows',
  'routines',
  'aliases',
  'config',
  'account',
  'general',
  'appearance',
] as const;

export type ConsoleTab = (typeof CONSOLE_TABS)[number];

/** The tab the window opens on — must remain a member of `CONSOLE_TABS`. */
export const INITIAL_CONSOLE_TAB: ConsoleTab = 'actions';
