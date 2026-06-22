import { describe, it, expect } from 'vitest';
import { highlightYamlLine } from '../src/renderer/lib/yaml-highlight.js';

/** Join a line's tokens back into its original text — every char must survive. */
function joined(line: string): string {
  return highlightYamlLine(line)
    .map((t) => t.text)
    .join('');
}

/** The class assigned to the first token matching `text`, if any. */
function classOf(line: string, text: string): string | undefined {
  return highlightYamlLine(line).find((t) => t.text === text)?.cls;
}

describe('highlightYamlLine', () => {
  it('preserves the original text exactly (lossless tokenizing)', () => {
    for (const line of [
      'version: 1',
      '  - id: morning_digest',
      '    sources: [slack, gmail, teams]',
      '    schedule: "0 8 * * 1-5"  # weekdays, 8am',
      '# a comment',
      '',
      '    ',
    ]) {
      expect(joined(line)).toBe(line);
    }
  });

  it('colours keys, plain values, numbers, and quoted strings', () => {
    expect(classOf('version: 1', 'version')).toBe('k');
    expect(classOf('version: 1', '1')).toBe('num');
    expect(classOf('rank_by: importance', 'rank_by')).toBe('k');
    expect(classOf('rank_by: importance', 'importance')).toBe('pl');
    expect(classOf('label: "Morning briefing"', '"Morning briefing"')).toBe('s');
  });

  it('treats a whole-line comment as a comment', () => {
    const tokens = highlightYamlLine('# Proactive jobs');
    expect(tokens.at(-1)).toMatchObject({ cls: 'cm', text: '# Proactive jobs' });
  });

  it('splits an inline comment from the value', () => {
    const tokens = highlightYamlLine('schedule: "0 8 * * *"  # weekdays');
    expect(tokens.some((t) => t.cls === 's' && t.text === '"0 8 * * *"')).toBe(true);
    expect(tokens.some((t) => t.cls === 'cm' && t.text.includes('# weekdays'))).toBe(true);
  });

  it('does not mistake a # inside a quoted string for a comment', () => {
    const tokens = highlightYamlLine('content: "tag #1"');
    expect(tokens.some((t) => t.cls === 'cm')).toBe(false);
    expect(tokens.some((t) => t.cls === 's' && t.text === '"tag #1"')).toBe(true);
  });

  it('colours flow-list scalars as strings and brackets as punctuation', () => {
    const tokens = highlightYamlLine('sources: [slack, gmail]');
    expect(tokens.some((t) => t.cls === 's' && t.text === 'slack')).toBe(true);
    expect(tokens.some((t) => t.cls === 's' && t.text === 'gmail')).toBe(true);
    expect(tokens.some((t) => t.cls === 'p' && t.text === '[')).toBe(true);
  });
});
