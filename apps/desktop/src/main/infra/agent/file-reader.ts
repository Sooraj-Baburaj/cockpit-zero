import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, normalize } from 'node:path';
import type { FileReadPort } from '../../services/agent/tools/ports.js';

/**
 * The real `FileReadPort` (Phase 7) — the only disk-touching code behind the
 * `files.read` tool. Read-only, size-capped, and time-boxed; any failure
 * (missing, too large, unreadable, timeout) degrades to '' so a bad path can
 * never sink a run. Pure Node (`fs`) — no `electron`.
 */

/** Cap how much text we hand back (256 KB) — enough to summarize, bounded memory. */
const MAX_BYTES = 256 * 1024;
const TIMEOUT_MS = 1500;

/** Expand a leading `~` to the home dir and normalize; absolute paths pass through. */
function resolvePath(input: string): string {
  const p = input.trim();
  if (p === '~' || p.startsWith('~/')) return normalize(join(homedir(), p.slice(1)));
  return normalize(p);
}

export const fileReader: FileReadPort = {
  async read(input) {
    const path = resolvePath(input);
    // Only ever read an absolute path (after ~-expansion) — never a relative one,
    // which would resolve against the process cwd unpredictably.
    if (!isAbsolute(path)) return '';
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
      try {
        const buf = await readFile(path, { signal: ac.signal });
        return buf.subarray(0, MAX_BYTES).toString('utf8');
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return '';
    }
  },
};
