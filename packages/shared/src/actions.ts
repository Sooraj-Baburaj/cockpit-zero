import type { Action } from './types.js';

/**
 * Level-2 (parameterized actions) helpers. These are pure and dependency-free so
 * both the desktop main process (execution) and the renderer (preview UI) can
 * reuse them. The argument's value is substituted into `{name}` tokens found in
 * an action's templated fields (url / target / command / args / content).
 */

const TOKEN_RE = /\{[^}]+\}/g;

/** Which string fields of each action type may contain `{tokens}`. */
function templatedStrings(action: Action): string[] {
  switch (action.type) {
    case 'open-url':
      return [action.url];
    case 'open-app':
      return [action.target];
    case 'run-command':
      return [action.command, ...action.args];
    case 'snippet':
      return [action.content];
    default: {
      const _never: never = action;
      return _never;
    }
  }
}

/** Unique token names (`{name}` → `name`) declared across an action's fields. */
export function extractTokens(action: Action): string[] {
  const found = new Set<string>();
  for (const str of templatedStrings(action)) {
    for (const match of str.match(TOKEN_RE) ?? []) {
      found.add(match.slice(1, -1));
    }
  }
  return [...found];
}

/** True when the action expects a runtime argument (declared or via tokens). */
export function hasArgument(action: Action): boolean {
  return action.argument !== undefined || extractTokens(action).length > 0;
}

/** Replace every `{token}` in `str` with `value` (optionally URL-encoded). */
function substitute(str: string, value: string, encode: boolean): string {
  const replacement = encode ? encodeURIComponent(value) : value;
  return str.replace(TOKEN_RE, replacement);
}

/**
 * Returns a concrete action with every `{token}` replaced by `value`. URL
 * targets are URL-encoded so spaces and reserved characters are safe; other
 * fields receive the raw value. Pure — never mutates the input action.
 */
export function applyArgument(action: Action, value: string): Action {
  switch (action.type) {
    case 'open-url':
      return { ...action, url: substitute(action.url, value, true) };
    case 'open-app':
      return { ...action, target: substitute(action.target, value, false) };
    case 'run-command':
      return {
        ...action,
        command: substitute(action.command, value, false),
        args: action.args.map((arg) => substitute(arg, value, false)),
      };
    case 'snippet':
      return { ...action, content: substitute(action.content, value, false) };
    default: {
      const _never: never = action;
      return _never;
    }
  }
}
