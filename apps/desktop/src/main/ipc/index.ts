import { ipcMain } from 'electron';
import { AI_STREAM_CHANNEL, IpcChannels, createId } from '@cockpitzero/shared';
import type {
  AiAnswer,
  AiStreamEvent,
  IntegrationSourceId,
  PasswordCredentials,
  SignInMethod,
} from '@cockpitzero/shared';
import { getConfig, updateConfig } from '../services/config-service.js';
import { resolveLauncherQuery, searchSystem } from '../services/search-service.js';
import { openPathById, runActionById, runWorkflowById } from '../services/launcher-exec.js';
import { getFileIcon } from '../services/icon-service.js';
import { getFavicon } from '../services/favicon-service.js';
import { completePath } from '../services/path-complete.js';
import { aiService, chatService, fetchAiUsage } from '../services/ai/index.js';
import { getDigest, listRoutines, runRoutine } from '../services/routines/index.js';
import { approveTask, getTask, startTask, stopTask } from '../services/agent/index.js';
import { integrationService } from '../services/integrations/index.js';
import { memoryService } from '../services/memory/index.js';
import { secretsService } from '../services/secrets/index.js';
import { authService } from '../services/auth/index.js';
import { memorySyncService, syncService } from '../services/sync/index.js';
import { knowledgeService } from '../services/knowledge/index.js';
import { hotkeyStatus, isHotkeyAvailable } from '../app/hotkey.js';
import { hideLauncher, openAiChatWindow, openConsole } from '../windows/index.js';

/** In-flight AI streams, keyed by `streamId`, so `cancelAiStream` can abort the
 *  provider request (Escape / closing the bar). Cleared when the stream settles. */
const aiStreams = new Map<string, AbortController>();

/**
 * Run a streamed answer and push its `AiStreamEvent`s back to the asking window
 * over AI_STREAM_CHANNEL — the shared plumbing behind `askAIStream` and
 * `chatAsk`. Token deltas are coalesced on a ~30ms timer so the bridge sees a
 * handful of messages instead of one per token (phase-4 backpressure note); the
 * stream is registered in `aiStreams` so `cancelAiStream` can abort it.
 */
