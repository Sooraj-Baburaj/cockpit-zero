import { useState } from 'react';
import {
  createId,
  type Action,
  type Alias,
  type DraftMaterialization,
  type Routine,
  type Settings as SettingsType,
} from '@cockpitzero/shared';
import { api } from '../lib/api.js';
import { useConfig } from '../hooks/useConfig.js';
import { useAppearance } from '../hooks/useAppearance.js';
import { ConsoleLayout } from '../components/templates/ConsoleLayout.js';
import { ConsolePanel } from '../components/organisms/ConsolePanel.js';
import { AppearancePanel } from '../components/organisms/AppearancePanel.js';
import { AiPanel } from '../components/organisms/AiPanel.js';
import { MemoryPanel } from '../components/organisms/MemoryPanel.js';
import { AccountPanel } from '../components/organisms/AccountPanel.js';
import { RoutinesPanel } from '../components/organisms/RoutinesPanel.js';
import { YamlConfigEditor } from '../components/organisms/YamlConfigEditor.js';
import { ActionList } from '../components/organisms/ActionList.js';
import { ActionForm } from '../components/organisms/ActionForm.js';
import { AliasEditor } from '../components/organisms/AliasEditor.js';
import { WorkflowEditor } from '../components/organisms/WorkflowEditor.js';
import { Button } from '../components/atoms/Button.js';
import { CONSOLE_TABS, INITIAL_CONSOLE_TAB } from './console-tabs.js';

/**
 * The Console / config-editor window — thin composition over `useConfig`.
 * Every change is persisted immediately through the main process (which also
 * re-registers the hotkey live). `useAppearance` keeps the window's palette and
 * frosted-glass in sync with the saved config.
 */
export function Console() {
  const { config, setConfig, save } = useConfig();
  useAppearance(config?.settings.theme, config?.settings.glass);

  const [tab, setTab] = useState<string>(INITIAL_CONSOLE_TAB);
  const [editing, setEditing] = useState<Action | 'new' | null>(null);

  if (!config) {
    return <div className="p-8 text-muted">Loading…</div>;
  }

  const persist = (next: typeof config) => {
    setConfig(next);
    void save(next);
  };

  const updateSettings = (settings: SettingsType) => persist({ ...config, settings });

  /** The action's primary trigger keyword, shown/edited inline in the form. */
  const keywordOf = (actionId: string) =>
    config.aliases.find((a) => a.actionId === actionId)?.keyword ?? '';

  const upsertAction = (action: Action, keyword: string) => {
    const exists = config.actions.some((a) => a.id === action.id);
    const actions = exists
      ? config.actions.map((a) => (a.id === action.id ? action : a))
      : [...config.actions, action];

    // Sync the inline keyword to the action's primary alias.
    const primary = config.aliases.find((a) => a.actionId === action.id);
    let aliases: Alias[];
    if (keyword === '') {
      aliases = primary ? config.aliases.filter((a) => a.id !== primary.id) : config.aliases;
    } else if (primary) {
      aliases = config.aliases.map((a) =>
        a.id === primary.id ? { ...a, keyword, label: action.title } : a,
      );
    } else {
      aliases = [
        ...config.aliases,
        { id: createId('al'), keyword, label: action.title, actionId: action.id },
      ];
    }

    persist({ ...config, actions, aliases });
    setEditing(null);
  };

  const deleteAction = (action: Action) =>
    persist({
      ...config,
      actions: config.actions.filter((a) => a.id !== action.id),
      aliases: config.aliases.filter((al) => al.actionId !== action.id),
    });

  /** Save an AI-drafted workflow: append its new step actions + the workflow. */
  const saveWorkflowDraft = ({ actions, workflow }: DraftMaterialization) =>
    persist({
      ...config,
      actions: [...config.actions, ...actions],
      workflows: [...config.workflows, workflow],
    });

  return (
    <ConsoleLayout tabs={CONSOLE_TABS} active={tab} onSelect={setTab}>
      {tab === 'general' && <ConsolePanel settings={config.settings} onChange={updateSettings} />}

      {tab === 'ai' && <AiPanel ai={config.ai} onSave={(ai) => persist({ ...config, ai })} />}

      {tab === 'memory' && (
        <MemoryPanel ai={config.ai} onSaveAi={(ai) => persist({ ...config, ai })} />
      )}

      {tab === 'routines' && (
        <RoutinesPanel
          routines={config.routines}
          onChange={(routines: Routine[]) => persist({ ...config, routines })}
          onRun={(routineId) => api.runRoutine(routineId)}
        />
      )}

      {tab === 'config' && <YamlConfigEditor config={config} onSave={persist} />}

      {tab === 'account' && <AccountPanel onApplyConfig={persist} />}

      {tab === 'appearance' && (
        <AppearancePanel settings={config.settings} onChange={updateSettings} />
      )}

      {tab === 'actions' &&
        (editing ? (
          <ActionForm
            initial={editing === 'new' ? undefined : editing}
            initialKeyword={editing === 'new' ? undefined : keywordOf(editing.id)}
            onSubmit={upsertAction}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Actions ({config.actions.length})</h2>
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
          aiAvailable={config.ai.enabled}
          onChange={(workflows) => persist({ ...config, workflows })}
          onSaveDraft={saveWorkflowDraft}
        />
      )}
    </ConsoleLayout>
  );
}
