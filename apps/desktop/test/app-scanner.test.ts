import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDesktopEntry, scanLinuxApps } from '../src/main/infra/app-scanner.js';

/**
 * The Linux half of the app scanner: the pure `.desktop` parser, and the
 * directory scan exercised against a temp-dir fixture (pure Node fs — no
 * electron, no real XDG dirs).
 */

describe('parseDesktopEntry', () => {
  it('reads the unlocalized Name from the [Desktop Entry] group', () => {
    const entry = parseDesktopEntry(
      ['[Desktop Entry]', 'Type=Application', 'Name=Firefox', 'Name[de]=Feuerfuchs', ''].join('\n'),
    );
    expect(entry).toEqual({ name: 'Firefox', icon: null, listed: true });
  });

  it('reads the Icon key (themed name or absolute path)', () => {
    expect(parseDesktopEntry('[Desktop Entry]\nName=Firefox\nIcon=firefox').icon).toBe('firefox');
    expect(parseDesktopEntry('[Desktop Entry]\nIcon=/opt/app/icon.png').icon).toBe(
      '/opt/app/icon.png',
    );
  });

  it('marks NoDisplay and Hidden entries unlisted', () => {
    expect(parseDesktopEntry('[Desktop Entry]\nName=Helper\nNoDisplay=true').listed).toBe(false);
    expect(parseDesktopEntry('[Desktop Entry]\nName=Gone\nHidden=true').listed).toBe(false);
  });

  it('marks non-Application types unlisted', () => {
    expect(parseDesktopEntry('[Desktop Entry]\nName=Docs\nType=Link').listed).toBe(false);
  });

  it('ignores keys outside [Desktop Entry] (comments, actions groups)', () => {
    const entry = parseDesktopEntry(
      [
        '# a comment',
        '[Desktop Entry]',
        'Name=Terminal',
        'Type=Application',
        '[Desktop Action new-window]',
        'Name=New Window',
        'NoDisplay=true',
      ].join('\n'),
    );
    expect(entry).toEqual({ name: 'Terminal', icon: null, listed: true });
  });

  it('returns a null name when the file declares none', () => {
    expect(parseDesktopEntry('[Desktop Entry]\nType=Application').name).toBeNull();
  });
});

describe('scanLinuxApps', () => {
  let root: string;
  let userDir: string;
  let systemDir: string;

  const write = (dir: string, id: string, lines: string[]) =>
    writeFile(join(dir, id), lines.join('\n'));

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'cz-apps-'));
    userDir = join(root, 'user', 'applications');
    systemDir = join(root, 'system', 'applications');
    await mkdir(userDir, { recursive: true });
    await mkdir(systemDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('collects listed entries, falling back to the file name when Name is absent', async () => {
    await write(systemDir, 'firefox.desktop', ['[Desktop Entry]', 'Name=Firefox']);
    await write(systemDir, 'code.desktop', ['[Desktop Entry]', 'Type=Application']);
    const apps = await scanLinuxApps([userDir, systemDir]);
    expect(apps.map((a) => a.name).sort()).toEqual(['Firefox', 'code']);
    expect(apps.find((a) => a.name === 'Firefox')?.path).toBe(join(systemDir, 'firefox.desktop'));
  });

  it('skips NoDisplay entries and non-.desktop files', async () => {
    await write(systemDir, 'helper.desktop', ['[Desktop Entry]', 'Name=Helper', 'NoDisplay=true']);
    await write(systemDir, 'readme.txt', ['not a desktop file']);
    expect(await scanLinuxApps([systemDir])).toEqual([]);
  });

  it('lets an earlier (user) dir shadow a later one by desktop id', async () => {
    await write(userDir, 'app.desktop', ['[Desktop Entry]', 'Name=User Build']);
    await write(systemDir, 'app.desktop', ['[Desktop Entry]', 'Name=System Build']);
    const apps = await scanLinuxApps([userDir, systemDir]);
    expect(apps).toHaveLength(1);
    expect(apps[0]?.name).toBe('User Build');
  });

  it('lets a Hidden user override remove the system entry entirely', async () => {
    await write(userDir, 'app.desktop', ['[Desktop Entry]', 'Name=App', 'Hidden=true']);
    await write(systemDir, 'app.desktop', ['[Desktop Entry]', 'Name=App']);
    expect(await scanLinuxApps([userDir, systemDir])).toEqual([]);
  });

  it('silently skips missing directories', async () => {
    await write(systemDir, 'app.desktop', ['[Desktop Entry]', 'Name=App']);
    const apps = await scanLinuxApps([join(root, 'does-not-exist'), systemDir]);
    expect(apps.map((a) => a.name)).toEqual(['App']);
  });
});