function streamToSender(
  sender: Electron.WebContents,
  run: (onDelta: (text: string) => void, signal: AbortSignal) => Promise<AiAnswer>,
): { streamId: string } {
  const streamId = createId('aistream');
  const controller = new AbortController();
  aiStreams.set(streamId, controller);

  const send = (e: AiStreamEvent) => {
    if (!sender.isDestroyed()) sender.send(AI_STREAM_CHANNEL, e);
  };

  let buffer = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (buffer) {
      send({ streamId, type: 'delta', text: buffer });
      buffer = '';
    }
  };
  const dropBuffered = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    buffer = '';
  };
  const onDelta = (text: string) => {
    buffer += text;
    if (!timer) timer = setTimeout(flush, 30);
  };

  void run(onDelta, controller.signal)
    .then((answer) => {
      flush();
      send({ streamId, type: 'done', answer });
    })
    .catch((err: unknown) => {
      // A user-initiated cancel aborts the request — stop silently (the renderer
      // already moved on, and dropped any buffered delta). Only a genuine failure
      // surfaces an error event.
      dropBuffered();
      if (controller.signal.aborted) return;
      send({
        streamId,
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    })
    .finally(() => aiStreams.delete(streamId));

  return { streamId };
}

/**
 * Registers every IPC handler. Each handler maps 1:1 to an IpcChannels constant
 * and to a method on the preload bridge (src/preload/index.ts). This layer is
 * thin: it validates/serializes and delegates to services. Add new channels in
 * packages/shared first, then wire them here and in preload.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.getConfig, () => getConfig());

  ipcMain.handle(IpcChannels.setConfig, (_e, config: unknown) => updateConfig(config));

  ipcMain.handle(IpcChannels.resolveQuery, (_e, input: string) => resolveLauncherQuery(input));

  ipcMain.handle(IpcChannels.searchSystem, (_e, input: string) => searchSystem(input));

  // Execution by id is shared with the agent tools (`services/launcher-exec.ts`)
  // so the user's Enter and the model's `actions.run` walk the same path.
  ipcMain.handle(IpcChannels.runAction, (_e, actionId: string, values?: string[]) =>
    runActionById(actionId, values),
  );

  ipcMain.handle(IpcChannels.runWorkflow, (_e, workflowId: string) =>
    runWorkflowById(workflowId),
  );

  ipcMain.handle(IpcChannels.openPath, (_e, path: string) => openPathById(path));

  ipcMain.handle(IpcChannels.getFileIcon, (_e, path: string) => getFileIcon(path));

  ipcMain.handle(IpcChannels.getFavicon, (_e, url: string) => getFavicon(url));

  ipcMain.handle(IpcChannels.completePath, (_e, input: string) => completePath(input));

  ipcMain.handle(IpcChannels.checkHotkey, (_e, accelerator: string) =>
    isHotkeyAvailable(accelerator),
  );

  ipcMain.handle(IpcChannels.hotkeyStatus, () => hotkeyStatus());

  // AI foundation (Phase 1). The service selects the provider from config and
  // short-circuits when AI is disabled. `askAI` is the resolve-once path; the
  // streamed path is `askAIStream` below.
  ipcMain.handle(IpcChannels.askAI, (_e, prompt: string) => aiService.ask(prompt));

  // Streamed ask (production phase 4). Returns a `streamId` immediately, then pushes
  // `AiStreamEvent`s back to the asking window over AI_STREAM_CHANNEL: token `delta`s
  // (coalesced ~30ms to spare the bridge), then a final `done` with the full answer.
  ipcMain.handle(IpcChannels.askAIStream, (event, prompt: string) =>
    streamToSender(event.sender, (onDelta, signal) =>
      aiService.askStream(prompt, onDelta, signal),
    ),
  );

  ipcMain.handle(IpcChannels.cancelAiStream, (_e, streamId: string) => {
    aiStreams.get(streamId)?.abort();
    aiStreams.delete(streamId);
  });

  ipcMain.handle(IpcChannels.draftWorkflow, (_e, description: string) =>
    aiService.draftWorkflow(description),
  );

  ipcMain.handle(IpcChannels.aiStatus, () => aiService.status());

  // Managed-inference usage meter (P9) — the Console's "AI usage this period"
  // readout. Gated server-side; signed-out resolves `{ ok: false, error }`.
  ipcMain.handle(IpcChannels.aiUsage, () => fetchAiUsage());

  // Routines (Phase 5; real sources since P10). `runRoutine` fans out to the
  // connected integration sources, summarizes +
  // ranks via the AI service, stores the digest, and opens the briefing window;
  // `getDigest` returns the last-computed digest for the briefing surface.
  ipcMain.handle(IpcChannels.runRoutine, (_e, routineId: string) => runRoutine(routineId));

  ipcMain.handle(IpcChannels.getDigest, (_e, routineId: string) => getDigest(routineId));

  ipcMain.handle(IpcChannels.listRoutines, () => listRoutines());

  // AI task / agent layer (Phase 7). `taskRun` starts the agent loop and opens
  // the task window; progress streams to it over the `task:update` push channel.
  // `taskStop`/`taskApprove` drive the human-in-the-loop (halt / approve a review).
  ipcMain.handle(IpcChannels.taskRun, (_e, intent: string) => startTask(intent));

  ipcMain.handle(IpcChannels.taskGet, (_e, taskId: string) => getTask(taskId));

  ipcMain.handle(IpcChannels.taskStop, (_e, taskId: string) => stopTask(taskId));

  ipcMain.handle(IpcChannels.taskApprove, (_e, taskId: string) => approveTask(taskId));

  // AI chat window. Session CRUD is plain request/response; `chatAsk` streams the
  // reply over the same AI_STREAM_CHANNEL as the bar (the chat service persists
  // both turns in the main process, so a closed window never loses an exchange).
  ipcMain.handle(IpcChannels.chatList, () => chatService.list());

  ipcMain.handle(IpcChannels.chatGet, (_e, sessionId: string) => chatService.get(sessionId));

  ipcMain.handle(IpcChannels.chatCreate, () => chatService.create());

  ipcMain.handle(IpcChannels.chatDelete, (_e, sessionId: string) =>
    chatService.remove(sessionId),
  );

  ipcMain.handle(IpcChannels.chatAsk, (event, sessionId: string, text: string) => {
    // Reject a bad turn up front (unknown session / blank text) so the renderer
    // gets `{ error }` instead of a stream that instantly errors.
    if (text.trim() === '') return { error: 'Nothing to send.' };
    if (!chatService.get(sessionId)) return { error: 'This chat no longer exists.' };
    return streamToSender(event.sender, (onDelta, signal) =>
      chatService
        .ask(sessionId, text, onDelta, signal)
        .then((reply): AiAnswer => ({ text: reply.text, meta: '', suggestions: [] })),
    );
  });

  // Local memory engine (production phase 5). The read/manage controls for the
  // Console memory view — `recall`/`write` stay internal to the agent/ask path
  // (called server-side), so only stats/search/forget/clear cross the bridge.
  ipcMain.handle(IpcChannels.memoryStats, () => memoryService.stats());

  ipcMain.handle(IpcChannels.memorySearch, (_e, query: string) => memoryService.search(query));

  ipcMain.handle(IpcChannels.memoryForget, (_e, id: string) => memoryService.forget(id));

  ipcMain.handle(IpcChannels.memoryClear, () => memoryService.clear());

  // Cloud memory + knowledge (production P8) — opt-in, signed-in only. The
  // services gate themselves (vault token + `ai.memorySync`), so these handlers
  // stay thin; a signed-out call resolves `{ ok: false, error }`.
  ipcMain.handle(IpcChannels.memorySyncNow, () => memorySyncService.syncNow());

  ipcMain.handle(IpcChannels.knowledgeIngest, (_e, paths: string[]) =>
    knowledgeService.ingest(Array.isArray(paths) ? paths : []),
  );

  ipcMain.handle(IpcChannels.knowledgeList, () => knowledgeService.list());

  ipcMain.handle(IpcChannels.knowledgeRemove, (_e, docId: string) =>
    knowledgeService.remove(docId),
  );

  // Secrets vault (production Phase 2). The OS-keychain-backed vault for BYOP keys
  // (P3), the session token (P7), and OAuth tokens (P10). Deliberately NO
  // `getSecret` handler — plaintext never crosses the bridge; in-process callers
  // use `secretsService.get` directly.
  ipcMain.handle(IpcChannels.setSecret, (_e, name: string, value: string) =>
    secretsService.set(name, value),
  );

  ipcMain.handle(IpcChannels.clearSecret, (_e, name: string) => secretsService.delete(name));

  ipcMain.handle(IpcChannels.secretStatus, () => secretsService.status());

  ipcMain.handle(IpcChannels.secretsAvailable, () => secretsService.isAvailable());

  // Integrations (production P10). Connect runs OAuth (system browser + loopback)
  // or validates a pasted token; either way the credential lands in the vault in
  // the main process — it never crosses back over the bridge. Status is
  // metadata-only (connected/account/scopes), never tokens.
  ipcMain.handle(IpcChannels.connectSource, (_e, source: IntegrationSourceId, token?: string) =>
    integrationService.connect(source, token),
  );

  ipcMain.handle(IpcChannels.disconnectSource, (_e, source: IntegrationSourceId) =>
    integrationService.disconnect(source),
  );

  ipcMain.handle(IpcChannels.connectionStatus, () => integrationService.status());

  // Backend account + sync (production P7). Sign-in stores the session token in
  // the vault inside the main process — the token itself never crosses the
  // bridge; the renderer only ever sees ok/error and the AccountStatus shape.
  ipcMain.handle(
    IpcChannels.signIn,
    (_e, method: SignInMethod, credentials?: PasswordCredentials) =>
      authService.signIn(method, credentials),
  );

  ipcMain.handle(IpcChannels.signOut, () => authService.signOut());

  ipcMain.handle(IpcChannels.authStatus, () => authService.status());

  ipcMain.handle(IpcChannels.syncPush, () => syncService.push());

  ipcMain.handle(IpcChannels.syncPull, () => syncService.pull());

  ipcMain.handle(IpcChannels.openConsole, () => {
    openConsole();
  });

  ipcMain.handle(IpcChannels.openAiChat, () => {
    openAiChatWindow();
  });

  ipcMain.handle(IpcChannels.hideLauncher, () => {
    hideLauncher();
  });
}
