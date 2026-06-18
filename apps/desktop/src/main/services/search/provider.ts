import type { LauncherItem } from '@cockpitzero/shared';

/**
 * Ports + contracts for system search. Following the same dependency-inversion as
 * the action-runner: the service layer *defines* these ports, the `infra/`
 * adapters *implement* them (scanning the FS / shelling out to the OS index), and
 * the providers depend only on the injected functions — so provider logic is
 * unit-testable with fakes, no FS or child_process required.
 */

/** A raw installed-application entry produced by an OS scan. */
export interface AppEntry {
  /** Display name (no `.app` / `.lnk` extension). */
  name: string;
  /** Absolute path to launch — a `.app` bundle, `.lnk` shortcut, or executable. */
  path: string;
}

/** A raw file entry produced by the OS search index. */
export interface FileEntry {
  /** File name (basename). */
  name: string;
  /** Absolute path to the file. */
  path: string;
}

/** Lists installed applications. Implemented per-OS in `infra/app-scanner.ts`. */
export type ScanInstalledApps = () => Promise<AppEntry[]>;

/** Searches files by name. Implemented per-OS in `infra/file-search.ts`. */
export type SearchFiles = (query: string, limit: number) => Promise<FileEntry[]>;

/**
 * A source of launcher results for a query. Configured actions/workflows are one
 * source (the pure shared resolver); installed apps and files are others. Each
 * provider returns already-scored, already-capped items; the aggregator merges
 * them into the final list (see `aggregate.ts`).
 */
export interface SearchProvider {
  /** Stable id used for ordering/diagnostics (e.g. "apps", "files"). */
  id: string;
  search(query: string, limit: number): Promise<LauncherItem[]>;
}
