import type { Action, ActionKind, LauncherItem } from '@cockpitzero/shared';

/** Short, human label for each action kind (shown in badges). */
export const actionTypeLabel: Record<ActionKind, string> = {
  'open-url': 'URL',
  'open-app': 'App',
  'run-command': 'Command',
  snippet: 'Snippet',
};

/** A secondary line describing what an action does (its target/template). */
export function actionSubtitle(action: Action): string {
  switch (action.type) {
    case 'open-url':
      return action.url;
    case 'open-app':
      return action.target;
    case 'run-command':
      return [action.command, ...action.args].join(' ');
    case 'snippet':
      return action.content;
    default: {
      const _never: never = action;
      return _never;
    }
  }
}

/** The secondary line for any launcher result row (action / workflow / app / file). */
export function itemSubtitle(item: LauncherItem): string {
  switch (item.kind) {
    case 'action':
      return actionSubtitle(item.action);
    case 'workflow': {
      const n = item.workflow.steps.length;
      return `${n} step${n === 1 ? '' : 's'}`;
    }
    case 'app':
      return item.subtitle ?? 'Application';
    case 'file':
      return item.subtitle ?? item.path;
    default: {
      const _never: never = item;
      return _never;
    }
  }
}

/** Short uppercase badge label for any launcher result row. */
export function itemBadge(item: LauncherItem): string {
  switch (item.kind) {
    case 'action':
      return actionTypeLabel[item.action.type];
    case 'workflow':
      return 'Workflow';
    case 'app':
      return 'App';
    case 'file':
      return 'File';
    default: {
      const _never: never = item;
      return _never;
    }
  }
}
