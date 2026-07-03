import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { z } from 'zod';
import { ConfigSchema } from './schemas.js';
import type { Config } from './types.js';

/**
 * The YAML <-> config mapping layer (Phase 6 — the hand-edit config editor).
 *
 * "The schemas lead": this is a thin, faithful YAML view over the same Zod
 * schemas the GUI edits, so hand-edits and GUI edits are interchangeable. The
 * full `Config` is split into four logical files; every read/write round-trips
 * through `ConfigSchema`, so a bad edit can never corrupt config.
 *
 * Everything here is **pure** (no electron, no fs) so it can run renderer-side
 * for instant validation and be unit-tested without a desktop. The authoritative
 * write still goes through the existing validated `setConfig` IPC path — this
 * layer only serializes/parses/validates the slices.
 *
 * Casing: YAML is canonical **snake_case** (reads more naturally and matches the
 * mockup — `rank_by`, `max_items`), TypeScript stays camelCase. The two are
 * converted at the boundary by a generic, reversible deep key transform, so the
 * mapping is lossless for every current and future field (no per-field special
 * casing to drift).
 */

/** The four config-backed YAML files, in file-tree display order. */
export const CONFIG_YAML_FILES = [
  'config.yaml',
  'aliases.yaml',
  'workflows.yaml',
  'routines.yaml',
] as const;

export type ConfigYamlFile = (typeof CONFIG_YAML_FILES)[number];

/** Severity of a validation row. `ok` is the ✓ summary; `warn` a soft advisory. */
export type ValidationLevel = 'ok' | 'warn' | 'error';

/** One row in the live validation feed (the side panel's ✓/⚠ list). */
export interface ValidationIssue {
  level: ValidationLevel;
  /** Human message ("Schema valid · 2 routines."). */
  message: string;
  /** The offending key/entry, rendered as inline `code` (e.g. a routine id). */
  code?: string;
}

/** The result of parsing one YAML file back into a config slice. */
export type ConfigSliceResult =
  | { ok: true; slice: Partial<Config> }
  | { ok: false; issues: ValidationIssue[] };

/* ============================================================
   Casing — generic, reversible camelCase <-> snake_case (keys only)
   ============================================================ */

function mapKeysDeep(value: unknown, fn: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((v) => mapKeysDeep(v, fn));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[fn(k)] = mapKeysDeep(v, fn);
    }
    return out;
  }
  return value;
}

