import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { linuxAppIcon } from '../src/main/infra/linux-app-icon.js';

/**
 * The Linux app-icon resolver, exercised against a temp-dir fixture (pure Node
 * fs — no electron, no real XDG dirs). A tiny but real PNG header keeps the
 * data-URL assertions honest.
 */

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SVG_TEXT = '<svg xmlns="http://www.w3.org/2000/svg"/>';

describe('linuxAppIcon', () => {
  let root: string;
  let appsDir: string;
  let iconsRoot: string;
  let pixmapsRoot: string;

  const desktopFile = async (id: string, lines: string[]) => {
    const path = join(appsDir, id);
    await writeFile(path, lines.join('\n'));
    return path;
  };

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'cz-linux-icon-'));
    appsDir = join(root, 'applications');
    iconsRoot = join(root, 'icons');
    pixmapsRoot = join(root, 'pixmaps');
    await mkdir(appsDir, { recursive: true });
    await mkdir(pixmapsRoot, { recursive: true });
  });

  afterEach(() => rm(root, { recursive: true, force: true }));

  it('resolves a themed name via hicolor, preferring the largest raster', async () => {
    for (const size of ['48x48', '256x256']) {
      const dir = join(iconsRoot, 'hicolor', size, 'apps');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'firefox.png'), PNG_BYTES);
    }
    const path = await desktopFile('firefox.desktop', [
      '[Desktop Entry]',
      'Name=Firefox',
      'Icon=firefox',
    ]);
    const icon = await linuxAppIcon(path, [iconsRoot, pixmapsRoot]);
    expect(icon).toMatch(/^data:image\/png;base64,/);
  });

  it('falls back to a scalable SVG as a data URL', async () => {
    const dir = join(iconsRoot, 'hicolor', 'scalable', 'apps');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'gimp.svg'), SVG_TEXT);
    const path = await desktopFile('gimp.desktop', ['[Desktop Entry]', 'Icon=gimp']);
    const icon = await linuxAppIcon(path, [iconsRoot, pixmapsRoot]);
    expect(icon).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('finds pixmaps icons and strips a spec-violating extension in Icon=', async () => {
    await writeFile(join(pixmapsRoot, 'legacy.png'), PNG_BYTES);
    const path = await desktopFile('legacy.desktop', ['[Desktop Entry]', 'Icon=legacy.png']);
    const icon = await linuxAppIcon(path, [iconsRoot, pixmapsRoot]);
    expect(icon).toMatch(/^data:image\/png;base64,/);
  });

  it('uses an absolute Icon= path directly', async () => {
    const abs = join(root, 'custom-icon.png');
    await writeFile(abs, PNG_BYTES);
    const path = await desktopFile('custom.desktop', ['[Desktop Entry]', `Icon=${abs}`]);
    const icon = await linuxAppIcon(path, []);
    expect(icon).toMatch(/^data:image\/png;base64,/);
  });

  it('returns null for a missing icon, an unresolvable name, or an unreadable file', async () => {
    const noIcon = await desktopFile('plain.desktop', ['[Desktop Entry]', 'Name=Plain']);
    expect(await linuxAppIcon(noIcon, [iconsRoot])).toBeNull();

    const unresolved = await desktopFile('ghost.desktop', ['[Desktop Entry]', 'Icon=ghost']);
    expect(await linuxAppIcon(unresolved, [iconsRoot, pixmapsRoot])).toBeNull();

    expect(await linuxAppIcon(join(appsDir, 'missing.desktop'), [iconsRoot])).toBeNull();
  });

  it('never renders an unsupported format (xpm) as an icon', async () => {
    const abs = join(root, 'old.xpm');
    await writeFile(abs, '/* XPM */');
    const path = await desktopFile('old.desktop', ['[Desktop Entry]', `Icon=${abs}`]);
    expect(await linuxAppIcon(path, [])).toBeNull();
  });
});
