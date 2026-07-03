import { useEffect, useRef, useState } from 'react';
import {
  computeLauncherView,
  hasArgument,
  type AiSuggestedAction,
  type Config,
  type LauncherItem,
} from '@cockpitzero/shared';
import { api } from '../lib/api.js';
import { useLauncherSearch } from '../hooks/useLauncherSearch.js';
import { useAiAsk } from '../hooks/useAiAsk.js';
import { useKeyboardNav } from '../hooks/useKeyboardNav.js';
import { useAppearance } from '../hooks/useAppearance.js';
import { modKey } from '../lib/platform.js';
import { LauncherLayout } from '../components/templates/LauncherLayout.js';
import { SearchField } from '../components/molecules/SearchField.js';
import { AiModePill } from '../components/molecules/AiModePill.js';
import { LauncherFooter, type FooterHint } from '../components/molecules/LauncherFooter.js';
import { Toast } from '../components/molecules/Toast.js';
import { ResultList } from '../components/organisms/ResultList.js';
import { ArgumentCapture } from '../components/organisms/ArgumentCapture.js';
import { AiOfferPanel } from '../components/organisms/AiOfferPanel.js';
import { AiAnswerPanel } from '../components/organisms/AiAnswerPanel.js';
import { EmptyState } from '../components/atoms/EmptyState.js';

interface Feedback {
  message: string;
  error: boolean;
}

/** ARIA wiring: the results listbox id and a stable per-row option id. Reused
 *  across the results / AI-offer / suggestions lists (only one renders at once). */
const LISTBOX_ID = 'cz-results';
const optionId = (index: number) => `cz-opt-${index}`;

/**
 * The frameless launcher bar — thin composition only. Search/argument logic
 * lives in `useLauncherSearch`, AI-mode state in the `aiPhase` reducer +
 * `computeLauncherView` (both pure, in `shared`), navigation in `useKeyboardNav`,
 * and all data access goes through `api` (the typed preload bridge).
 */
