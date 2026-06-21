import type { Action, Argument } from './types.js';

/**
 * Level-2 (parameterized actions) helpers. These are pure and dependency-free so
 * both the desktop main process (execution) and the renderer (preview UI) can
 * reuse them. Each declared parameter's value is substituted into the matching
 * `{name}` token found in an action's templated fields (url / target / command /
 * args / content). An action may declare several parameters; the launcher
 * captures them positionally (see `splitArgumentValues`).
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

/**
 * The parameters an action effectively accepts. Uses the explicitly declared
 * `arguments` when present; otherwise synthesizes one (required) parameter per
 * `{token}` found in the action's fields, in order of appearance. This is the
 * single source of "what parameters does this action have" — reuse it in
 * resolve / run / UI so the three never disagree.
 */
export function effectiveArguments(action: Action): Argument[] {
  if (action.arguments && action.arguments.length > 0) return action.arguments;
  return extractTokens(action).map((name) => ({ name, required: true }));
}

/** True when the action expects runtime arguments (declared or via tokens). */
export function hasArgument(action: Action): boolean {
  return effectiveArguments(action).length > 0;
}

/**
 * Maps positional capture `values` onto an action's declared parameters by name,
 * yielding the lookup table `applyArguments` substitutes from. Missing values
 * become empty strings.
 */
export function valuesToRecord(args: Argument[], values: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  args.forEach((arg, i) => {
    record[arg.name] = values[i] ?? '';
  });
  return record;
}

/** Replace every `{token}` in `str` with its value from `values` (optionally URL-encoded). */
function substitute(str: string, values: Record<string, string>, encode: boolean): string {
  return str.replace(TOKEN_RE, (match) => {
    const value = values[match.slice(1, -1)] ?? '';
    return encode ? encodeURIComponent(value) : value;
  });
}

/**
 * Returns a concrete action with every `{token}` replaced by its matching value
 * from `values`. URL targets are URL-encoded so spaces and reserved characters
 * are safe; other fields receive the raw value. Pure — never mutates the input.
 */
export function applyArguments(action: Action, values: Record<string, string>): Action {
  switch (action.type) {
    case 'open-url':
      return { ...action, url: substitute(action.url, values, true) };
    case 'open-app':
      return { ...action, target: substitute(action.target, values, false) };
    case 'run-command':
      return {
        ...action,
        command: substitute(action.command, values, false),
        args: action.args.map((arg) => substitute(arg, values, false)),
      };
    case 'snippet':
      return { ...action, content: substitute(action.content, values, false) };
    default: {
      const _never: never = action;
      return _never;
    }
  }
}

/**
 * Splits the raw text typed after a keyword into positional parameter values for
 * an action with `count` parameters. Words map to parameters in order; the last
 * parameter is **greedy** (absorbs the remaining text, including spaces) so a
 * final free-form value can contain spaces. `activeIndex` is the parameter the
 * caret is currently on: a word with no following space is still being typed (the
 * caret stays on it), while a trailing space advances the caret to the next one.
 */
export function splitArgumentValues(
  count: number,
  raw: string,
): { values: string[]; activeIndex: number } {
  if (count <= 0) return { values: [], activeIndex: 0 };

  const values: string[] = [];
  let rest = raw;

  for (let i = 0; i < count - 1; i++) {
    const match = rest.match(/^(\S+)\s+([\s\S]*)$/);
    if (!match) {
      // No completed word yet: this parameter is still being typed; the rest are empty.
      values.push(rest);
      while (values.length < count) values.push('');
      return { values, activeIndex: i };
    }
    const [, word = '', remainder = ''] = match;
    values.push(word);
    rest = remainder;
  }

  // The last parameter is greedy.
  values.push(rest);
  return { values, activeIndex: count - 1 };
}
