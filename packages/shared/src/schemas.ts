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
 * Declares one runtime parameter an action accepts (Level 2 — parameterized
 * actions). The parameter's value is substituted into `{name}` tokens in the
 * action's templated fields. An action may declare several (see `arguments` on
 * `baseActionShape`); the launcher captures them positionally. Example: an
 * `open-url` with `url: "https://github.com/{owner}/{repo}"` and
 * `arguments: [{ name: "owner" }, { name: "repo" }]` turns `gh anthropic claude`
 * into github.com/anthropic/claude.
 */
export const ArgumentSchema = z.object({
  /** Token name referenced as `{name}` in templated fields. */
  name: z.string().min(1).default('query'),
  /** Hint text shown in the launcher while capturing the argument. */
  placeholder: z.string().optional(),
  /** When true, the action only runs once a non-empty argument is given. */
  required: z.boolean().default(true),
});

/**
 * Fields shared by every action member. `arguments` is opt-in; an action without
 * it behaves exactly like a Level-1 static action. Each declared parameter is
 * captured positionally in the launcher and substituted into its `{name}` token.
 * Spread into each union member so the shape stays DRY (discriminated unions
 * can't share a base object).
 */
const baseActionShape = {
  id: z.string().min(1),
  title: z.string().min(1),
  arguments: z.array(ArgumentSchema).optional(),
} as const;

/**
 * A scheme + body URL skeleton, e.g. `https://example.com/x` or `mailto:a@b.c`.
 * Kept as a dependency-free regex so the shared package needs no DOM/Node libs.
 */
const URL_SKELETON = /^[a-z][a-z0-9+.-]*:(\/\/)?[^\s]+$/i;

/**
 * Accepts either a well-formed URL or a templated URL containing `{tokens}`.
 * Tokens are stripped before validation so a template like
 * `https://npmjs.com/package/{query}` validates as a real URL skeleton.
 */
const templatableUrl = () =>
  z.string().refine((value) => URL_SKELETON.test(value.replace(/\{[^}]+\}/g, 'x')), {
    message: 'Must be a valid URL (templates may use {tokens})',
  });

/**
 * Actions are a discriminated union on `type`. To add a new action kind,
 * add a member here, then handle it in the desktop main process and render
 * it in the launcher (see CLAUDE.md → "How to add a new action type").
 */
export const ActionSchema = z.discriminatedUnion('type', [
  z.object({
    ...baseActionShape,
    type: z.literal('open-url'),
    url: templatableUrl(),
  }),
  z.object({
    ...baseActionShape,
    type: z.literal('open-app'),
    /** Application name or absolute path. */
    target: z.string().min(1),
  }),
  z.object({
    ...baseActionShape,
    type: z.literal('run-command'),
    command: z.string().min(1),
    args: z.array(z.string()).default([]),
  }),
  z.object({
    ...baseActionShape,
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
  /** Frosted-glass translucency for the launcher + settings windows (Appearance). */
  glass: z.boolean().default(true),
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