export function LauncherBar() {
  const [query, setQuery] = useState('');
  const [config, setConfig] = useState<Config | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { resolved, settled } = useLauncherSearch(query);
  const { phase, ask, reset } = useAiAsk();

  useEffect(() => {
    inputRef.current?.focus();
    void api.getConfig().then(setConfig);
  }, []);

  // Editing or clearing the query abandons any in-flight/visible AI answer (aborting
  // the stream) and returns to live search (covers typing, the two-stage Escape, and
  // the programmatic clear after a row runs).
  useEffect(() => {
    reset();
  }, [query, reset]);

  useAppearance(config?.settings.theme, config?.settings.glass);

  const view = computeLauncherView({ query, resolved, settled, ai: config?.ai, phase });
  const aiMode =
    view.kind === 'ai-offer' || view.kind === 'ai-pending' || view.kind === 'ai-answer';
  const hasListbox =
    view.kind === 'results' || view.kind === 'ai-offer' || view.kind === 'ai-answer';

  const count =
    view.kind === 'results'
      ? view.results.length
      : view.kind === 'ai-offer'
        ? 2 // ask · do this for me
        : view.kind === 'argument'
          ? 1
          : view.kind === 'ai-answer'
            ? view.answer.suggestions.length
            : 0;

  const flash = (message: string, error: boolean) => {
    setFeedback({ message, error });
    window.setTimeout(() => setFeedback(null), 2500);
  };

  /** Run a job (action/workflow/open). On success the launcher just hides itself
   *  and clears; only a failure surfaces feedback. */
  const execJob = (exec: () => Promise<{ ok: boolean; error?: string }>) => {
    void exec().then((res) => {
      if (res.ok) {
        void api.hideLauncher();
        setQuery('');
      } else {
        flash(res.error ?? 'Could not run', true);
      }
    });
  };

  const resultExec = (item: LauncherItem) => {
    switch (item.kind) {
      case 'action':
        return () => api.runAction(item.action.id);
      case 'workflow':
        return () => api.runWorkflow(item.workflow.id);
      case 'app':
      case 'file':
        return () => api.openPath(item.path);
    }
  };

  /** A suggestion runs only when it maps to a real config action; AI-only
   *  suggestions are display-only this phase (real side-effects land in Phase 7). */
  const isRunnable = (s: AiSuggestedAction) => !!config?.actions.some((a) => a.id === s.id);

  /** Hand the current query off as an agent task (Phase 7) — the task window
   *  takes over from here, so the launcher just hides. */
  const startTask = (intent: string) => {
    const q = intent.trim();
    if (q === '') return;
    void api.taskRun(q).then(() => {
      void api.hideLauncher();
      setQuery('');
    });
  };

  const runSuggestion = (index: number) => {
    if (view.kind !== 'ai-answer') return;
    const s = view.answer.suggestions[index];
    if (!s) return;
    if (!isRunnable(s)) {
      flash('Not runnable yet — coming in a later phase.', false);
      return;
    }
    execJob(() => api.runAction(s.id));
  };

  /** ⌘↵ — run every runnable suggestion in sequence, then hide. */
  const runAllSuggestions = () => {
    if (view.kind !== 'ai-answer') return;
    const runnable = view.answer.suggestions.filter(isRunnable);
    if (runnable.length === 0) {
      flash('No runnable suggestions yet.', false);
      return;
    }
    void runnable
      .reduce<Promise<unknown>>((p, s) => p.then(() => api.runAction(s.id)), Promise.resolve())
      .then(() => {
        void api.hideLauncher();
        setQuery('');
      });
  };

  /** Activate the row at `index` — meaning depends on the current view. */
  const run = (index: number) => {
    switch (view.kind) {
      case 'ai-offer':
        // Row 0 asks the assistant; row 1 hands it off as an agent task.
        if (index === 1) startTask(view.query);
        else ask(view.query);
        return;
      case 'ai-answer':
        runSuggestion(index);
        return;
      case 'argument':
        execJob(() => api.runAction(view.action.id, view.values));
        return;
      case 'results': {
        const item = view.results[index];
        if (!item) return;
        if (tryDrill(item)) return;
        execJob(resultExec(item));
        return;
      }
      default:
        return;
    }
  };

  const { selected, setSelected, handleKeyDown } = useKeyboardNav({
    count,
    resetKey: query,
    onSelect: run,
    onClose: () => void api.hideLauncher(),
  });

  const openConsole = () => {
    void api.openConsole();
    void api.hideLauncher();
  };

  /** Drill a parameterized action into argument capture by pre-filling its
   *  keyword. Returns false when the item isn't a parameterized action or has no
   *  keyword to trigger it. */
  const tryDrill = (item: LauncherItem | undefined): boolean => {
    if (item?.kind !== 'action' || !hasArgument(item.action)) return false;
    const keyword = config?.aliases.find((a) => a.actionId === item.action.id)?.keyword;
    if (!keyword) return false;
    setQuery(`${keyword} `);
    return true;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // ⌘, / Ctrl+, opens the Console.
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      openConsole();
      return;
    }
    // ⌘↵ / Ctrl+↵ runs all suggested actions (answer view).
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      if (view.kind === 'ai-answer') {
        e.preventDefault();
        runAllSuggestions();
        return;
      }
    }
    // ⌘1–9 / Ctrl+1–9 runs the Nth result (results view only).
    if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
      if (view.kind === 'results') {
        const index = Number(e.key) - 1;
        if (index < view.results.length) {
          e.preventDefault();
          run(index);
        }
      }
      return;
    }
    // Tab drills the selected parameterized action into argument entry.
    if (e.key === 'Tab') {
      if (view.kind === 'results' && tryDrill(view.results[selected])) e.preventDefault();
      return;
    }
    // Escape: clear query/state and immediately close the launcher.
    if (e.key === 'Escape') {
      e.preventDefault();
      if (aiMode) reset();
      setQuery('');
      void api.hideLauncher();
      return;
    }
    handleKeyDown(e);
  };

  const footerHints: FooterHint[] | undefined =
    view.kind === 'ai-offer'
      ? [
          { keys: '↑↓', label: 'choose' },
          { keys: '↵', label: 'run' },
          { keys: 'esc', label: 'dismiss' },
        ]
      : view.kind === 'ai-pending'
        ? [
            { keys: '↵', label: 'ask AI' },
            { keys: '⌫', label: 'back to search' },
            { keys: 'esc', label: 'dismiss' },
          ]
        : view.kind === 'ai-answer'
          ? [
              { keys: '↵', label: 'run' },
              { keys: `${modKey}↵`, label: 'run all' },
              { keys: '↑↓', label: 'navigate' },
            ]
          : undefined;

  return (
    <LauncherLayout aiMode={aiMode}>
      <SearchField
        inputRef={inputRef}
        value={query}
        onChange={setQuery}
        onKeyDown={onKeyDown}
        glyph={aiMode ? 'spark' : 'search'}
        trailing={
          view.kind === 'ai-offer' || view.kind === 'ai-pending' ? <AiModePill /> : undefined
        }
        listboxId={hasListbox ? LISTBOX_ID : undefined}
        expanded={hasListbox && count > 0}
        activeId={hasListbox && count > 0 ? optionId(selected) : undefined}
      />

      {view.kind === 'argument' ? (
        <div className="border-t [border-color:var(--cz-line-faint)]" onClick={() => run(0)}>
          <ArgumentCapture
            action={view.action}
            keyword={view.keyword}
            values={view.values}
            activeIndex={view.activeIndex}
          />
        </div>
      ) : view.kind === 'results' ? (
        <div className="border-t [border-color:var(--cz-line-faint)]">
          <ResultList
            listboxId={LISTBOX_ID}
            results={view.results}
            selected={selected}
            onSelect={run}
            onHover={setSelected}
          />
        </div>
      ) : view.kind === 'ai-offer' ? (
        <div className="border-t [border-color:var(--cz-line-faint)]">
          <AiOfferPanel
            query={view.query}
            listboxId={LISTBOX_ID}
            optionId={optionId}
            selected={selected}
            onRun={run}
            onHover={setSelected}
          />
        </div>
      ) : view.kind === 'ai-pending' ? (
        <div className="border-t [border-color:var(--cz-line-faint)]">
          <AiAnswerPanel
            pending
            pendingText={view.text}
            listboxId={LISTBOX_ID}
            optionId={optionId}
            selected={selected}
            onSelect={run}
            onHover={setSelected}
            isRunnable={isRunnable}
          />
        </div>
      ) : view.kind === 'ai-answer' ? (
        <div className="border-t [border-color:var(--cz-line-faint)]">
          <AiAnswerPanel
            answer={view.answer}
            listboxId={LISTBOX_ID}
            optionId={optionId}
            selected={selected}
            onSelect={run}
            onHover={setSelected}
            isRunnable={isRunnable}
          />
        </div>
      ) : view.kind === 'empty' ? (
        <div className="border-t [border-color:var(--cz-line-faint)]">
          <EmptyState
            title="No matching actions"
            hint="Try another keyword, or add one in the Console."
          />
        </div>
      ) : null}

      {feedback && <Toast message={feedback.message} error={feedback.error} />}

      <LauncherFooter
        onOpenConsole={openConsole}
        bordered={view.kind !== 'resting'}
        hints={footerHints}
      />
    </LauncherLayout>
  );
}
