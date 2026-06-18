import { useEffect } from 'react';
import type { Settings } from '@cockpitzero/shared';

/**
 * Applies the chosen theme to the document root by toggling `theme-light` /
 * `theme-dark` (which swap the CSS-variable palette). `system` follows the OS
 * preference and updates live when it changes.
 */
export function useTheme(theme: Settings['theme'] | undefined) {
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      root.classList.toggle('theme-dark', dark);
      root.classList.toggle('theme-light', !dark);
    };

    apply();
    if (theme === 'system') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
  }, [theme]);
}