/** Deep-convert object keys camelCase → snake_case (values untouched). */
export function toSnakeKeysDeep(value: unknown): unknown {
  return mapKeysDeep(value, (k) => k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`));
}

/** Deep-convert object keys snake_case → camelCase (values untouched). */
export function toCamelKeysDeep(value: unknown): unknown {
  return mapKeysDeep(value, (k) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase()));
}

/* ============================================================
   Per-file schema slices (derived from ConfigSchema — never re-declared)
   ============================================================ */

/**
 * The schema for each file's content, picked straight from `ConfigSchema` so the
 * keys and validation can never drift from the source of truth. `config.yaml`
 * carries the non-collection blocks (version + settings + ai) alongside actions;
 * the other three are single collections. Together they tile the whole config
 * exactly once, which is what makes `config → yaml → config` an identity.
 */
const FILE_SCHEMA = {
  'config.yaml': ConfigSchema.pick({ version: true, settings: true, ai: true, actions: true }),
  'aliases.yaml': ConfigSchema.pick({ aliases: true }),
  'workflows.yaml': ConfigSchema.pick({ workflows: true }),
  'routines.yaml': ConfigSchema.pick({ routines: true }),
} as const satisfies Record<ConfigYamlFile, z.ZodTypeAny>;

/** A leading comment header per file (purely cosmetic; dropped on parse). */
const FILE_HEADER: Record<ConfigYamlFile, string> = {
  'config.yaml':
    '# CockpitZero — settings, AI, and actions.\n# Hand-edits round-trip through the same schema the GUI uses.\n\n',
  'aliases.yaml': '# Keyword aliases — what you type in the launcher to run an action.\n\n',
  'workflows.yaml': '# Workflows — ordered chains of actions run in sequence.\n\n',
  'routines.yaml': '# Routines — proactive jobs that run on their own.\n\n',
};

/** Pull the slice a given file owns out of a full config. */
function sliceFor(file: ConfigYamlFile, config: Config): Partial<Config> {
  switch (file) {
    case 'config.yaml':
      return {
        version: config.version,
        settings: config.settings,
        ai: config.ai,
        actions: config.actions,
      };
    case 'aliases.yaml':
      return { aliases: config.aliases };
    case 'workflows.yaml':
      return { workflows: config.workflows };
    case 'routines.yaml':
      return { routines: config.routines };
  }
}

/* ============================================================
   Serialize: config -> YAML
   ============================================================ */

/** Serialize one already-validated config slice to canonical (snake_case) YAML. */
export function serializeConfigYamlFile(file: ConfigYamlFile, slice: Partial<Config>): string {
  const body = stringifyYaml(toSnakeKeysDeep(slice), { indent: 2 });
  return FILE_HEADER[file] + body;
}

/** Serialize a full config into the four YAML files (the editor's read path). */
export function configToYamlFiles(config: Config): Record<ConfigYamlFile, string> {
  const out = {} as Record<ConfigYamlFile, string>;
  for (const file of CONFIG_YAML_FILES) {
    out[file] = serializeConfigYamlFile(file, sliceFor(file, config));
  }
  return out;
}

/* ============================================================
   Parse + validate: YAML -> config slice
   ============================================================ */

/** Trim a YAML parse error down to a single, user-facing first line. */
function yamlErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.split('\n')[0]?.trim() || 'Invalid YAML.';
}

/** Parse a YAML file's text, returning the raw (snake-keyed) value or a parse error. */
function parseFile(
  text: string,
): { ok: true; value: unknown } | { ok: false; issue: ValidationIssue } {
  try {
    return { ok: true, value: parseYaml(text) ?? {} };
  } catch (err) {
    return { ok: false, issue: { level: 'error', message: yamlErrorMessage(err) } };
  }
}

/** Map Zod issues to error rows, using the dotted path as the offending `code`. */
function zodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    level: 'error' as const,
    message: issue.message,
    code: issue.path.length > 0 ? issue.path.join('.') : undefined,
  }));
}

/**
 * Parse + validate one YAML file back into a config slice. On any parse or schema
 * failure returns the issues (so the caller can block Save); on success returns a
 * `Partial<Config>` ready to merge into the full config.
 */
export function yamlFileToConfigSlice(file: ConfigYamlFile, text: string): ConfigSliceResult {
  const parsed = parseFile(text);
  if (!parsed.ok) return { ok: false, issues: [parsed.issue] };

  const result = FILE_SCHEMA[file].safeParse(toCamelKeysDeep(parsed.value));
  if (!result.success) return { ok: false, issues: zodIssues(result.error) };

  return { ok: true, slice: result.data as Partial<Config> };
}

/** Merge a validated slice over a full config (the editor's save path helper). */
export function mergeConfigSlice(config: Config, slice: Partial<Config>): Config {
  return { ...config, ...slice };
}

/* ============================================================
   Live validation feed (the ✓/⚠ side panel)
   ============================================================ */

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** The ✓ summary line for a successfully-validated file. */
function summaryFor(file: ConfigYamlFile, slice: Partial<Config>): string {
  switch (file) {
    case 'config.yaml':
      return `Schema valid · ${plural(slice.actions?.length ?? 0, 'action')}, settings & AI.`;
    case 'aliases.yaml':
      return `Schema valid · ${plural(slice.aliases?.length ?? 0, 'alias')}.`;
    case 'workflows.yaml':
      return `Schema valid · ${plural(slice.workflows?.length ?? 0, 'workflow')}.`;
    case 'routines.yaml':
      return `Schema valid · ${plural(slice.routines?.length ?? 0, 'routine')}.`;
  }
}

/**
 * Soft, non-blocking advisories surfaced beneath the ✓ summary. These aren't
 * schema errors — they flag config that's valid but probably not what you meant
 * (mirrors the mockup's "standup_prep has no schedule — runs on demand only").
 */
function softWarnings(file: ConfigYamlFile, slice: Partial<Config>): ValidationIssue[] {
  if (file !== 'routines.yaml') return [];
  const issues: ValidationIssue[] = [];
  for (const routine of slice.routines ?? []) {
    if (!routine.schedule) {
      issues.push({
        level: 'warn',
        code: routine.id,
        message: 'has no schedule — runs on demand only.',
      });
    }
    if (routine.sources.length === 0) {
      issues.push({
        level: 'warn',
        code: routine.id,
        message: 'has no sources — the digest will be empty.',
      });
    }
  }
  return issues;
}

/**
 * The live validation feed for a file's current text: a single ✓ summary plus any
 * ⚠ advisories when valid, or the schema/parse errors when not. `pluralize`-style
 * counts mirror the mockup ("Schema valid · 2 routines.").
 */
export function validateYaml(file: ConfigYamlFile, text: string): ValidationIssue[] {
  const result = yamlFileToConfigSlice(file, text);
  if (!result.ok) return result.issues;
  return [
    { level: 'ok', message: summaryFor(file, result.slice) },
    ...softWarnings(file, result.slice),
  ];
}

/**
 * Canonicalize a file's YAML (the Format command). Parses + validates, then
 * re-serializes from the schema-validated slice; returns the text unchanged when
 * it can't be parsed (you can't format invalid YAML).
 */
export function formatConfigYaml(file: ConfigYamlFile, text: string): string {
  const result = yamlFileToConfigSlice(file, text);
  if (!result.ok) return text;
  return serializeConfigYamlFile(file, result.slice);
}
