/**
 * A tiny, line-based YAML syntax highlighter for the config editor (Phase 6).
 *
 * Returns one array of tokens per line; the editor renders them as `<span>`s with
 * the mockup's token classes (`.k` key, `.s` string, `.num` number, `.cm` comment,
 * `.pl` plain value, `.p` punctuation). It is deliberately small and CSP-safe — no
 * eval, no remote workers — and never throws: anything it can't classify falls
 * back to a plain token, so an odd line just renders uncoloured rather than
 * breaking the editor. This is a highlighter, not a parser (the real validation is
 * the schema round-trip in `@cockpitzero/shared`).
 */

/** A highlighter token: a slice of text and the CSS class that colours it. */
export interface YamlToken {
  /** Token class — matches the `.cz-yaml .<cls>` rules in styles.css. */
  cls: 'k' | 's' | 'num' | 'cm' | 'pl' | 'p';
  text: string;
}

const NUMBER_RE = /^-?\d+(\.\d+)?$/;
const QUOTED_RE = /^(".*"|'.*')$/;

/** Find the index of an inline `# comment`, or -1. Skips `#` inside quotes. */
function inlineCommentIndex(value: string): number {
  let quote: string | null = null;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '#' && (i === 0 || /\s/.test(value[i - 1]!))) {
      return i;
    }
  }
  return -1;
}

/** Classify a single scalar value into its colour class. */
function scalarClass(core: string): YamlToken['cls'] {
  if (QUOTED_RE.test(core)) return 's';
  if (NUMBER_RE.test(core)) return 'num';
  return 'pl';
}

/** Push the value side of a `key:` line (flow lists, scalars, inline comments). */
function pushValue(value: string, out: YamlToken[]): void {
  const commentAt = inlineCommentIndex(value);
  const head = commentAt >= 0 ? value.slice(0, commentAt) : value;
  const comment = commentAt >= 0 ? value.slice(commentAt) : '';

  const leading = head.match(/^\s*/)?.[0] ?? '';
  if (leading) out.push({ cls: 'p', text: leading });
  const core = head.slice(leading.length).replace(/\s+$/, '');
  const trailing = head.slice(leading.length + core.length);

  if (core.startsWith('[') || core.startsWith('{')) {
    // Flow collection: colour scalars green, punctuation subtle.
    let buf = '';
    const flush = () => {
      if (!buf) return;
      const trimmed = buf.trim();
      const pad = buf.length - buf.trimStart().length;
      if (pad) out.push({ cls: 'p', text: buf.slice(0, pad) });
      if (trimmed) out.push({ cls: 's', text: trimmed });
      const tail = buf.length - pad - trimmed.length;
      if (tail) out.push({ cls: 'p', text: buf.slice(buf.length - tail) });
      buf = '';
    };
    for (const ch of core) {
      if ('[]{},:'.includes(ch)) {
        flush();
        out.push({ cls: 'p', text: ch });
      } else {
        buf += ch;
      }
    }
    flush();
  } else if (core) {
    out.push({ cls: scalarClass(core), text: core });
  }

  if (trailing) out.push({ cls: 'p', text: trailing });
  if (comment) out.push({ cls: 'cm', text: comment });
}

/** Tokenize one YAML line into coloured spans. */
export function highlightYamlLine(line: string): YamlToken[] {
  const out: YamlToken[] = [];

  const indent = line.match(/^\s*/)?.[0] ?? '';
  if (indent) out.push({ cls: 'p', text: indent });
  let rest = line.slice(indent.length);

  if (rest === '') return out;

  // Whole-line comment.
  if (rest.startsWith('#')) {
    out.push({ cls: 'cm', text: rest });
    return out;
  }

  // Leading list marker ("- ").
  if (rest.startsWith('- ')) {
    out.push({ cls: 'p', text: '- ' });
    rest = rest.slice(2);
  } else if (rest === '-') {
    out.push({ cls: 'p', text: '-' });
    return out;
  }

  // `key:` (optionally followed by a value).
  const keyMatch = rest.match(/^([A-Za-z0-9_.$-]+)(:)(.*)$/);
  if (keyMatch) {
    out.push({ cls: 'k', text: keyMatch[1]! });
    out.push({ cls: 'p', text: ':' });
    if (keyMatch[3]) pushValue(keyMatch[3], out);
  } else {
    pushValue(rest, out);
  }

  return out;
}
