import { app } from 'electron';
import { join } from 'node:path';
import { resolveIconPath } from '../infra/icon-path.js';
import { linuxAppIcon, linuxIconRoots } from '../infra/linux-app-icon.js';
import { macAppIcon } from '../infra/mac-app-icon.js';

/**
 * Native icon lookup for app/file result rows, handed to the renderer as a PNG
 * data URL.
 *
 * The incoming `target` is first resolved to a real path (`resolveIconPath`):
 * system-search paths pass through, while an `open-app` action configured with
 * a bare app name is mapped to its bundle.
 *
 * macOS `.app` bundles are a special case: `app.getFileIcon` returns a *generic
 * placeholder* for them (identical across apps), so we read the bundle's real
 * `.icns` instead (`macAppIcon`, which persists the converted PNG under
 * `userData/icon-cache`). Linux `.desktop` entries are the other special case:
 * `app.getFileIcon` yields the text-file-type icon, so the entry's `Icon=` is
 * resolved to the real app icon (`linuxAppIcon`). Everything else — files, and
 * Windows apps — uses `app.getFileIcon`, which gives the correct
 * file-type/app icon; it's also the fallback when either special case fails.
 *
 * Two cache layers: a per-session in-memory map (below) short-circuits repeat
 * lookups, and `macAppIcon`'s on-disk cache survives restarts. `null` (no icon /
 * failure) is cached in memory too, so a bad target isn't retried every render.
 */
const cache = new Map<string, string | null>();

/** Where converted `.app` icons are persisted between runs. */
const iconCacheDir = (): string => join(app.getPath('userData'), 'icon-cache');

async function extract(path: string): Promise<string | null> {
  if (process.platform === 'darwin' && path.endsWith('.app')) {
    const icon = await macAppIcon(path, iconCacheDir());
    if (icon) return icon;
    // fall through to getFileIcon (generic, but better than nothing)
  }
  if (process.platform === 'linux' && path.endsWith('.desktop')) {
    const icon = await linuxAppIcon(path, linuxIconRoots());
    if (icon) return icon;
    // fall through to getFileIcon (file-type icon, but better than nothing)
  }
  try {
    const image = await app.getFileIcon(path, { size: 'normal' });
    return image.isEmpty() ? null : image.toDataURL();
  } catch {
    return null;
  }
}

export async function getFileIcon(target: string): Promise<string | null> {
  if (typeof target !== 'string' || target === '') return null;
  const cached = cache.get(target);
  if (cached !== undefined) return cached;

  const path = resolveIconPath(target);
  const dataUrl = path ? await extract(path) : null;
  cache.set(target, dataUrl);
  return dataUrl;
}
