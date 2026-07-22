import type { Action, Workflow } from '@cockpitzero/shared';

/**
 * One row in a demo launcher list. Rows are derived from *real* shared domain
 * types (`Action` / `Workflow`) so demo data can't drift from the product's
 * schema; subtitle + badge rules mirror the desktop renderer's `format.ts`
 * (`actionSubtitle` / `itemBadge`), which lives app-side and can't be imported
 * here (apps never import from each other).
 */
export interface DemoRow {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  /** Mono glyph rendered in the icon tile — the site's established icon style. */
  icon: string;
}

/** Mirrors the desktop renderer's `actionTypeLabel`. */
const ACTION_BADGE: Record<Action['type'], string> = {
  'open-url': 'URL',
  'open-app': 'App',
  'run-command': 'Command',
  snippet: 'Snippet',
};

/** Mirrors the desktop renderer's `actionSubtitle`. */
function actionSubtitle(action: Action): string {
  switch (action.type) {
    case 'open-url':
      return action.url;
    case 'open-app':
      return action.target;
    case 'run-command':
      return [action.command, ...action.args].join(' ');
    case 'snippet':
      return action.content;
  }
}

export function rowFromAction(action: Action, icon: string): DemoRow {
  return {
    id: action.id,
    title: action.title,
    subtitle: actionSubtitle(action),
    badge: ACTION_BADGE[action.type],
    icon,
  };
}

export function rowFromWorkflow(workflow: Workflow, icon: string): DemoRow {
  const n = workflow.steps.length;
  return {
    id: workflow.id,
    title: workflow.name,
    subtitle: `${n} step${n === 1 ? '' : 's'}`,
    badge: 'Workflow',
    icon,
  };
}

/** A system-search result (installed app / file), as merged in by the desktop. */
export function systemRow(
  id: string,
  title: string,
  subtitle: string,
  kind: 'App' | 'File',
  icon: string,
): DemoRow {
  return { id, title, subtitle, badge: kind, icon };
}
