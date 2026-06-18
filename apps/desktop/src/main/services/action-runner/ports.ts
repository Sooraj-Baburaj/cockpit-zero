/**
 * The capabilities an action handler needs from the outside world, expressed as
 * an interface the use-case layer owns (dependency inversion). The real
 * implementation lives in `infra/electron-ports.ts`; tests pass fakes. Keeping
 * this interface here is what lets the action runner be unit-tested without
 * importing electron.
 */
export interface ActionPorts {
  /** Open a URL in the user's default browser. */
  openExternal(url: string): Promise<void>;
  /** Open a file, folder, or application by path/name with the OS default. */
  openPath(path: string): Promise<void>;
  /** Launch a detached background process that outlives the app. */
  spawnDetached(command: string, args: string[]): void;
  /** Write text to the system clipboard. */
  writeClipboard(text: string): void;
}
