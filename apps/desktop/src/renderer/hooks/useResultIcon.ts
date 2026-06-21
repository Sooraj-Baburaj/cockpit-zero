import { useEffect, useState } from 'react';
import type { LauncherItem } from '@cockpitzero/shared';
import { api } from '../lib/api.js';

/**
 * Resolves the best icon for a launcher row, as a data URL:
 *  - app / file results → the native OS icon (by path)
 *  - `open-app` actions → the target app's native icon
 *  - `open-url` actions → the site's favicon
 * Everything else (run-command / snippet / workflow) has no icon and falls back
 * to the thin-line kind glyph. Results are memoized in a module-level cache and
 * in-flight requests deduped, so the launcher extracts each icon at most once.
 */
const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

function iconRequest(item: LauncherItem): { key: string; load: () => Promise<string | null> } | null {
  if (item.kind === 'app' || item.kind === 'file') {
    const path = item.path;
    return { key: `file:${path}`, load: () => api.getFileIcon(path) };
  }
  if (item.kind === 'action') {
    if (item.action.type === 'open-app' && item.action.target) {
      const target = item.action.target;
      return { key: `file:${target}`, load: () => api.getFileIcon(target) };
    }
    if (item.action.type === 'open-url' && item.action.url) {
      const url = item.action.url;
      return { key: `favicon:${url}`, load: () => api.getFavicon(url) };
    }
  }
  return null;
}

export function useResultIcon(item: LauncherItem): string | null {
  const request = iconRequest(item);
  const key = request?.key;
  const [icon, setIcon] = useState<string | null>(() =>
    key && cache.has(key) ? (cache.get(key) ?? null) : null,
  );

  useEffect(() => {
    if (!request || !key) {
      setIcon(null);
      return;
    }
    if (cache.has(key)) {
      setIcon(cache.get(key) ?? null);
      return;
    }

    let active = true;
    let promise = pending.get(key);
    if (!promise) {
      promise = request
        .load()
        .then((data) => {
          cache.set(key, data);
          pending.delete(key);
          return data;
        })
        .catch(() => {
          pending.delete(key);
          return null;
        });
      pending.set(key, promise);
    }
    void promise.then((data) => {
      if (active) setIcon(data);
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return icon;
}
