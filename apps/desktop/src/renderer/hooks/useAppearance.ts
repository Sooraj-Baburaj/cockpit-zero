import { useEffect } from 'react';
import type { Settings } from '@cockpitzero/shared';

/**
 * Applies appearance settings to the document root for the current window:
 *  - theme → toggles `theme-light` / `theme-dark` (swapping the CSS-variable
 *    palette); `system` follows the OS preference and updates live.
 *  - glass → toggles `cz-no-glass`, which switches the launcher/settings panels
 *    between frosted translucency and solid surfaces.
 * Both windows call this so the look stays in sync with the saved config.
 */
export function useAppearance(
  theme: Settings['theme'] | undefined,
  glass: boolean | undefined,
): void {
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

  useEffect(() => {
    if (glass === undefined) return;
    document.documentElement.classList.toggle('cz-no-glass', !glass);
  }, [glass]);
}
