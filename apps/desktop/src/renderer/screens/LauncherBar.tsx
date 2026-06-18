import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useLauncherSearch } from '../hooks/useLauncherSearch.js';
import { useKeyboardNav } from '../hooks/useKeyboardNav.js';
import { LauncherLayout } from '../components/templates/LauncherLayout.js';
import { SearchField } from '../components/molecules/SearchField.js';
import { LauncherFooter } from '../components/molecules/LauncherFooter.js';
import { ResultList } from '../components/organisms/ResultList.js';
import { ArgumentCapture } from '../components/organisms/ArgumentCapture.js';
import { EmptyState } from '../components/atoms/EmptyState.js';

/**
 * The frameless launcher bar — thin composition only. Search/argument logic
 * lives in `useLauncherSearch`, navigation in `useKeyboardNav`, and all data
 * access goes through `api` (the typed preload bridge).
 */
export function LauncherBar() {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const resolved = useLauncherSearch(query);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = resolved.kind === 'results' ? resolved.results : [];
  const count = resolved.kind === 'argument' ? 1 : results.length;

  const openSettings = () => {
    void api.openSettings();
    void api.hideLauncher();
  };

  const run = (index: number) => {
    if (resolved.kind === 'argument') {
      void api.runAction(resolved.action.id, resolved.argument);
      return;
    }
    const item = results[index];
    if (!item) return;
    switch (item.kind) {
      case 'action':
        void api.runAction(item.action.id);
        break;
      case 'workflow':
        void api.runWorkflow(item.workflow.id);
        break;
      case 'app':
      case 'file':
        void api.openPath(item.path);
        break;
    }
  };

  const { selected, setSelected, handleKeyDown } = useKeyboardNav({
    count,
    resetKey: query,
    onSelect: run,
    onClose: () => void api.hideLauncher(),
  });

  // ⌘, / Ctrl+, opens Settings from anywhere in the bar; everything else is nav.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      openSettings();
      return;
    }
    handleKeyDown(e);
  };

  return (
    <LauncherLayout>
      <SearchField inputRef={inputRef} value={query} onChange={setQuery} onKeyDown={onKeyDown} />

      {resolved.kind === 'argument' ? (
        <div className="border-t border-border" onClick={() => run(0)}>
          <ArgumentCapture
            action={resolved.action}
            keyword={resolved.keyword}
            argument={resolved.argument}
          />
        </div>
      ) : results.length > 0 ? (
        <div className="border-t border-border">
          <ResultList results={results} selected={selected} onSelect={run} onHover={setSelected} />
        </div>
      ) : query.trim() !== '' ? (
        <div className="border-t border-border">
          <EmptyState
            title="No matching actions"
            hint="Try another keyword, or add one in Settings."
          />
        </div>
      ) : null}

      <LauncherFooter onOpenSettings={openSettings} />
    </LauncherLayout>
  );
}
