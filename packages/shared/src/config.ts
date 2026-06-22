import { AiSettingsSchema, ConfigSchema, SettingsSchema } from './schemas.js';
import type { Config } from './types.js';

/** Parse + validate an unknown value into a Config (throws on invalid). */
export function validateConfig(input: unknown): Config {
  return ConfigSchema.parse(input);
}

/** Non-throwing variant; returns a discriminated result. */
export function safeValidateConfig(input: unknown) {
  return ConfigSchema.safeParse(input);
}

/** A fresh, valid default config — used on first launch. */
export function defaultConfig(): Config {
  return {
    version: 1,
    settings: SettingsSchema.parse({}),
    actions: [],
    aliases: [],
    workflows: [],
    ai: AiSettingsSchema.parse({}),
  };
}
