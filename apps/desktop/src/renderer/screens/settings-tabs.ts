/**
 * The Settings window nav tabs, in display order. Kept in its own module (free of
 * React / `electron`) so the ordering is a unit-testable invariant and so the
 * `INITIAL_SETTINGS_TAB` is provably a member. Only list tabs that exist in the
 * product: "Routines" arrives with Phase 5 and "Scripts" is out of scope, so the
 * mockup's full nav is intentionally not mirrored yet.
 */
export const SETTINGS_TABS = [
  'actions',
  'ai',
  'workflows',
  'aliases',
  'general',
  'appearance',
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

/** The tab the window opens on — must remain a member of `SETTINGS_TABS`. */
export const INITIAL_SETTINGS_TAB: SettingsTab = 'actions';
