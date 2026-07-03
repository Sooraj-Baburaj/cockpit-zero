import { formatClockTime } from '@cockpitzero/shared';
import type {
  Action,
  ActionKind,
  LauncherItem,
  Routine,
  RoutineSourceId,
} from '@cockpitzero/shared';

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

/** Display name for a routine source (the digest row's badge + tool labels). */
export const routineSourceLabel: Record<RoutineSourceId, string> = {
  slack: 'Slack',
  gmail: 'Gmail',
  teams: 'Teams',
  linear: 'Linear',
  github: 'GitHub',
  notion: 'Notion',
};

/**
 * A human description of when a routine runs. Cron is only humanized for the
 * common "daily at HH:MM" case (the seeded schedules); anything more exotic shows
 * the raw expression rather than guessing wrong.
 */
export function describeSchedule(routine: Routine): string {
  if (routine.trigger === 'on_demand' || !routine.schedule) return 'On demand';
  const fields = routine.schedule.trim().split(/\s+/);
  if (fields.length === 5) {
    const [mi, ho, dom, mo, dow] = fields;
    const minute = Number(mi);
    const hour = Number(ho);
    if (
      Number.isInteger(minute) &&
      Number.isInteger(hour) &&
      dom === '*' &&
      mo === '*' &&
      dow === '*'
    ) {
      // Build an instant today at HH:MM purely to reuse the 12-hour formatter.
      const at = new Date();
      at.setHours(hour, minute, 0, 0);
      return `Daily at ${formatClockTime(at.getTime())}`;
    }
  }
  return `Cron · ${routine.schedule}`;
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
