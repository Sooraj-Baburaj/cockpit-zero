/**
 * The Settings window nav tabs, in display order. Kept in its own module (free of
 * React / `electron`) so the ordering is a unit-testable invariant and so the
 * `INITIAL_SETTINGS_TAB` is provably a member. Only list tabs that exist in the
 * product: "Routines" arrives with Phase 5; "Scripts" is still out of scope, so
 * the mockup's full nav is intentionally not mirrored yet. "Config" is the
 * power-user YAML editor (Phase 6) — a hand-edit view over the same schemas the
 * other tabs edit via GUI.
 */
export const SETTINGS_TABS = [
  'actions',
  'ai',
  'workflows',
  'routines',
  'aliases',
  'config',
  'general',
  'appearance',
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

/** The tab the window opens on — must remain a member of `SETTINGS_TABS`. */
export const INITIAL_SETTINGS_TAB: SettingsTab = 'actions';
