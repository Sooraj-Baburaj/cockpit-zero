import { useEffect, useReducer, useState, type ReactNode } from 'react';
import {
  aiPhaseReducer,
  IDLE_AI_PHASE,
  setAiToolGrant,
  type AiModelTier,
  type AiSettings,
  type AiToolId,
} from '@cockpitzero/shared';
import { api } from '../../lib/api.js';
import { cn } from '../../lib/cn.js';
import { Button } from '../atoms/Button.js';
import { Sparkle } from '../atoms/Sparkle.js';
import { Toggle } from '../atoms/Toggle.js';
import { SegmentedControl } from '../molecules/SegmentedControl.js';
import { ToolGrantCard } from '../molecules/ToolGrantCard.js';
import { AiAnswerPanel } from './AiAnswerPanel.js';

/** Quick-start prompts in the composer (from `cockpit-ai.html`). */
const PROMPT_CHIPS = [
  'Summarize my unread',
  'Draft a workflow',
  'Build a deck from a brief',
  'What changed in Apollo today?',
];

const MODEL_TIERS: { value: AiModelTier; label: string; disabled?: boolean; title?: string }[] = [
  { value: 'mini', label: 'Mini' },
  { value: 'pro', label: 'Pro' },
  // "Bring your own" needs a secure key store (OS keychain / safeStorage), never
  // the synced config.json — so it's disabled until the real provider lands.
  // TODO(phase: provider): enable + add a secure-store-backed key field.
  {
    value: 'byo',
    label: 'Bring your own',
    disabled: true,
    title: 'Bring your own key — available when the real provider lands.',
  },
];

/** Tool catalog metadata (id ↔ display). Order follows `AI_TOOL_IDS`. */
const TOOLS: { id: AiToolId; name: string; scope: string; icon: ReactNode }[] = [
  {
    id: 'files',
    name: 'Files',
    scope: 'Read & search',
    icon: (
      <Glyph>
        <path d="M6 2h9l4 4v16H6Z" />
        <path d="M15 2v4h4" />
      </Glyph>
    ),
  },
  {
    id: 'calendar',
    name: 'Calendar',
    scope: 'Read events',
    icon: (
      <Glyph>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      </Glyph>
    ),
  },
  {
    id: 'slack',
    name: 'Slack',
    scope: 'Read & post',
    icon: (
      <Glyph>
        <path d="M21 11.5a8.4 8.4 0 0 1-1 4 8.5 8.5 0 0 1-7.5 4.5 8.4 8.4 0 0 1-4-1L3 21l1-3.5a8.4 8.4 0 0 1-1-4A8.5 8.5 0 0 1 7.5 6 8.4 8.4 0 0 1 11.5 5h.5A8.5 8.5 0 0 1 21 11v.5Z" />
      </Glyph>
    ),
  },
  {
    id: 'slides-sheets',
    name: 'Slides & Sheets',
    scope: 'Create & edit',
    icon: (
      <Glyph>
        <rect x="3" y="4" width="18" height="13" rx="1.5" />
        <path d="M12 17v4M8 21h8" />
      </Glyph>
    ),
  },
];

type AiStatus = Awaited<ReturnType<typeof api.aiStatus>>;

/**
 * Settings → AI. Binds every control to the `ai` config block (Phase 1) and
 * persists on **Save** — edits live in a local draft so the button enables only
 * when dirty (and a reopen shows the saved values). The inline composer reuses
 * the launcher's `askAI` flow + `AiAnswerPanel` (reuse, don't fork); it's an
 * entry point to the assistant, not a full chat transcript.
 */
