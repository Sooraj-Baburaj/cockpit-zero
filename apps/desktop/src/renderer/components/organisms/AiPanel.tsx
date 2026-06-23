import { useEffect, useState, type ReactNode } from 'react';
import {
  MODEL_CATALOG,
  OPENAI_COMPATIBLE_PRESETS,
  PROVIDER_CATALOG,
  SecretName,
  defaultModelFor,
  providerInfo,
  providerLabel,
  setAiToolGrant,
  type AiProviderId,
  type AiSettings,
  type AiToolId,
  type OpenAiCompatiblePreset,
} from '@cockpitzero/shared';
import { api } from '../../lib/api.js';
import { useAiAsk } from '../../hooks/useAiAsk.js';
import { cn } from '../../lib/cn.js';
import { Button } from '../atoms/Button.js';
import { Input } from '../atoms/Input.js';
import { Sparkle } from '../atoms/Sparkle.js';
import { Toggle } from '../atoms/Toggle.js';
import { Dropdown } from '../molecules/Dropdown.js';
import { SecretField } from '../molecules/SecretField.js';
import { ToolGrantCard } from '../molecules/ToolGrantCard.js';
import { AiAnswerPanel } from './AiAnswerPanel.js';

/** Quick-start prompts in the composer (from `cockpit-ai.html`). */
const PROMPT_CHIPS = [
  'Summarize my unread',
  'Draft a workflow',
  'Build a deck from a brief',
  'What changed in Apollo today?',
];

/** Provider picker options: every BYOP provider plus the offline demo for `mock`
 *  (so the control still reflects state on a fresh install). `managed` is phase 9. */
const PROVIDER_OPTIONS = [
  ...PROVIDER_CATALOG.map((p) => ({ value: p.id, label: p.label })),
  { value: 'mock', label: 'Built-in demo (offline)' },
];

/** Sentinel option that switches the model dropdown into a free-text field. */
const CUSTOM_MODEL = '__custom__';

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
 * Console → AI. The BYOP control surface (production phase 3): pick a provider and a
 * model, paste your own API key (stored in the OS-keychain vault, never `config.json`
 * or the renderer), and the assistant runs against your real provider. There is **no**
 * Mini/Pro tier control — that's a managed-only knob (phase 9). Provider/model/base-URL
 * persist on **Save**; the API key saves itself through {@link SecretField}. The inline
 * composer reuses the launcher's `askAI` flow + `AiAnswerPanel` (reuse, don't fork).
 */
export function AiPanel({ ai, onSave }: { ai: AiSettings; onSave: (ai: AiSettings) => void }) {
  const [draft, setDraft] = useState<AiSettings>(ai);
  const [prompt, setPrompt] = useState('');
  const { phase, ask } = useAiAsk();
  const [status, setStatus] = useState<AiStatus | null>(null);

  const refreshStatus = () => void api.aiStatus().then(setStatus);

  // Re-sync the draft + connection chip whenever the saved config changes (a save
  // here, or an external write). `ai` is a fresh object each save, so this resets
  // dirty back to false after persisting.
  useEffect(() => {
    setDraft(ai);
    refreshStatus();
  }, [ai]);

  const set = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // Switching provider seeds a sensible default model and drops the base URL unless
  // the new provider is `openai-compatible` (the only one that uses it).
  const onProviderChange = (value: string) => {
    const provider = value as AiProviderId;
    setDraft((d) => ({
      ...d,
      provider,
      model: defaultModelFor(provider),
      baseUrl: provider === 'openai-compatible' ? d.baseUrl : undefined,
    }));
  };

  const info = providerInfo(draft.provider);

  const dirty =
    draft.provider !== ai.provider ||
    draft.model !== ai.model ||
    (draft.baseUrl ?? '') !== (ai.baseUrl ?? '') ||
    draft.askFromBar !== ai.askFromBar ||
    draft.memoryEnabled !== ai.memoryEnabled ||
    draft.tools.length !== ai.tools.length ||
    !draft.tools.every((t) => ai.tools.includes(t));

  /** Hand a prompt to the assistant — the same streamed `askAIStream` flow the
   *  launcher uses (via `useAiAsk`). Blocked while a request is already streaming. */
  const submit = (text: string) => {
    const q = text.trim();
    if (q === '' || phase.status === 'pending') return;
    setPrompt(q);
    ask(q);
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
          submit(prompt);
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
              onClick={() => submit(chip)}
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
            pendingText={phase.status === 'pending' ? phase.text : undefined}
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

      <GroupLabel>Provider</GroupLabel>
      <div className="space-y-4 rounded-[var(--cz-radius-md)] border border-border [background:var(--cz-glass-1)] px-[18px] py-4 [box-shadow:var(--cz-shadow-sm)]">
        <Labeled
          label="Provider"
          description={
            info?.blurb ??
            'Powers Ask AI, drafted workflows, and routine summaries — bring your own key.'
          }
        >
          <Dropdown
            ariaLabel="AI provider"
            value={draft.provider}
            options={PROVIDER_OPTIONS}
            onChange={onProviderChange}
          />
        </Labeled>

        {draft.provider === 'openai-compatible' && (
          <Labeled label="Base URL" description="The OpenAI-compatible endpoint to call.">
            <div className="space-y-2.5">
              <div className="flex flex-wrap gap-2">
                {OPENAI_COMPATIBLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset, setDraft)}
                    className="rounded-[var(--cz-radius-full)] border border-border [background:var(--cz-glass-2)] px-[11px] py-[5px] text-[12px] font-medium text-muted transition hover:text-fg hover:[border-color:var(--cz-accent-line)]"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <Input
                value={draft.baseUrl ?? ''}
                onChange={(e) => set('baseUrl', e.target.value || undefined)}
                placeholder="https://openrouter.ai/api/v1"
                aria-label="Base URL"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
              />
            </div>
          </Labeled>
        )}

        {draft.provider !== 'mock' && (
          <Labeled label="Model" description="Pick a model, or choose Custom… to enter any id.">
            <ModelPicker
              key={draft.provider}
              provider={draft.provider}
              value={draft.model}
              onChange={(m) => set('model', m)}
            />
          </Labeled>
        )}
      </div>

      {info && (
        <div className="mt-3">
          <SecretField
            key={draft.provider}
            name={SecretName.providerKey(draft.provider)}
            label={info.requiresKey ? `${info.label} API key` : `${info.label} API key (optional)`}
            description={keyDescription(info)}
            placeholder="Paste your API key…"
            onStatusChange={refreshStatus}
          />
        </div>
      )}

      <GroupLabel>Behavior</GroupLabel>
      <OptRow
        title="Ask AI from the bar"
        desc="When a search matches no action, app, or file, treat the query as a question."
      >
        <Toggle
          checked={draft.askFromBar}
          onChange={(v) => set('askFromBar', v)}
          label="Ask AI from the bar"
        />
      </OptRow>
      <OptRow
        title="Memory & history"
        desc="Let the assistant carry context across sessions to do more of the busywork."
      >
        <Toggle
          checked={draft.memoryEnabled}
          onChange={(v) => set('memoryEnabled', v)}
          label="Memory & history"
        />
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
          Local-first · your key stays in the OS keychain, never synced.
        </span>
        <Button variant="dark" disabled={!dirty} onClick={() => onSave(draft)}>
          Save changes
        </Button>
      </footer>
    </div>
  );
}

