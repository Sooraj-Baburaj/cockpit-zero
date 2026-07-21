import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { ChatStoreSchema } from '@cockpitzero/shared';
import type { ChatStore } from '@cockpitzero/shared';

/**
 * Chat-session persistence: a JSON file under `userData` (`chats.json`),
 * validated by `ChatStoreSchema` on every read. Deliberately NOT `config.json`
 * (electron-store) — transcripts are content, not settings; they'd bloat the
 * synced config. A corrupt/missing file degrades to an empty store; writes go
 * through a temp file + rename so a crash mid-write can't truncate history.
 */

export interface ChatStorePort {
  load(): ChatStore;
  save(store: ChatStore): void;
}

const emptyStore = (): ChatStore => ChatStoreSchema.parse({});

export function createChatStore(
  file = () => join(app.getPath('userData'), 'chats.json'),
): ChatStorePort {
  return {
    load() {
      try {
        const parsed = ChatStoreSchema.safeParse(JSON.parse(readFileSync(file(), 'utf8')));
        return parsed.success ? parsed.data : emptyStore();
      } catch {
        return emptyStore();
      }
    },
    save(store) {
      try {
        const path = file();
        const tmp = `${path}.tmp`;
        writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
        renameSync(tmp, path);
      } catch {
        // Best-effort: a failed save must never crash a chat turn.
      }
    },
  };
}
