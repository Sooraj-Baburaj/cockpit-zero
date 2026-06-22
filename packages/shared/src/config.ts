import { AiSettingsSchema, ConfigSchema, RoutineSchema, SettingsSchema } from './schemas.js';
import type { Config } from './types.js';

/**
 * Routines seeded into a fresh config (Phase 5) so the digest is demonstrable out
 * of the box: a scheduled `morning_digest` (fires daily at 8 AM) and an on-demand
 * `standup_prep`. Old on-disk configs (no `routines` key) parse to `[]` instead —
 * the schema default — so this only affects first launch. `RoutineSchema.parse`
 * fills the remaining defaults.
 */
function seedRoutines(): Config['routines'] {
  return [
    RoutineSchema.parse({
      id: 'morning_digest',
      label: 'Morning briefing',
      sources: ['slack', 'gmail', 'teams', 'linear', 'github', 'notion'],
      rankBy: 'importance',
      schedule: '0 8 * * *',
      trigger: 'scheduled',
      deliver: 'window',
      summarize: { modelTier: 'mini', maxItems: 8 },
    }),
    RoutineSchema.parse({
      id: 'standup_prep',
      label: 'Standup prep',
      sources: ['slack', 'linear', 'github'],
      rankBy: 'recency',
      trigger: 'on_demand',
      deliver: 'window',
      summarize: { modelTier: 'mini', maxItems: 6 },
    }),
  ];
}

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
    routines: seedRoutines(),
  };
}
