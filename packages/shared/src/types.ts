import type { z } from 'zod';
import type {
  ActionSchema,
  AliasSchema,
  ArgumentSchema,
  WorkflowSchema,
  SettingsSchema,
  ConfigSchema,
} from './schemas.js';

/** All domain types are inferred from the Zod schemas (the source of truth). */
export type Action = z.infer<typeof ActionSchema>;
export type ActionKind = Action['type'];
export type Argument = z.infer<typeof ArgumentSchema>;
export type Alias = z.infer<typeof AliasSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Config = z.infer<typeof ConfigSchema>;

/** A single result row rendered in the launcher bar. */
export interface SearchResult {
  action: Action;
  /** Relative match score; higher is better. */
  score: number;
  /** Index ranges in the matched label that should be highlighted. */
  matches: Array<[number, number]>;
  /** The label that produced the match (action title or an alias keyword). */
  label: string;
}

/**
 * The outcome of interpreting raw launcher input (see `resolveQuery`).
 * Either a ranked result list, or — when the leading token is the keyword of a
 * parameterized action — an "argument capture" state the bar renders specially.
 */
export type ResolvedQuery =
  | { kind: 'results'; results: SearchResult[] }
  | {
      kind: 'argument';
      action: Action;
      /** The matched alias keyword (rendered as a chip). */
      keyword: string;
      /** The text typed after the keyword (the live argument value). */
      argument: string;
    };
