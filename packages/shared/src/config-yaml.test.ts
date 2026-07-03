import { describe, it, expect } from 'vitest';
import {
  CONFIG_YAML_FILES,
  configToYamlFiles,
  formatConfigYaml,
  mergeConfigSlice,
  toCamelKeysDeep,
  toSnakeKeysDeep,
  validateYaml,
  yamlFileToConfigSlice,
  type ConfigYamlFile,
} from './config-yaml.js';
import { defaultConfig } from './config.js';
import { ConfigSchema } from './schemas.js';
import type { Config } from './types.js';

/** Reconstruct a full config from its four serialized YAML files. */
function roundTrip(config: Config): Config {
  const files = configToYamlFiles(config);
  let merged: Partial<Config> = {};
  for (const file of CONFIG_YAML_FILES) {
    const result = yamlFileToConfigSlice(file, files[file]);
    if (!result.ok) throw new Error(`${file} failed to parse: ${JSON.stringify(result.issues)}`);
    merged = { ...merged, ...result.slice };
  }
  return ConfigSchema.parse(merged);
}

/** A richer-than-default config exercising every slice + casing-sensitive field. */
function richConfig(): Config {
  return ConfigSchema.parse({
    version: 1,
    settings: { hotkey: 'CommandOrControl+Space', theme: 'dark', launchAtLogin: true },
    actions: [
      { id: 'a1', title: 'Open repo', type: 'open-url', url: 'https://github.com/{owner}/{repo}' },
      { id: 'a2', title: 'Run build', type: 'run-command', command: 'pnpm', args: ['build'] },
      { id: 'a3', title: 'Greeting', type: 'snippet', content: 'hi there' },
    ],
    aliases: [{ id: 'al1', keyword: 'gh', label: 'GitHub', actionId: 'a1' }],
    workflows: [{ id: 'w1', name: 'Morning', steps: ['a1', 'a2'] }],
    ai: { provider: 'mock', modelTier: 'pro', askFromBar: false, memoryEnabled: false },
    routines: [
      {
        id: 'morning_digest',
        label: 'Morning briefing',
        sources: ['slack', 'gmail'],
        rankBy: 'importance',
        schedule: '0 8 * * 1-5',
        trigger: 'scheduled',
        deliver: 'window',
        summarize: { modelTier: 'mini', maxItems: 8 },
      },
      { id: 'standup_prep', label: 'Standup prep', trigger: 'on_demand' },
    ],
  });
}

describe('config <-> yaml round-trip', () => {
  it('config → yaml → config is identity for the default config', () => {
    const config = defaultConfig();
    expect(roundTrip(config)).toEqual(config);
  });

  it('config → yaml → config is identity for a rich config', () => {
    const config = richConfig();
    expect(roundTrip(config)).toEqual(config);
  });

  it('serializes exactly the four config files', () => {
    expect(Object.keys(configToYamlFiles(defaultConfig())).sort()).toEqual(
      [...CONFIG_YAML_FILES].sort(),
    );
  });
});

describe('snake/camel casing maps', () => {
  it('YAML is snake_case while the schema stays camelCase', () => {
    const yaml = configToYamlFiles(richConfig());
    expect(yaml['routines.yaml']).toContain('rank_by:');
    expect(yaml['routines.yaml']).toContain('max_items:');
    expect(yaml['routines.yaml']).toContain('model_tier:');
    expect(yaml['aliases.yaml']).toContain('action_id:');
    expect(yaml['config.yaml']).toContain('launch_at_login:');
    expect(yaml['config.yaml']).toContain('ask_from_bar:');
    // ...and never leaks a camelCase key into YAML.
    expect(yaml['routines.yaml']).not.toContain('rankBy');
    expect(yaml['aliases.yaml']).not.toContain('actionId');
  });

  it('key conversion is reversible and leaves values untouched', () => {
    const camel = { rankBy: 'importance', summarize: { maxItems: 8 }, list: ['on_demand'] };
    const snake = toSnakeKeysDeep(camel);
    expect(snake).toEqual({
      rank_by: 'importance',
      summarize: { max_items: 8 },
      list: ['on_demand'],
    });
    expect(toCamelKeysDeep(snake)).toEqual(camel);
  });
});

