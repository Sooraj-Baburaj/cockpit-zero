import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, isAbsolute, join } from 'node:path';
import { parseDesktopEntry } from './app-scanner.js';

/**
 * Real app icons for Linux `.desktop` entries. `app.getFileIcon` on a
 * `.desktop` file returns the *file-type* icon (a text-file page), not the
 * application's icon — so app rows would all look like documents. Instead we
 * parse the entry's `Icon=` key and resolve it the pragmatic freedesktop way:
 * an absolute path is used as-is; a themed name is looked up in the `hicolor`
 * fallback theme (largest raster first, then scalable) and `pixmaps`. Full
 * `index.theme` inheritance is deliberately skipped — every theme is required
 * to fall back to hicolor, which is where apps install their icons.
 *
 * Pure Node (fs/os/path) — no electron — so it's directly testable; failures
 * always resolve to null and the caller falls back to `app.getFileIcon`.
 */

/** Ordered lookup dirs for a themed icon name, largest raster first. */
const HICOLOR_SIZES = ['512x512', '256x256', '192x192', '128x128', '96x96', '64x64', '48x48'];

/** Roots that can hold `icons/` trees / `pixmaps`, user dirs first (XDG). */
export function linuxIconRoots(): string[] {
  const dataHome = process.env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share');
  const dataDirs = (process.env['XDG_DATA_DIRS'] ?? '/usr/local/share:/usr/share')
    .split(':')
    .filter(Boolean);
  return [
    join(homedir(), '.icons'),
    join(dataHome, 'icons'),
    ...dataDirs.map((dir) => join(dir, 'icons')),
    '/var/lib/flatpak/exports/share/icons',
    ...dataDirs.map((dir) => join(dir, 'pixmaps')),
  ];
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** Read an icon file into a data URL, or null if unreadable/unsupported. */
async function toDataUrl(path: string): Promise<string | null> {
  const mime = MIME[extname(path).toLowerCase()];
  if (!mime) return null; // .xpm etc. — <img> can't render it
  try {
    const buf = await readFile(path);
    return buf.byteLength === 0 ? null : `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** Candidate paths for a themed icon name under one root, in preference order. */
function candidates(root: string, name: string): string[] {
  const out: string[] = [];
  if (root.endsWith('pixmaps')) {
    out.push(join(root, `${name}.png`), join(root, `${name}.svg`));
    return out;
  }
  for (const size of HICOLOR_SIZES) {
    out.push(join(root, 'hicolor', size, 'apps', `${name}.png`));
  }
  out.push(join(root, 'hicolor', 'scalable', 'apps', `${name}.svg`));
  return out;
}

/**
 * Resolve the real icon of a Linux `.desktop` entry to a data URL, or null
 * when the entry has no resolvable icon. `roots` is injected for tests;
 * production passes `linuxIconRoots()`.
 */
export async function linuxAppIcon(desktopPath: string, roots: string[]): Promise<string | null> {
  let icon: string | null;
  try {
    icon = parseDesktopEntry(await readFile(desktopPath, 'utf8')).icon;
  } catch {
    return null;
  }
  if (!icon) return null;

  // Absolute path (spec-allowed, with or without extension in themes' favour).
  if (isAbsolute(icon)) {
    return (await isFile(icon)) ? toDataUrl(icon) : null;
  }

  // Some entries write "Icon=name.png" — the theme lookup wants the bare name.
  const name = icon.replace(/\.(png|svg|xpm)$/i, '');
  for (const root of roots) {
    for (const path of candidates(root, name)) {
      if (await isFile(path)) return toDataUrl(path);
    }
  }
  return null;
}
