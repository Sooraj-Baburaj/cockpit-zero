import { coerceMemoryFacts, type AiMemoryFact } from '@cockpitzero/shared';

/**
 * Durable-fact extraction for the local memory engine (production phase 5). Turns
 * a raw exchange (a question + answer, or a task summary) into a few **atomic,
 * durable facts** worth remembering — not a transcript. The provider does the real
 * work via structured generation (`generateObject`, injected as `generate`); when
 * no key is set / the model fails, a **keyless heuristic** splits the text into
 * candidate facts so memory still accrues offline.
 *
 * Pure + `electron`-free and free of the AI SDK: the model call is injected as a
 * function that returns the raw model object, which we validate through the shared
 * `coerceMemoryFacts` (never trust raw model output — CLAUDE.md). Unit-tested with
 * a fake `generate` and via the heuristic path.
 */

/** One fact the extractor produced — the memory service embeds + stores each. */
export interface ExtractedFact {
  text: string;
  kind: string;
  importance: number;
}

export interface Extractor {
  /** Extract durable facts from raw text. Returns `[]` for empty input. */
  extract(rawText: string): Promise<ExtractedFact[]>;
}

export interface ExtractorDeps {
  /**
   * Provider-backed structured extraction: given the raw text, returns the raw
   * model object (shaped like `{ facts: [...] }`). Absent / throwing ⇒ the keyless
   * heuristic. Wired at the composition root to the configured AI provider.
   */
  generate?: (rawText: string) => Promise<unknown>;
  /** Cap on facts kept per call (keeps a chatty model from flooding memory). */
  maxFacts?: number;
}

const DEFAULT_MAX_FACTS = 8;

export function createExtractor({
  generate,
  maxFacts = DEFAULT_MAX_FACTS,
}: ExtractorDeps = {}): Extractor {
  return {
    async extract(rawText) {
      const text = rawText.trim();
      if (text === '') return [];

      if (generate) {
        try {
          const facts = coerceMemoryFacts(await generate(text));
          // A valid-but-empty result means "nothing worth remembering" — respect it
          // rather than forcing the heuristic to invent facts.
          if (facts.length > 0) return facts.slice(0, maxFacts).map(toExtracted);
        } catch {
          // Model/key unavailable or a transport error → degrade to the heuristic.
        }
      }

      return heuristicFacts(text, maxFacts);
    },
  };
}

/** Narrow a validated `AiMemoryFact` to the engine's `ExtractedFact`. */
function toExtracted(fact: AiMemoryFact): ExtractedFact {
  return { text: fact.text, kind: fact.kind, importance: fact.importance };
}

/** Sentence/line splitter for the keyless path: keep the durable-looking chunks. */
function splitCandidates(text: string): string[] {
  return (
    text
      .split(/(?:\r?\n)+|(?<=[.!?])\s+/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      // Drop fragments too short to be a real fact (and bare list bullets / numbers).
      .filter((s) => s.replace(/[^a-z0-9]/gi, '').length >= 12)
  );
}

/** Cheap salience heuristic: longer statements and ones with concrete signals
 *  (numbers, capitalized names) read as more durable. Clamped to [0.3, 0.85] so the
 *  keyless path never claims provider-grade confidence. */
function heuristicImportance(sentence: string): number {
  let score = 0.4;
  if (/\d/.test(sentence)) score += 0.15;
  if (/\b[A-Z][a-z]{2,}\b/.test(sentence)) score += 0.1;
  if (sentence.length > 60) score += 0.1;
  return Number(Math.max(0.3, Math.min(0.85, score)).toFixed(4));
}

/**
 * Keyless fallback: split into candidate sentences, dedupe, cap, and tag each as a
 * plain `note`. Deliberately conservative — better a few solid notes than a noisy
 * transcript. Acceptable per the phase's "keyless fallback must be acceptable".
 */
function heuristicFacts(text: string, maxFacts: number): ExtractedFact[] {
  const seen = new Set<string>();
  const out: ExtractedFact[] = [];
  // No sentence breaks at all (a short phrase) → keep the whole thing as one fact.
  const candidates = splitCandidates(text);
  const source = candidates.length > 0 ? candidates : [text.replace(/\s+/g, ' ').trim()];
  for (const sentence of source) {
    const key = sentence.toLowerCase();
    if (sentence === '' || seen.has(key)) continue;
    seen.add(key);
    out.push({ text: sentence, kind: 'note', importance: heuristicImportance(sentence) });
    if (out.length >= maxFacts) break;
  }
  return out;
}
