import { z } from 'zod';

/**
 * Zod schemas are the single source of truth for CockpitZero's config shape.
 * All TypeScript types are inferred from these schemas (see ./types.ts) —
 * never hand-write a config type separately.
 */

/** A keystroke-friendly identifier, e.g. "gh" -> "github". */
export const AliasSchema = z.object({
  id: z.string().min(1),
  /** What the user types in the launcher. */
  keyword: z.string().min(1),
  /** Human label shown in results. */
  label: z.string().min(1),
  /** The action id this alias triggers. */
  actionId: z.string().min(1),
});

/**
 * Actions are a discriminated union on `type`. To add a new action kind,
 * add a member here, then handle it in the desktop main process and render
 * it in the launcher (see CLAUDE.md → "How to add a new action type").
 */
export const ActionSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    type: z.literal('open-url'),
    url: z.string().url(),
  }),
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    type: z.literal('open-app'),
    /** Application name or absolute path. */
    target: z.string().min(1),
  }),
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    type: z.literal('run-command'),
    command: z.string().min(1),
    args: z.array(z.string()).default([]),
  }),
  z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    type: z.literal('snippet'),
    /** Text copied to the clipboard / typed out. */
    content: z.string(),
  }),
]);

/** A workflow chains multiple actions to run in sequence. */
export const WorkflowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1).describe('Ordered list of action ids'),
});

export const SettingsSchema = z.object({
  /** Electron accelerator string, e.g. "CommandOrControl+Shift+Space". */
  hotkey: z.string().min(1).default('CommandOrControl+Shift+Space'),
  theme: z.enum(['system', 'light', 'dark']).default('system'),
  launchAtLogin: z.boolean().default(false),
  telemetryEnabled: z.boolean().default(false),
});

/** The full persisted config (what electron-store holds and /sync exchanges). */
export const ConfigSchema = z.object({
  version: z.literal(1).default(1),
  settings: SettingsSchema.default(SettingsSchema.parse({})),
  actions: z.array(ActionSchema).default([]),
  aliases: z.array(AliasSchema).default([]),
  workflows: z.array(WorkflowSchema).default([]),
});

export const ActionType = ActionSchema.options.map((o) => o.shape.type.value);
