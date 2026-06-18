import { useCallback, useEffect, useState } from 'react';

interface Options {
  /** Number of selectable items. */
  count: number;
  /** Changing this resets the selection to the top (e.g. the current query). */
  resetKey: string;
  /** Activate the item at `index` (Enter / click). */
  onSelect: (index: number) => void;
  /** Dismiss the list (Escape). */
  onClose: () => void;
}

/**
 * Arrow-key list navigation for the launcher: ↑/↓ move the selection, Enter
 * activates it, Escape closes. Keeps the selection within bounds as the list
 * changes and snaps back to the top on a new query.
 */
export function useKeyboardNav({ count, resetKey, onSelect, onClose }: Options) {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [resetKey]);
  useEffect(() => setSelected((s) => Math.min(s, Math.max(count - 1, 0))), [count]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, Math.max(count - 1, 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (count > 0) onSelect(selected);
      }
    },
    [count, selected, onSelect, onClose],
  );

  return { selected, setSelected, handleKeyDown };
}
