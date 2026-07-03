import { z } from 'zod';
import { TASK_TOOL_GRANT } from '@cockpitzero/shared';
import type { Tool, ToolContext, ToolResult } from './registry.js';

/**
 * `slides.create` — a **local, offline stub** of the generative slides tool. It
 * produces preview tiles in memory (the cross-hatch placeholders the surface
 * renders) but performs NO real Slides/Keynote/network export — the real connector
 * is the P10 slice. It IS side-effecting in intent, so the runner pauses for human
 * review before it runs and nothing is committed without approval. Marked `stub`
 * (badged in the UI) + described as a stub to the model, and gated by the
 * `slides-sheets` grant (off by default) — the one place a non-test stub survives
 * (CLAUDE.md), and only because it's clearly labeled and off by default.
 */
const slidesCreateParameters = z.object({
  previews: z.array(z.string()).optional().describe('Tile captions to draft, in order.'),
  count: z.number().int().positive().optional().describe('How many slides to draft.'),
});
type SlidesCreateInput = z.infer<typeof slidesCreateParameters>;

const DEFAULT_TILES = ['title', 'kpis', 'growth', 'next'];

export const slidesCreate: Tool = {
  id: 'slides.create',
  description:
    'STUB (not a real export yet): draft in-memory slide preview tiles. It produces ' +
    'placeholder tiles only — it does NOT create a real Keynote/Slides file or touch ' +
    'the network. Side-effecting in intent, so the user must approve before it runs.',
  parameters: slidesCreateParameters,
  grant: TASK_TOOL_GRANT['slides.create'],
  sideEffecting: true,
  stub: true,
  async run(input: unknown, _ctx: ToolContext): Promise<ToolResult> {
    const { previews = DEFAULT_TILES, count } = (input ?? {}) as Partial<SlidesCreateInput>;
    const n = count ?? previews.length;
    return {
      ok: true,
      detail: `${n} slides drafted (stub — no real export)`,
      previews,
      data: { count: n, stub: true },
    };
  },
};
