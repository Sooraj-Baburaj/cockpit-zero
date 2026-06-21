import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Resolve an icon-lookup target to a real filesystem path that
 * `app.getFileIcon` can read. System search already passes full paths (they pass
 * straight through), but `open-app` actions are often configured with just an
 * app *name* ("Safari", "Google Chrome") — `getFileIcon` needs an actual path,
 * so a bare name otherwise yields no icon. On macOS we map a name to its `.app`
 * bundle in the standard Applications directories. Returns null when nothing on
 * disk matches (→ the caller falls back to the kind glyph).
 *
 * Pure Node (fs/os/path), no electron — directly unit-testable.
 */

/** Standard macOS application directories, in lookup order. */
const MAC_APP_DIRS = [
  '/Applications',
  '/Applications/Utilities',
  '/System/Applications',
  '/System/Applications/Utilities',
  join(homedir(), 'Applications'),
];

// `dirs`/`platform` are injectable so the name→bundle resolution is unit-testable
// without depending on the host OS or its installed apps.
export function resolveIconPath(
  input: string,
  dirs: string[] = MAC_APP_DIRS,
  platform: NodeJS.Platform | string = process.platform,
): string | null {
  if (typeof input !== 'string' || input.trim() === '') return null;

  // An existing path (the system-search case, and fully-qualified app targets)
  // is used as-is.
  if (existsSync(input)) return input;

  // Otherwise treat it as an app name and look for "<name>.app" (macOS only;
  // other platforms have no equivalent name→path convention here).
  if (platform !== 'darwin') return null;
  const base = input.replace(/\.app$/i, '');
  for (const dir of dirs) {
    const candidate = join(dir, `${base}.app`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
