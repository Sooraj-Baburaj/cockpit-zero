import { AiToolIdSchema } from './schemas.js';
import type { AiToolId } from './types.js';

/**
 * Pure helpers for the `ai` config block's UI bindings (the Settings → AI tab).
 * No React, no `electron` — the tool-grant grid maps a card's toggle straight
 * through {@link setAiToolGrant}, so the control-value ↔ schema-field mapping is
 * assertable in plain Node.
 */

/** The assistant's tool catalog, in the canonical order the grid renders them
 *  (mirrors the `AiToolIdSchema` enum — never hand-order a parallel list). */
export const AI_TOOL_IDS: readonly AiToolId[] = AiToolIdSchema.options;

/**
 * Grant or revoke one tool, returning a NEW array normalized to catalog order
 * with no duplicates. Normalizing here means `ai.tools` is order-stable
 * regardless of the click sequence, so a dirty-check can compare it cheaply.
 */
export function setAiToolGrant(
  tools: readonly AiToolId[],
  id: AiToolId,
  enabled: boolean,
): AiToolId[] {
  const granted = new Set(tools);
  if (enabled) granted.add(id);
  else granted.delete(id);
  return AI_TOOL_IDS.filter((tool) => granted.has(tool));
}
