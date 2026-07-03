import type { AiAnswer, AiSuggestedAction } from '@cockpitzero/shared';
import { cn } from '../../lib/cn.js';
import { Badge } from '../atoms/Badge.js';
import { Sparkle } from '../atoms/Sparkle.js';

/** markdown-lite bold: `**x**` → `<b>x</b>`. Split on the delimiter — odd
 *  segments are the emphasized ones. No HTML injection (plain React nodes). */
function renderBold(text: string): React.ReactNode[] {
  return text.split('**').map((seg, i) =>
    i % 2 === 1 ? (
      <b key={i} className="font-semibold">
        {seg}
      </b>
    ) : (
      seg
    ),
  );
}

/** Outline glyph for a suggestion, chosen by its badge so rows read at a glance. */
function suggestionGlyph(badge?: string): React.ReactNode {
  switch (badge) {
    case 'Draft':
      return (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </>
      );
    case 'Task':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12 2.5 2.5 4.5-5" />
        </>
      );
    case 'App':
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18" />
        </>
      );
    default:
      return null;
  }
}

function SuggestionRow({
  suggestion,
  optionId,
  selected,
  runnable,
  onHover,
  onClick,
}: {
  suggestion: AiSuggestedAction;
  optionId: string;
  selected: boolean;
  runnable: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  const glyph = suggestionGlyph(suggestion.badge);
  return (
    <li
      id={optionId}
      role="option"
      aria-selected={selected}
      onMouseEnter={onHover}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center justify-between gap-3.5 rounded-[var(--cz-radius-md)] border border-transparent p-3',
        selected &&
          '[background:var(--cz-accent-soft)] [border-color:var(--cz-accent-line)] [box-shadow:var(--cz-ring-focus)]',
      )}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <span
          className={cn(
            'grid size-[34px] shrink-0 place-items-center rounded-[var(--cz-radius-md)] border transition-colors',
            selected
              ? 'text-accent-fg [background:var(--cz-accent-grad)] [border-color:var(--cz-accent-line)] [box-shadow:var(--cz-glow-chip)]'
              : 'bg-surface-2 border-border text-muted',
          )}
        >
          {glyph ? (
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
              {glyph}
            </svg>
          ) : (
            <Sparkle className="size-[18px]" />
          )}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-[9px] text-base font-medium text-fg">
            <span className="truncate">{suggestion.title}</span>
            {suggestion.badge && (
              <Badge tone={suggestion.badge === 'Draft' ? 'accent' : 'neutral'}>
                {suggestion.badge}
              </Badge>
            )}
          </div>
          {suggestion.subtitle && (
            <div className="mt-[3px] truncate text-[13px] text-subtle">{suggestion.subtitle}</div>
          )}
        </div>
      </div>
      {selected && runnable && (
        <span className="shrink-0 rounded-[var(--cz-radius-xs)] border px-[9px] py-1 font-mono text-xs font-medium text-[var(--cz-accent-bright)] [background:var(--cz-accent-soft)] [border-color:var(--cz-accent-line)]">
          ↵ run
        </span>
      )}
    </li>
  );
}

/**
 * The answer body behind the bar (matches `ai-ask.html`): an "Answer" label +
 * provenance meta + prose, then a "Suggested actions" list. While `pending`, the
 * answer block shows a quiet thinking state and no suggestions, so the reveal
 * doesn't shift layout jarringly. The selected suggestion is the view's one
 * accent moment.
 */
export function AiAnswerPanel({
  answer,
  pending = false,
  pendingText,
  listboxId,
  optionId,
  selected,
  onSelect,
  onHover,
  isRunnable,
}: {
  /** The resolved answer (omitted while `pending`). */
  answer?: AiAnswer;
  pending?: boolean;
  /** Prose streamed so far while `pending` (production phase 4). Empty until the
   *  first token; once present it replaces the "thinking" placeholder with the
   *  live text + a caret. */
  pendingText?: string;
  listboxId: string;
  optionId: (index: number) => string;
  selected: number;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
  /** Whether a suggestion maps to a runnable config action. */
  isRunnable: (suggestion: AiSuggestedAction) => boolean;
}) {
  const suggestions = answer?.suggestions ?? [];
  const streaming = pending && !!pendingText;
  return (
    <div>
      <div className="px-5 pt-[22px] pb-2">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-[7px] text-[11px] font-semibold tracking-[0.12em] text-[var(--cz-accent-bright)] uppercase">
            <Sparkle className="size-3.5" />
            Answer
          </span>
          <span className="font-mono text-xs text-subtle">
            {pending ? 'cockpit-ai · thinking…' : (answer?.meta ?? 'cockpit-ai')}
          </span>
        </div>
        {pending ? (
          streaming ? (
            // Tokens are arriving — render the prose so far with a trailing caret.
            <p className="max-w-[60ch] text-base leading-[1.62] text-fg [text-wrap:pretty]">
              {renderBold(pendingText ?? '')}
              <span
                aria-hidden="true"
                className="cz-caret ml-0.5 inline-block h-[18px] w-0.5 translate-y-[3px] bg-accent"
              />
            </p>
          ) : (
            // Asked, no tokens yet — the quiet "thinking" state.
            <p className="text-base text-subtle">
              Reading your workspace and history
              <span
                aria-hidden="true"
                className="cz-caret ml-0.5 inline-block h-[18px] w-0.5 translate-y-[3px] bg-accent"
              />
            </p>
          )
        ) : (
          <p className="max-w-[60ch] text-base leading-[1.62] text-fg [text-wrap:pretty]">
            {renderBold(answer?.text ?? '')}
          </p>
        )}
      </div>

      {!pending && suggestions.length > 0 && (
        <>
          <div className="px-5 pt-[18px] pb-1 text-[11px] font-semibold tracking-[0.14em] text-subtle uppercase">
            Suggested actions
          </div>
          <ul
            role="listbox"
            id={listboxId}
            aria-label="Suggested actions"
            className="px-3.5 pt-0.5 pb-2"
          >
            {suggestions.map((suggestion, i) => (
              <SuggestionRow
                key={suggestion.id}
                suggestion={suggestion}
                optionId={optionId(i)}
                selected={i === selected}
                runnable={isRunnable(suggestion)}
                onHover={() => onHover(i)}
                onClick={() => onSelect(i)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
