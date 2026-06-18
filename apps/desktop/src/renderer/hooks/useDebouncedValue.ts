import { useEffect, useState } from 'react';

/** Returns `value` delayed by `delay` ms — smooths rapid keystrokes. */
export function useDebouncedValue<T>(value: T, delay = 60): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
