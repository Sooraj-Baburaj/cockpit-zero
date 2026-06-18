import type { z } from 'zod';
import type {
  ActionSchema,
  AliasSchema,
  WorkflowSchema,
  SettingsSchema,
  ConfigSchema,
} from './schemas.js';

/** All domain types are inferred from the Zod schemas (the source of truth). */
export type Action = z.infer<typeof ActionSchema>;
export type ActionKind = Action['type'];
export type Alias = z.infer<typeof AliasSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Config = z.infer<typeof ConfigSchema>;

/** A single result row rendered in the launcher bar. */
export interface SearchResult {
  action: Action;
  /** Match score in [0,1]; higher is better. */
  score: number;
  /** Index ranges in the title that matched the query. */
  matches: Array<[number, number]>;
}
