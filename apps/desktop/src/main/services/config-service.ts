import type { Config } from '@cockpitzero/shared';
import { persistConfig, readConfig } from '../infra/store.js';
import { registerHotkey } from '../app/hotkey.js';
import { applyConsoleAppearance } from '../windows/index.js';

/**
 * Config use-cases. Wraps the persistence adapter with business rules — notably
 * re-registering the global hotkey and updating window frosted-glass when they
 * change, so settings edits take effect immediately without a restart.
 */

export function getConfig(): Config {
  return readConfig();
}

export function updateConfig(input: unknown): Config {
  const previous = readConfig();
  const next = persistConfig(input);
  if (next.settings.hotkey !== previous.settings.hotkey) {
    registerHotkey(next.settings.hotkey);
  }
  if (next.settings.glass !== previous.settings.glass) {
    applyConsoleAppearance(next.settings.glass);
  }
  return next;
}
