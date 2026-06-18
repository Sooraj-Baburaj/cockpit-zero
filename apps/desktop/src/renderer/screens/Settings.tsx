import { useState } from 'react';
import type { Action, Settings as SettingsType } from '@cockpitzero/shared';
import { useConfig } from '../hooks/useConfig.js';
import { useTheme } from '../hooks/useTheme.js';
import { SettingsLayout } from '../components/templates/SettingsLayout.js';
import { SettingsPanel } from '../components/organisms/SettingsPanel.js';
import { ActionList } from '../components/organisms/ActionList.js';
import { ActionForm } from '../components/organisms/ActionForm.js';
import { AliasEditor } from '../components/organisms/AliasEditor.js';
import { WorkflowEditor } from '../components/organisms/WorkflowEditor.js';
import { Button } from '../components/atoms/Button.js';

const TABS = ['general', 'actions', 'aliases', 'workflows'];

/**
 * The settings / config-editor window — thin composition over `useConfig`.
 * Every change is persisted immediately through the main process (which also
 * re-registers the hotkey live). `useTheme` keeps the window's palette in sync.
 */
export function Settings() {
  const { config, setConfig, save } = useConfig();
  useTheme(config?.settings.theme);

  const [tab, setTab] = useState('general');
  const [editing, setEditing] = useState<Action | 'new' | null>(null);

  if (!config) {
    return <div className="p-8 text-muted">Loading…</div>;
  }

  const persist = (next: typeof config) => {
    setConfig(next);
    void save(next);
  };

  const updateSettings = (settings: SettingsType) => persist({ ...config, settings });

  const upsertAction = (action: Action) => {
    const exists = config.actions.some((a) => a.id === action.id);
    persist({
      ...config,
      actions: exists
        ? config.actions.map((a) => (a.id === action.id ? action : a))
        : [...config.actions, action],
    });
    setEditing(null);
  };

  const deleteAction = (action: Action) =>
    persist({
      ...config,
      actions: config.actions.filter((a) => a.id !== action.id),
      aliases: config.aliases.filter((al) => al.actionId !== action.id),
    });

  return (
    <SettingsLayout tabs={TABS} active={tab} onSelect={setTab}>
      {tab === 'general' && <SettingsPanel settings={config.settings} onChange={updateSettings} />}

      {tab === 'actions' &&
        (editing ? (
          <ActionForm
            initial={editing === 'new' ? undefined : editing}
            onSubmit={upsertAction}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Actions ({config.actions.length})</h2>
              <Button variant="primary" onClick={() => setEditing('new')}>
                New action
              </Button>
            </div>
            <ActionList actions={config.actions} onEdit={setEditing} onDelete={deleteAction} />
          </div>
        ))}

      {tab === 'aliases' && (
        <AliasEditor
          aliases={config.aliases}
          actions={config.actions}
          onChange={(aliases) => persist({ ...config, aliases })}
        />
      )}

      {tab === 'workflows' && (
        <WorkflowEditor
          workflows={config.workflows}
          actions={config.actions}
          onChange={(workflows) => persist({ ...config, workflows })}
        />
      )}
    </SettingsLayout>
  );
}
