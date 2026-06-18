import Store from 'electron-store';
import { type Config, defaultConfig, safeValidateConfig } from '@cockpitzero/shared';

/**
 * Persistent local config, backed by electron-store. The on-disk file lives in
 * the OS app-data dir (see CLAUDE.md): macOS ~/Library/Application Support/CockpitZero,
 * Windows %APPDATA%/CockpitZero, Linux ~/.config/CockpitZero.
 *
 * All reads/writes go through ConfigSchema so the file can never drift from the
 * shared shape — if the stored value is corrupt, we fall back to defaults.
 */
const store = new Store<{ config: Config }>({
  name: 'config',
  defaults: { config: defaultConfig() },
});

export function readConfig(): Config {
  const result = safeValidateConfig(store.get('config'));
  if (result.success) return result.data;
  const fresh = defaultConfig();
  store.set('config', fresh);
  return fresh;
}

export function writeConfig(input: unknown): Config {
  const config = safeValidateConfig(input);
  if (!config.success) {
    throw new Error(`Invalid config: ${config.error.message}`);
  }
  store.set('config', config.data);
  return config.data;
}
