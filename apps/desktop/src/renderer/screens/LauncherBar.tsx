import { useEffect, useRef, useState } from 'react';
import { hasArgument, type Config } from '@cockpitzero/shared';
import { api } from '../lib/api.js';
import { useLauncherSearch } from '../hooks/useLauncherSearch.js';
import { useKeyboardNav } from '../hooks/useKeyboardNav.js';
import { useAppearance } from '../hooks/useAppearance.js';
import { LauncherLayout } from '../components/templates/LauncherLayout.js';
import { SearchField } from '../components/molecules/SearchField.js';
import { LauncherFooter } from '../components/molecules/LauncherFooter.js';
import { Toast } from '../components/molecules/Toast.js';
import { ResultList } from '../components/organisms/ResultList.js';
import { ArgumentCapture } from '../components/organisms/ArgumentCapture.js';
import { EmptyState } from '../components/atoms/EmptyState.js';

interface Feedback {
  message: string;
  error: boolean;
}

/** ARIA wiring: the results listbox id and a stable per-row option id. */
const LISTBOX_ID = 'cz-results';
const optionId = (index: number) => `cz-opt-${index}`;

/**
 * The frameless launcher bar — thin composition only. Search/argument logic
 * lives in `useLauncherSearch`, navigation in `useKeyboardNav`, and all data
 * access goes through `api` (the typed preload bridge). The bar fetches config
 * once for appearance (theme/glass) and alias lookup (Tab-to-drill).
 */
export function LauncherBar() {
  const [query, setQuery] = useState('');
  const [config, setConfig] = useState<Config | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resolved = useLauncherSearch(query);

  useEffect(() => {
    inputRef.current?.focus();
    void api.getConfig().then(setConfig);
  }, []);

  useAppearance(config?.settings.theme, config?.settings.glass);

  const results = resolved.kind === 'results' ? resolved.results : [];
  const count = resolved.kind === 'argument' ? 1 : results.length;
  const hasBody = resolved.kind === 'argument' || results.length > 0 || query.trim() !== '';

  const openSettings = () => {
    void api.openSettings();
    void api.hideLauncher();
  };

  /** Run a row (or the argument-capture action). A parameterized action drills
   *  into argument entry instead of running. On success the launcher just hides
   *  itself (no confirmation toast); only a failure surfaces feedback. */
  const run = (index: number) => {
    if (resolved.kind === 'results') {
      const item = results[index];
      if (!item) return;
      if (tryDrill(item)) return;
    }

    const job =
      resolved.kind === 'argument'
        ? { exec: () => api.runAction(resolved.action.id, resolved.values) }
        : resultJob(index);
    if (!job) return;

    void job.exec().then((res) => {
      if (res.ok) {
        void api.hideLauncher();
        setQuery('');
      } else {
        setFeedback({ message: res.error ?? 'Could not run', error: true });
        window.setTimeout(() => setFeedback(null), 2500);
      }
    });
  };

  const resultJob = (index: number) => {
    const item = results[index];
    if (!item) return null;
    switch (item.kind) {
      case 'action':
        return { exec: () => api.runAction(item.action.id) };
      case 'workflow':
        return { exec: () => api.runWorkflow(item.workflow.id) };
      case 'app':
      case 'file':
        return { exec: () => api.openPath(item.path) };
    }
  };

  const { selected, setSelected, handleKeyDown } = useKeyboardNav({
    count,
    resetKey: query,
    onSelect: run,
    onClose: () => void api.hideLauncher(),
  });

  /** Drill a parameterized action into argument capture by pre-filling its
   *  keyword (so a {query} action with keyword `gh` → `gh `). Returns false when
   *  the item isn't a parameterized action or has no keyword to trigger it. */
  const tryDrill = (item: (typeof results)[number] | undefined): boolean => {
    if (item?.kind !== 'action' || !hasArgument(item.action)) return false;
    const keyword = config?.aliases.find((a) => a.actionId === item.action.id)?.keyword;
    if (!keyword) return false;
    setQuery(`${keyword} `);
    return true;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // ⌘, / Ctrl+, opens Settings.
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      openSettings();
      return;
    }
    // ⌘1–9 / Ctrl+1–9 runs the Nth result.
    if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
      const index = Number(e.key) - 1;
      if (resolved.kind === 'results' && index < results.length) {
        e.preventDefault();
        run(index);
        return;
      }
    }
    // Tab drills the selected parameterized action into argument entry.
    if (e.key === 'Tab') {
      if (resolved.kind === 'results' && tryDrill(results[selected])) e.preventDefault();
      return;
    }
    // Two-stage Escape: first clears a non-empty query, then closes.
    if (e.key === 'Escape' && query !== '') {
      e.preventDefault();
      setQuery('');
      return;
    }
    handleKeyDown(e);
  };

  return (
    <LauncherLayout>
      <SearchField
        inputRef={inputRef}
        value={query}
        onChange={setQuery}
        onKeyDown={onKeyDown}
        listboxId={LISTBOX_ID}
        expanded={results.length > 0}
        activeId={results.length > 0 ? optionId(selected) : undefined}
      />

      {resolved.kind === 'argument' ? (
        <div className="border-t [border-color:var(--cz-line-faint)]" onClick={() => run(0)}>
          <ArgumentCapture
            action={resolved.action}
            keyword={resolved.keyword}
            values={resolved.values}
            activeIndex={resolved.activeIndex}
          />
        </div>
      ) : results.length > 0 ? (
        <div className="border-t [border-color:var(--cz-line-faint)]">
          <ResultList
            listboxId={LISTBOX_ID}
            results={results}
            selected={selected}
            onSelect={run}
            onHover={setSelected}
          />
        </div>
      ) : query.trim() !== '' ? (
        <div className="border-t [border-color:var(--cz-line-faint)]">
          <EmptyState
            title="No matching actions"
            hint="Try another keyword, or add one in Settings."
          />
        </div>
      ) : null}

      {feedback && <Toast message={feedback.message} error={feedback.error} />}

      <LauncherFooter onOpenSettings={openSettings} bordered={hasBody} />
    </LauncherLayout>
  );
}