export function AiPanel({ ai, onSave }: { ai: AiSettings; onSave: (ai: AiSettings) => void }) {
  const [draft, setDraft] = useState<AiSettings>(ai);
  const [prompt, setPrompt] = useState('');
  const [phase, dispatch] = useReducer(aiPhaseReducer, IDLE_AI_PHASE);
  const [status, setStatus] = useState<AiStatus | null>(null);

  // Re-sync the draft + connection chip whenever the saved config changes (a save
  // here, or an external write). `ai` is a fresh object each save, so this resets
  // dirty back to false after persisting.
  useEffect(() => {
    setDraft(ai);
    void api.aiStatus().then(setStatus);
  }, [ai]);

  const set = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const dirty =
    draft.modelTier !== ai.modelTier ||
    draft.askFromBar !== ai.askFromBar ||
    draft.memoryEnabled !== ai.memoryEnabled ||
    draft.tools.length !== ai.tools.length ||
    !draft.tools.every((t) => ai.tools.includes(t));

  /** Hand a prompt to the assistant — the same `askAI` flow the launcher uses. */
  const ask = (text: string) => {
    const q = text.trim();
    if (q === '' || phase.status === 'pending') return;
    setPrompt(q);
    dispatch({ type: 'ask', query: q });
    void api.askAI(q).then((answer) => dispatch({ type: 'resolved', query: q, answer }));
  };

  return (
    <div className="max-w-2xl">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-serif text-[30px] leading-none font-medium tracking-[-0.015em] text-fg">
          AI
        </h1>
        <ConnectionChip status={status} />
      </header>

      {/* Inline composer — ask from inside the cockpit. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(prompt);
        }}
        className="rounded-[var(--cz-radius-lg)] border [border-color:var(--cz-accent-line)] [background:var(--cz-glass-1)] px-[18px] py-4 [box-shadow:var(--cz-shadow-md),var(--cz-glow-accent-soft)]"
      >
        <div className="flex items-center gap-3">
          <Sparkle className="size-[22px] shrink-0 text-accent" />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask CockpitZero anything, or describe a task…"
            aria-label="Ask CockpitZero"
            className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-subtle"
          />
          <Button
            type="submit"
            variant="dark"
            disabled={prompt.trim() === '' || phase.status === 'pending'}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h13M12 5l7 7-7 7" />
            </svg>
            Ask
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {PROMPT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => ask(chip)}
              className="rounded-[var(--cz-radius-full)] border border-border [background:var(--cz-glass-2)] px-[13px] py-[7px] text-[12.5px] font-medium text-muted transition hover:text-fg hover:[border-color:var(--cz-accent-line)]"
            >
              {chip}
            </button>
          ))}
        </div>
      </form>

      {/* Answer preview — reuses the launcher's answer rendering (display-only). */}
      {phase.status !== 'idle' && (
        <div className="mt-3 overflow-hidden rounded-[var(--cz-radius-lg)] border border-border [background:var(--cz-glass-1)] [box-shadow:var(--cz-shadow-sm)]">
          <AiAnswerPanel
            pending={phase.status === 'pending'}
            answer={phase.status === 'answer' ? phase.answer : undefined}
            listboxId="cz-ai-settings-answer"
            optionId={(i) => `cz-ai-settings-suggestion-${i}`}
            selected={-1}
            onSelect={() => {}}
            onHover={() => {}}
            isRunnable={() => false}
          />
        </div>
      )}

      <GroupLabel>Engine</GroupLabel>
      <OptRow title="Default model" desc="Powers Ask AI, drafted workflows, and routine summaries.">
        <SegmentedControl
          ariaLabel="Default model"
          value={draft.modelTier}
          options={MODEL_TIERS}
          onChange={(modelTier) => set('modelTier', modelTier)}
        />
      </OptRow>

      <GroupLabel>Behavior</GroupLabel>
      <OptRow
        title="Ask AI from the bar"
        desc="When a search matches no action, app, or file, treat the query as a question."
      >
        <Toggle checked={draft.askFromBar} onChange={(v) => set('askFromBar', v)} label="Ask AI from the bar" />
      </OptRow>
      <OptRow
        title="Memory & history"
        desc="Let the assistant carry context across sessions to do more of the busywork."
      >
        <Toggle checked={draft.memoryEnabled} onChange={(v) => set('memoryEnabled', v)} label="Memory & history" />
      </OptRow>

      <GroupLabel>Tools the assistant can use</GroupLabel>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <ToolGrantCard
            key={tool.id}
            icon={tool.icon}
            name={tool.name}
            scope={tool.scope}
            granted={draft.tools.includes(tool.id)}
            onChange={(granted) => set('tools', setAiToolGrant(draft.tools, tool.id, granted))}
          />
        ))}
      </div>

      <footer className="mt-7 flex items-center justify-between gap-4 border-t [border-color:var(--cz-line-faint)] pt-4">
        <span className="text-[12.5px] text-subtle">
          Local-first · anything that leaves your machine is explicit and minimal.
        </span>
        <Button variant="dark" disabled={!dirty} onClick={() => onSave(draft)}>
          Save changes
        </Button>
      </footer>
    </div>
  );
}

/** The "Connected · provider" pill, fed by `aiStatus()`. Stays neutral until the
 *  first status resolves so it never flashes a misleading "AI off". */
function ConnectionChip({ status }: { status: AiStatus | null }) {
  const label = !status
    ? 'Checking…'
    : !status.enabled
      ? 'AI off'
      : status.ok
        ? 'Connected'
        : 'Unavailable';
  return (
    <span className="inline-flex items-center gap-2 rounded-[var(--cz-radius-full)] border border-border [background:var(--cz-glass-1)] px-[13px] py-1.5 text-xs font-medium text-muted [box-shadow:var(--cz-shadow-sm)]">
      <span
        className={cn(
          'size-[7px] rounded-full',
          status?.ok
            ? '[background:var(--cz-success)]'
            : status?.enabled
              ? '[background:var(--cz-warn)]'
              : '[background:var(--cz-fg-faint)]',
        )}
      />
      {label}
      {status?.enabled && (
        <>
          {' · '}
          <b className="font-semibold text-fg">{status.provider}</b>
        </>
      )}
    </span>
  );
}

/** A small-caps section label (`.grp-lbl`). */
function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-[18px] mb-2.5 text-[11px] font-semibold tracking-[0.14em] text-subtle uppercase">
      {children}
    </div>
  );
}

/** A settings option row (`.opt`): title + description on the left, control right. */
function OptRow({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-4 rounded-[var(--cz-radius-md)] border border-border [background:var(--cz-glass-1)] px-[18px] py-[13px] [box-shadow:var(--cz-shadow-sm)]">
      <div>
        <div className="text-[14.5px] font-semibold text-fg">{title}</div>
        <div className="mt-[3px] max-w-[52ch] text-[13px] text-muted">{desc}</div>
      </div>
      {children}
    </div>
  );
}

/** Shared 18px outline icon used by the tool chips. */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