/** A help line for the key field — keychain note + where to mint a key. */
function keyDescription(info: ReturnType<typeof providerInfo>): string {
  if (!info) return '';
  const base = info.requiresKey
    ? 'Stored encrypted in your OS keychain — never written to config or synced.'
    : 'Optional — local endpoints like Ollama need no key. Stored in your OS keychain, never synced.';
  return info.keyUrl ? `${base} Get a key: ${info.keyUrl}` : base;
}

/** Quick-fill an openai-compatible preset: set the base URL and (if offered) a
 *  starting model id. Pure update over the draft. */
function applyPreset(
  preset: OpenAiCompatiblePreset,
  setDraft: (fn: (d: AiSettings) => AiSettings) => void,
): void {
  setDraft((d) => ({
    ...d,
    baseUrl: preset.baseUrl || undefined,
    model: preset.models?.[0]?.id ?? d.model,
  }));
}

/**
 * The model control: a dropdown of the provider's curated ids plus a "Custom…"
 * escape hatch (free text). For providers with no catalog (`openai-compatible`) it's
 * a free-text field. Remounted on provider change (parent `key`) so its custom-mode
 * state re-initializes from the new provider's catalog.
 */
function ModelPicker({
  provider,
  value,
  onChange,
}: {
  provider: AiProviderId;
  value: string;
  onChange: (model: string) => void;
}) {
  const catalog = MODEL_CATALOG[provider];
  const freeTextOnly = catalog.length === 0;
  const [custom, setCustom] = useState(
    freeTextOnly || (value !== '' && !catalog.some((m) => m.id === value)),
  );

  if (freeTextOnly) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="model-id (e.g. anthropic/claude-opus-4.8)"
        aria-label="Model id"
        autoComplete="off"
        spellCheck={false}
        className="font-mono"
      />
    );
  }

  const options = [
    ...catalog.map((m) => ({ value: m.id, label: m.label })),
    { value: CUSTOM_MODEL, label: 'Custom…' },
  ];

  return (
    <div className="space-y-2">
      <Dropdown
        ariaLabel="Model"
        value={custom ? CUSTOM_MODEL : value}
        options={options}
        onChange={(v) => {
          if (v === CUSTOM_MODEL) {
            setCustom(true);
            onChange('');
          } else {
            setCustom(false);
            onChange(v);
          }
        }}
      />
      {custom && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter a model id (e.g. claude-opus-4-8)"
          aria-label="Custom model id"
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
      )}
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
        : 'Add a key to connect';
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
      {status?.enabled && status.ok && (
        <>
          {' · '}
          <b className="font-semibold text-fg">{providerLabel(status.provider as AiProviderId)}</b>
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

/** A labelled control block (title + optional description above the control). Used
 *  for the provider/model/base-URL pickers — a `<div>` (not `<label>`) so wrapping a
 *  custom Dropdown button doesn't hijack its focus/click. */
function Labeled({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-fg">{label}</div>
      {description && (
        <div className="mt-0.5 mb-2 text-xs leading-normal text-muted">{description}</div>
      )}
      <div className={description ? '' : 'mt-1.5'}>{children}</div>
    </div>
  );
}

/** A settings option row (`.opt`): title + description on the left, control right. */
function OptRow({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
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
