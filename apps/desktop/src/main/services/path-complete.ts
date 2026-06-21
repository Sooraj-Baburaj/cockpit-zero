import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, sep } from 'node:path';

/** Most suggestions returned for one partial path. */
const LIMIT = 8;

/**
 * Filesystem path autocomplete for the action form. Given a partial path the
 * user is typing (e.g. `/Applications/Vis`), lists matching entries of the
 * parent directory (`/Applications/Visual Studio Code.app`). A trailing slash
 * lists the directory's contents. `~` expands to the home dir. Directories sort
 * first and get a trailing separator so the next segment can be completed.
 *
 * Degrades to `[]` for anything that isn't a readable absolute path — autocomplete
 * is a convenience, never a hard dependency.
 */
export async function completePath(input: string): Promise<string[]> {
  if (typeof input !== 'string' || input.trim() === '') return [];

  const expanded =
    input === '~' || input.startsWith(`~${sep}`) || input.startsWith('~/')
      ? join(homedir(), input.slice(1))
      : input;

  // Only complete absolute paths — relative fragments are too ambiguous to be useful.
  if (!expanded.startsWith(sep) && !/^[A-Za-z]:[\\/]/.test(expanded)) return [];

  const endsWithSep = expanded.endsWith(sep) || expanded.endsWith('/');
  const dir = endsWithSep ? expanded : dirname(expanded);
  const fragment = endsWithSep ? '' : basename(expanded).toLowerCase();

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((e) => !e.name.startsWith('.') && e.name.toLowerCase().startsWith(fragment))
    .sort((a, b) => {
      const dirDelta = Number(b.isDirectory()) - Number(a.isDirectory());
      return dirDelta !== 0 ? dirDelta : a.name.localeCompare(b.name);
    })
    .slice(0, LIMIT)
    .map((e) => join(dir, e.name) + (e.isDirectory() && !e.name.endsWith('.app') ? sep : ''));
}
