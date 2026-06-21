import Store from 'electron-store';
import { type Config, defaultConfig, safeValidateConfig } from '@cockpitzero/shared';

/**
 * Persistent local config, backed by electron-store. The on-disk file lives in
 * the OS app-data dir (see CLAUDE.md): macOS ~/Library/Application Support/CockpitZero,
 * Windows %APPDATA%/CockpitZero, Linux ~/.config/CockpitZero.
 *
 * This is the low-level persistence adapter (infra layer). All reads/writes go
 * through ConfigSchema so the file can never drift from the shared shape — a
 * corrupt value falls back to defaults. Business rules (e.g. re-registering the
 * hotkey on change) live in the config-service, not here.
 */
const store = new Store<{ config: Config }>({
  name: 'config',
  defaults: { config: defaultConfig() },
});

/**
 * Migrates configs written before actions supported multiple parameters: a
 * legacy `action.argument` object becomes `arguments: [argument]`. Without this
 * the unknown key would be silently stripped by Zod, losing the parameter.
 */
function migrateLegacyArguments(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const config = raw as { actions?: unknown };
  if (!Array.isArray(config.actions)) return raw;
  for (const action of config.actions) {
    if (
      action &&
      typeof action === 'object' &&
      'argument' in action &&
      !('arguments' in action) &&
      action.argument !== undefined
    ) {
      (action as { arguments?: unknown[] }).arguments = [action.argument];
      delete (action as { argument?: unknown }).argument;
    }
  }
  return raw;
}

export function readConfig(): Config {
  const result = safeValidateConfig(migrateLegacyArguments(store.get('config')));
  if (result.success) return result.data;
  const fresh = defaultConfig();
  store.set('config', fresh);
  return fresh;
}

export function persistConfig(input: unknown): Config {
  const config = safeValidateConfig(input);
  if (!config.success) {
    throw new Error(`Invalid config: ${config.error.message}`);
  }
  store.set('config', config.data);
  return config.data;
}
