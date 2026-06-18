import { readdir } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AppEntry, ScanInstalledApps } from '../services/search/provider.js';

/**
 * Discovers installed applications per-OS. Pure Node (fs/os/path) — no electron —
 * so it's cheap and directly testable; the apps-provider caches the result so the
 * scan runs rarely. macOS reads the standard Applications dirs for `.app`
 * bundles; Windows walks the Start-Menu tree for `.lnk` shortcuts. Missing or
 * unreadable directories are skipped silently. Linux is not supported yet.
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

/** Scan installed apps for the current platform (darwin/win32; else empty). */
export const scanInstalledApps: ScanInstalledApps = async () => {
  switch (process.platform) {
    case 'darwin':
      return scanMac();
    case 'win32':
      return scanWindows();
    default:
      return [];
  }
};
