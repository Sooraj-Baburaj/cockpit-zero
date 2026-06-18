import { execFile } from 'node:child_process';
import { basename } from 'node:path';
import type { FileEntry, SearchFiles } from '../services/search/provider.js';

/**
 * File search backed by the OS index — fast and always current without us
 * maintaining a crawler. macOS uses Spotlight (`mdfind`); Windows queries the
 * Search index (`SystemIndex`) via PowerShell/ADO. Every call is time-boxed and
 * any failure (index disabled, tool missing, timeout) degrades to `[]`, so a slow
 * index can never block the launcher. Pure Node (child_process) — no electron.
 */

const TIMEOUT_MS = 1500;
const MAX_BUFFER = 1024 * 1024;

/** Run a command and resolve to its stdout, or '' on any error/timeout. */
function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER }, (err, stdout) => {
      resolve(err ? '' : stdout);
    });
  });
}

/** Turn newline-separated absolute paths into capped, de-blanked file entries. */
function toEntries(stdout: string, limit: number): FileEntry[] {
  const out: FileEntry[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const path = line.trim();
    if (!path) continue;
    out.push({ name: basename(path), path });
    if (out.length >= limit) break;
  }
  return out;
}

/** macOS: Spotlight name search; returns absolute paths, one per line. */
async function searchMac(query: string, limit: number): Promise<FileEntry[]> {
  return toEntries(await run('mdfind', ['-name', query]), limit);
}

/** Windows: query the Search index via ADO and emit one path per line. */
async function searchWindows(query: string, limit: number): Promise<FileEntry[]> {
  // Strip chars that could break the PowerShell string, then escape SQL quotes.
  const safe = query.replace(/["`]/g, '').replace(/'/g, "''");
  const script = [
    "$ErrorActionPreference='Stop';",
    '$c=New-Object -ComObject ADODB.Connection;',
    '$r=New-Object -ComObject ADODB.Recordset;',
    '$c.Open(\'Provider=Search.CollatorDSO;Extended Properties="Application=Windows";\');',
    `$r.Open("SELECT TOP ${limit} System.ItemPathDisplay FROM SystemIndex WHERE System.FileName LIKE '%${safe}%'",$c);`,
    'while(-not $r.EOF){$r.Fields.Item("System.ItemPathDisplay").Value;$r.MoveNext()}',
    '$r.Close();$c.Close();',
  ].join(' ');
  const stdout = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  return toEntries(stdout, limit);
}

/** Search files by name for the current platform (darwin/win32; else empty). */
export const searchFiles: SearchFiles = async (query, limit) => {
  const q = query.trim();
  if (q === '' || limit <= 0) return [];
  try {
    switch (process.platform) {
      case 'darwin':
        return await searchMac(q, limit);
      case 'win32':
        return await searchWindows(q, limit);
      default:
        return [];
    }
  } catch {
    return [];
  }
};
