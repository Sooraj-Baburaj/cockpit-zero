import type { Action, ActionKind } from '@cockpitzero/shared';

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
