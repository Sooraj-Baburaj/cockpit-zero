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

/**
 * A single row in the launcher — generalized beyond config actions so the bar
 * can also surface installed applications and files (system search, Level 4). A
 * discriminated union on `kind`; `id` is stable per result and `matches` are
 * highlight ranges over `title`.
 */
export type LauncherItemKind = 'action' | 'workflow' | 'app' | 'file';

interface LauncherItemBase {
  /** Stable id: action/workflow id, or absolute path for app/file. */
  id: string;
  /** Primary display text. */
  title: string;
  /** Secondary line (e.g. an app/file's path). */
  subtitle?: string;
  /** Relative match score; higher is better. */
  score: number;
  /** Index ranges in `title` that should be highlighted. */
  matches: Array<[number, number]>;
}

/** A configured action (Level 1/2). */
export interface ActionItem extends LauncherItemBase {
  kind: 'action';
  action: Action;
}
/** A configured workflow (Level 3). */
export interface WorkflowItem extends LauncherItemBase {
  kind: 'workflow';
  workflow: Workflow;
}
/** An installed application discovered by system search (Level 4). */
export interface AppItem extends LauncherItemBase {
  kind: 'app';
  /** Absolute path to the .app bundle / .lnk / executable. */
  path: string;
}
/** A file discovered by system search (Level 4). */
export interface FileItem extends LauncherItemBase {
  kind: 'file';
  /** Absolute path to the file. */
  path: string;
}

/** Any launcher result row. Run it by switching on `kind` (see LauncherBar). */
export type LauncherItem = ActionItem | WorkflowItem | AppItem | FileItem;

/**
 * The outcome of interpreting raw launcher input (see `resolveQuery`).
 * Either a ranked result list, or — when the leading token is the keyword of a
 * parameterized action — an "argument capture" state the bar renders specially.
 */
export type ResolvedQuery =
  | { kind: 'results'; results: LauncherItem[] }
  | {
      kind: 'argument';
      action: Action;
      /** The matched alias keyword (rendered as a chip). */
      keyword: string;
      /** Live values for the action's parameters, in declaration order. */
      values: string[];
      /** Index of the parameter currently being typed (for caret/highlight). */
      activeIndex: number;
    };
