/**
 * The Console window nav, grouped as in the Facet design (Commands /
 * Intelligence / Connections / Preferences). Kept in its own module (free of
 * React / `electron`) so the ordering is a unit-testable invariant and so the
 * `INITIAL_CONSOLE_TAB` is provably a member. Only list tabs that exist in the
 * product — the design's "Import & Export" is intentionally not built ("Config"
 * covers hand-editing; sync covers backup).
 */
export const CONSOLE_NAV_GROUPS = [
  { label: 'Commands', tabs: ['actions', 'workflows', 'routines', 'aliases'] },
  { label: 'Intelligence', tabs: ['ai', 'memory'] },
  { label: 'Connections', tabs: ['integrations'] },
  { label: 'Preferences', tabs: ['general', 'appearance', 'config', 'account'] },
] as const;

export type ConsoleTab = (typeof CONSOLE_NAV_GROUPS)[number]['tabs'][number];

/** Flat display order (group order, then in-group order). */
export const CONSOLE_TABS: readonly ConsoleTab[] = CONSOLE_NAV_GROUPS.flatMap((g) => [...g.tabs]);

/** The tab the window opens on — must remain a member of `CONSOLE_TABS`. */
export const INITIAL_CONSOLE_TAB: ConsoleTab = 'actions';