describe('validateYaml', () => {
  it('reports a ✓ summary with a count for valid input', () => {
    const yaml = configToYamlFiles(richConfig());
    const issues = validateYaml('routines.yaml', yaml['routines.yaml']);
    expect(issues[0]).toMatchObject({ level: 'ok' });
    expect(issues[0].message).toContain('2 routines');
  });

  it('flags a soft warning for a routine with no schedule (on-demand only)', () => {
    const yaml = configToYamlFiles(richConfig());
    const issues = validateYaml('routines.yaml', yaml['routines.yaml']);
    const warn = issues.find((i) => i.level === 'warn' && i.code === 'standup_prep');
    expect(warn?.message).toContain('runs on demand only');
  });

  it('flags a parse error for malformed YAML', () => {
    const issues = validateYaml('aliases.yaml', 'aliases: [unclosed');
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('error');
  });

  it('flags a schema error (missing required key) with the offending path', () => {
    const issues = validateYaml('aliases.yaml', 'aliases:\n  - keyword: gh\n    label: GitHub');
    expect(issues.some((i) => i.level === 'error')).toBe(true);
    // `action_id` is required on an alias; the missing-key path points there.
    expect(issues.some((i) => i.code?.includes('actionId'))).toBe(true);
  });

  it('flags a schema error (wrong type)', () => {
    const issues = validateYaml(
      'routines.yaml',
      'routines:\n  - id: r1\n    label: R\n    sources: not-a-list',
    );
    expect(issues.some((i) => i.level === 'error')).toBe(true);
  });
});

describe('yamlFileToConfigSlice + merge', () => {
  it('merges a parsed slice over a full config without touching other slices', () => {
    const config = richConfig();
    const yaml = configToYamlFiles(config);
    const edited = yaml['aliases.yaml'].replace('keyword: gh', 'keyword: hub');
    const result = yamlFileToConfigSlice('aliases.yaml', edited);
    if (!result.ok) throw new Error('expected ok');
    const next = mergeConfigSlice(config, result.slice);
    expect(next.aliases[0].keyword).toBe('hub');
    expect(next.actions).toEqual(config.actions);
    expect(next.routines).toEqual(config.routines);
  });

  it('refuses an invalid slice (no partial write possible)', () => {
    const result = yamlFileToConfigSlice(
      'workflows.yaml',
      'workflows:\n  - name: X\n    steps: []',
    );
    // A workflow needs at least one step — the slice never validates.
    expect(result.ok).toBe(false);
  });
});

describe('formatConfigYaml', () => {
  it('is idempotent on already-canonical output', () => {
    const file: ConfigYamlFile = 'routines.yaml';
    const canonical = configToYamlFiles(richConfig())[file];
    expect(formatConfigYaml(file, canonical)).toBe(canonical);
  });

  it('canonicalizes messy-but-valid YAML and preserves meaning', () => {
    const messy = 'aliases:\n  - { id: al1, keyword: gh, label: GitHub, action_id: a1 }';
    const formatted = formatConfigYaml('aliases.yaml', messy);
    expect(formatted).toContain('keyword: gh');
    const result = yamlFileToConfigSlice('aliases.yaml', formatted);
    if (!result.ok) throw new Error('formatted output should be valid');
    expect(result.slice.aliases?.[0].actionId).toBe('a1');
  });

  it('returns invalid YAML unchanged (can not format what does not parse)', () => {
    const broken = 'aliases: [oops';
    expect(formatConfigYaml('aliases.yaml', broken)).toBe(broken);
  });
});
