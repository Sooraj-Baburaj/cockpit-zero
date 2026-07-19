import { useEffect } from 'react';
import type { Settings } from '@cockpitzero/shared';

/**
 * Applies appearance settings to the document root for the current window:
 *  - theme → sets `data-theme="light" | "dark"` on <html>; `system` removes the
 *    attribute so `color-scheme: light dark` follows the OS (every colour token
 *    is authored with light-dark(), so no JS media listener is needed).
 *  - glass → toggles `cz-no-glass`, which switches the launcher panel between
 *    frosted translucency and the opaque facet surface (launcher-only; all
 *    other windows are always opaque).
 *  - monochrome → toggles `cz-mono`, remapping the accent family to neutral.
 *  - sidebarAccent → toggles `cz-sideacc`, restoring the orange accent on the
 *    Console sidebar while monochrome is on.
 * Every window calls this so the look stays in sync with the saved config.
 */
export function useAppearance(settings: Settings | undefined): void {
  const theme = settings?.theme;
  const glass = settings?.glass;
  const monochrome = settings?.monochrome;
  const sidebarAccent = settings?.sidebarAccent;

  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (glass === undefined) return;
    document.documentElement.classList.toggle('cz-no-glass', !glass);
  }, [glass]);

  useEffect(() => {
    if (monochrome === undefined) return;
    document.documentElement.classList.toggle('cz-mono', monochrome);
  }, [monochrome]);

  useEffect(() => {
    if (sidebarAccent === undefined) return;
    document.documentElement.classList.toggle('cz-sideacc', sidebarAccent);
  }, [sidebarAccent]);
}
