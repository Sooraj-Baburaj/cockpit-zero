/**
 * OS capabilities the agent tools need, expressed as injected ports (the same
 * dependency-inversion the action-runner and search providers use). The concrete
 * adapters live in `infra/agent/*` / `services/integrations` and are the only
 * `electron`/`fs`/network-touching code; tools take a port, so tool tests run
 * with a fake and never touch the disk or the network.
 */

/** Read a file's text — path-scoped, size-capped, degrades to '' on any failure. */
export interface FileReadPort {
  /** Resolve + read the file at `path` (absolute or `~`-prefixed). Returns the
   *  text (capped), or '' if it's missing / too large / unreadable. */
  read(path: string): Promise<string>;
}

/**
 * Write actions in the user's **connected** integrations (production P10). Each
 * call resolves `{ ok: false, error }` when the source isn't connected — a real
 * failure the runner surfaces, never a fake success. The runner's grant check +
 * review gate always run before these are reached.
 */
export interface IntegrationActionsPort {
  /** Post a real Slack message. `channel` is a `#name` or a channel/user id. */
  slackSend(input: {
    channel: string;
    text: string;
  }): Promise<{ ok: boolean; detail?: string; error?: string }>;
  /** Create a real event on the user's primary Google Calendar. */
  calendarCreateEvent(input: {
    title: string;
    startIso: string;
    endIso: string;
    description?: string;
  }): Promise<{ ok: boolean; detail?: string; error?: string; link?: string }>;
}

/** The OS/network-touching ports a tool registry is built over. */
export interface ToolPorts {
  files: FileReadPort;
  integrations: IntegrationActionsPort;
}
