import { readdir, readFile } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AppEntry, ScanInstalledApps } from '../services/search/provider.js';

/**
 * Discovers installed applications per-OS. Pure Node (fs/os/path) — no electron —
 * so it's cheap and directly testable; the apps-provider caches the result so the
 * scan runs rarely. macOS reads the standard Applications dirs for `.app`
 * bundles; Windows walks the Start-Menu tree for `.lnk` shortcuts; Linux parses
 * `.desktop` entries from the XDG data dirs (plus flatpak/snap exports). Missing
 * or unreadable directories are skipped silently.
 */

/** Immediate entries of a dir (with file types), or [] if it can't be read. */
async function safeReaddir(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Drop a known extension from a file name for display. */
function stripExt(name: string, ext: string): string {
  return name.toLowerCase().endsWith(ext) ? name.slice(0, -ext.length) : name;
}

async function scanMac(): Promise<AppEntry[]> {
  const roots = [
    '/Applications',
    '/Applications/Utilities',
    '/System/Applications',
    '/System/Applications/Utilities',
    join(homedir(), 'Applications'),
  ];
  const apps: AppEntry[] = [];
  const seen = new Set<string>();
  for (const root of roots) {
    for (const entry of await safeReaddir(root)) {
      if (!entry.name.endsWith('.app')) continue;
      const path = join(root, entry.name);
      if (seen.has(path)) continue;
      seen.add(path);
      apps.push({ name: stripExt(entry.name, '.app'), path });
    }
  }
  return apps;
}

/** Recurse the Start-Menu tree (bounded) collecting `.lnk` shortcuts. */
async function walkShortcuts(
  dir: string,
  depth: number,
  out: AppEntry[],
  seen: Set<string>,
): Promise<void> {
  if (depth < 0) return;
  for (const entry of await safeReaddir(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkShortcuts(path, depth - 1, out, seen);
    } else if (entry.name.toLowerCase().endsWith('.lnk')) {
      if (seen.has(path)) continue;
      seen.add(path);
      out.push({ name: stripExt(entry.name, '.lnk'), path });
    }
  }
}

async function scanWindows(): Promise<AppEntry[]> {
  const roots = [
    join(
      process.env['ProgramData'] ?? 'C:\\ProgramData',
      'Microsoft',
      'Windows',
      'Start Menu',
      'Programs',
    ),
    process.env['AppData']
      ? join(process.env['AppData'], 'Microsoft', 'Windows', 'Start Menu', 'Programs')
      : '',
  ].filter(Boolean);
  const apps: AppEntry[] = [];
  const seen = new Set<string>();
  for (const root of roots) await walkShortcuts(root, 4, apps, seen);
  return apps;
}

/** The fields of a `.desktop` file's `[Desktop Entry]` group we care about. */
export interface DesktopEntry {
  /** The unlocalized `Name=`, or null if the file doesn't declare one. */
  name: string | null;
  /** The `Icon=` value — a themed icon name or an absolute path — or null. */
  icon: string | null;
  /** False when the entry asks not to be listed (`NoDisplay`/`Hidden`) or isn't
   *  a launchable application (`Type` other than `Application`). */
  listed: boolean;
}

/**
 * Parse the `[Desktop Entry]` group of a freedesktop `.desktop` file. Localized
 * keys (`Name[de]=`) are ignored — the unlocalized `Name` is the stable one.
 * Exported for tests (the only pure part of the Linux scan).
 */
export function parseDesktopEntry(content: string): DesktopEntry {
  let inEntry = false;
  let name: string | null = null;
  let icon: string | null = null;
  let listed = true;
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    if (line.startsWith('[')) {
      // Only the [Desktop Entry] group matters; stop at the next group
      // ([Desktop Action …] etc.) once we've seen it.
      if (inEntry) break;
      inEntry = line === '[Desktop Entry]';
      continue;
    }
    if (!inEntry) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === 'Name') name = value;
    else if (key === 'Icon') icon = value;
    else if ((key === 'NoDisplay' || key === 'Hidden') && value === 'true') listed = false;
    else if (key === 'Type' && value !== 'Application') listed = false;
  }
  return { name, icon, listed };
}

/** Read + parse one `.desktop` file, or null if it can't be read. */
async function safeParseDesktopFile(path: string): Promise<DesktopEntry | null> {
  try {
    return parseDesktopEntry(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

/** XDG data dirs that can hold `.desktop` entries, user dirs first (they take
 *  precedence per the XDG spec), plus the flatpak and snap export dirs. */
function linuxAppDirs(): string[] {
  const dataHome = process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share');
  const dataDirs = (process.env['XDG_DATA_DIRS'] ?? '/usr/local/share:/usr/share')
    .split(':')
    .filter(Boolean);
  return [
    ...new Set([
      join(dataHome, 'applications'),
      join(dataHome, 'flatpak', 'exports', 'share', 'applications'),
      ...dataDirs.map((dir) => join(dir, 'applications')),
      '/var/lib/flatpak/exports/share/applications',
      '/var/lib/snapd/desktop/applications',
    ]),
  ];
}

/**
 * Scan `.desktop` entries across the given dirs. Entries are deduped by desktop
 * id (the file basename) with earlier dirs winning — so a user override in
 * `~/.local/share/applications` shadows the system entry, including a
 * `Hidden=true` override that removes an app from the list entirely.
 * `roots` is injected for tests; production passes `linuxAppDirs()`.
 */
export async function scanLinuxApps(roots: string[]): Promise<AppEntry[]> {
  const apps: AppEntry[] = [];
  const seen = new Set<string>();
  for (const root of roots) {
    for (const entry of await safeReaddir(root)) {
      if (entry.isDirectory() || !entry.name.endsWith('.desktop')) continue;
      if (seen.has(entry.name)) continue;
      const path = join(root, entry.name);
      const parsed = await safeParseDesktopFile(path);
      if (!parsed) continue;
      seen.add(entry.name);
      if (!parsed.listed) continue;
      apps.push({ name: parsed.name ?? stripExt(entry.name, '.desktop'), path });
    }
  }
  return apps;
}

/** Scan installed apps for the current platform. */
export const scanInstalledApps: ScanInstalledApps = async () => {
  switch (process.platform) {
    case 'darwin':
      return scanMac();
    case 'win32':
      return scanWindows();
    case 'linux':
      return scanLinuxApps(linuxAppDirs());
    default:
      return [];
  }
};
