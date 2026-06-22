import { TASK_TOOL_GRANT } from '@cockpitzero/shared';
import type { Tool, ToolContext, ToolResult } from './registry.js';

/**
 * `slides.create` — a **local, offline stub** of the generative slides tool. It
 * produces preview tiles in memory (the cross-hatch placeholders the surface
 * renders) but performs NO real Slides/Keynote/network export — that external
 * write is the "out until proven" slice. It IS side-effecting in intent, so the
 * run pauses for human review after it and nothing is committed without approval.
 * Gated by the `slides-sheets` grant (off by default), demonstrating that a
 * side-effecting tool never runs without an explicit grant.
 */
interface SlidesCreateInput {
  /** Tile captions to produce, in order. */
  previews?: string[];
  count?: number;
}

const DEFAULT_TILES = ['title', 'kpis', 'growth', 'next'];

export const slidesCreate: Tool = {
  id: 'slides.create',
  grant: TASK_TOOL_GRANT['slides.create'],
  sideEffecting: true,
  async run(input: unknown, _ctx: ToolContext): Promise<ToolResult> {
    const { previews = DEFAULT_TILES, count } = (input ?? {}) as Partial<SlidesCreateInput>;
    const n = count ?? previews.length;
    return {
      ok: true,
      detail: `${n} slides drafted`,
      previews,
      data: { count: n },
    };
  },
};
