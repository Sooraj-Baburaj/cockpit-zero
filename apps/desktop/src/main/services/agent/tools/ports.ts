/**
 * OS capabilities the agent tools need, expressed as injected ports (the same
 * dependency-inversion the action-runner and search providers use). The concrete
 * adapters live in `infra/agent/*` and are the only `electron`/`fs`-touching code;
 * tools take a port, so tool tests run with a fake and never touch the disk.
 */

/** Read a file's text — path-scoped, size-capped, degrades to '' on any failure. */
export interface FileReadPort {
  /** Resolve + read the file at `path` (absolute or `~`-prefixed). Returns the
   *  text (capped), or '' if it's missing / too large / unreadable. */
  read(path: string): Promise<string>;
}

/** The OS-touching ports a tool registry is built over. */
export interface ToolPorts {
  files: FileReadPort;
}
