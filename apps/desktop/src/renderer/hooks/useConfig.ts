import { useCallback, useEffect, useState } from 'react';
import type { Config } from '@cockpitzero/shared';
import { api } from '../lib/api.js';

/**
 * Loads the config once and exposes a `save` that persists through the main
 * process (which also re-registers the hotkey on change) and syncs local state
 * with the validated result.
 */
export function useConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api.getConfig().then(setConfig);
  }, []);

  const save = useCallback(async (next: Config) => {
    setSaving(true);
    try {
      const saved = await api.setConfig(next);
      setConfig(saved);
      return saved;
    } finally {
      setSaving(false);
    }
  }, []);

  return { config, setConfig, save, saving };
}
