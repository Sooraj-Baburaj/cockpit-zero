import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Real icon for a macOS `.app` bundle, as a PNG data URL.
 *
 * Electron's `app.getFileIcon` returns a *generic placeholder* for `.app`
 * bundles (byte-identical across different apps), so it can't be used for app
 * rows. Instead we read the bundle's own `.icns` and convert it to a PNG with
 * `sips` (always present on macOS).
 *
 * The conversion result is **persisted** to `cacheDir` (keyed by the app path,
 * invalidated when the bundle's mtime moves — i.e. the app updates), so `sips`
 * runs once per app and the icon is reused across restarts. Every external call
 * is time-boxed and any failure degrades to `null`, so the caller can fall back
 * to `getFileIcon`.
 *
 * Pure Node (child_process/fs) — no electron, so it stays cheap and isolated to
 * the infra layer alongside the other OS-shelling adapters.
 */

const TIMEOUT_MS = 1500;

/** Run a command, resolving its stdout — or null on any error/timeout. */
function run(cmd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: TIMEOUT_MS }, (err, stdout) => {
      resolve(err ? null : stdout);
    });
  });
}

/**
 * Locate the `.icns` inside an app bundle: prefer the Info.plist
 * `CFBundleIconFile` (handles binary plists via `defaults`), else fall back to
 * the first `.icns` in `Contents/Resources`.
 */
async function findIcns(appPath: string): Promise<string | null> {
  const resources = join(appPath, 'Contents', 'Resources');

  const declared = await run('defaults', [
    'read',
    join(appPath, 'Contents', 'Info'),
    'CFBundleIconFile',
  ]);
  if (declared) {
    let name = declared.trim();
    if (name && !name.toLowerCase().endsWith('.icns')) name += '.icns';
    const p = join(resources, name);
    if (existsSync(p)) return p;
  }

  try {
    const entries = await readdir(resources);
    const icns = entries.find((e) => e.toLowerCase().endsWith('.icns'));
    return icns ? join(resources, icns) : null;
  } catch {
    return null;
  }
}

/** Stable cache-file path for an app bundle (collision-resistant, readable). */
function cacheFileFor(cacheDir: string, appPath: string): string {
  const hash = createHash('sha1').update(appPath).digest('hex').slice(0, 16);
  return join(cacheDir, `${hash}.png`);
}

/** A cached icon is reusable iff it exists and is no older than the bundle. */
function isFresh(file: string, appPath: string): boolean {
  try {
    return statSync(file).mtimeMs >= statSync(appPath).mtimeMs;
  } catch {
    return false;
  }
}

async function toDataUrl(file: string): Promise<string | null> {
  try {
    const buffer = await readFile(file);
    return buffer.length ? `data:image/png;base64,${buffer.toString('base64')}` : null;
  } catch {
    return null;
  }
}

export async function macAppIcon(appPath: string, cacheDir: string): Promise<string | null> {
  const file = cacheFileFor(cacheDir, appPath);

  // Reuse a previously-converted icon unless the bundle changed (app updated).
  if (isFresh(file, appPath)) {
    const cached = await toDataUrl(file);
    if (cached) return cached;
  }

  const icns = await findIcns(appPath);
  if (!icns) return null;

  await mkdir(cacheDir, { recursive: true });
  // Write to a unique temp then rename, so a cache file is never half-written
  // (atomic even if two conversions of the same app ever race).
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  const ok = await run('sips', ['-s', 'format', 'png', '-z', '64', '64', icns, '--out', tmp]);
  if (ok === null) {
    void unlink(tmp).catch(() => {});
    return null;
  }
  try {
    await rename(tmp, file);
  } catch {
    void unlink(tmp).catch(() => {});
    return null;
  }
  return toDataUrl(file);
}
