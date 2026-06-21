import { api } from './api.js';

/** True on macOS — drives whether shortcuts render as ⌘/⌥/⌃ or Ctrl/Alt. */
export const isMac = api.platform === 'darwin';

/** The primary modifier glyph: ⌘ on macOS, "Ctrl" elsewhere. */
export const modKey = isMac ? '⌘' : 'Ctrl';

/** Per-token display for an Electron accelerator chunk, branched by OS. */
const TOKENS: Record<string, string> = {
  CommandOrControl: modKey,
  CmdOrCtrl: modKey,
  Command: isMac ? '⌘' : 'Win',
  Cmd: isMac ? '⌘' : 'Win',
  Super: isMac ? '⌘' : 'Win',
  Meta: isMac ? '⌘' : 'Win',
  Control: isMac ? '⌃' : 'Ctrl',
  Ctrl: isMac ? '⌃' : 'Ctrl',
  Alt: isMac ? '⌥' : 'Alt',
  Option: isMac ? '⌥' : 'Alt',
  Shift: isMac ? '⇧' : 'Shift',
  Space: 'Space',
  Plus: '+',
  Return: '↵',
  Enter: '↵',
  Escape: 'Esc',
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
};

/**
 * Splits an Electron accelerator ("CommandOrControl+Shift+Space") into the
 * keycap glyphs to render, branched by OS — so the same stored hotkey shows as
 * `⌘ ⇧ Space` on macOS and `Ctrl Shift Space` on Windows/Linux.
 */
export function formatAccelerator(accelerator: string): string[] {
  return accelerator
    .split('+')
    .map((token) => TOKENS[token] ?? (token.length === 1 ? token.toUpperCase() : token));
}
