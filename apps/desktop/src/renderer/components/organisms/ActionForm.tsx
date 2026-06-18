import { useState } from 'react';
import { ActionSchema, createId, type Action, type ActionKind } from '@cockpitzero/shared';
import { actionTypeLabel } from '../../lib/format.js';
import { Button } from '../atoms/Button.js';
import { Field } from '../atoms/Field.js';
import { Input } from '../atoms/Input.js';
import { Select } from '../atoms/Select.js';
import { Toggle } from '../atoms/Toggle.js';

/**
 * Create/edit form for a single action. Fields adapt to the discriminated
 * `type`, and an optional "argument" section configures Level-2 parameterization
 * (`{token}` substitution). On submit the draft is validated against the shared
 * ActionSchema so the GUI can never persist a malformed action.
 */

interface Draft {
  id: string;
  title: string;
  type: ActionKind;
  url: string;
  target: string;
  command: string;
  argsText: string;
  content: string;
  argEnabled: boolean;
  argName: string;
  argPlaceholder: string;
  argRequired: boolean;
}

function toDraft(action?: Action): Draft {
  return {
    id: action?.id ?? createId('act'),
    title: action?.title ?? '',
    type: action?.type ?? 'open-url',
    url: action?.type === 'open-url' ? action.url : '',
    target: action?.type === 'open-app' ? action.target : '',
    command: action?.type === 'run-command' ? action.command : '',
    argsText: action?.type === 'run-command' ? action.args.join('\n') : '',
    content: action?.type === 'snippet' ? action.content : '',
    argEnabled: action?.argument !== undefined,
    argName: action?.argument?.name ?? 'query',
    argPlaceholder: action?.argument?.placeholder ?? '',
    argRequired: action?.argument?.required ?? true,
  };
}

function buildAction(d: Draft): Action {
  const base = {
    id: d.id,
    title: d.title,
    ...(d.argEnabled
      ? {
          argument: {
            name: d.argName || 'query',
            placeholder: d.argPlaceholder || undefined,
            required: d.argRequired,
          },
        }
      : {}),
  };

  switch (d.type) {
    case 'open-url':
      return { ...base, type: 'open-url', url: d.url };
    case 'open-app':
      return { ...base, type: 'open-app', target: d.target };
    case 'run-command':
      return {
        ...base,
        type: 'run-command',
        command: d.command,
        args: d.argsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      };
    case 'snippet':
      return { ...base, type: 'snippet', content: d.content };
    default: {
      const _never: never = d.type;
      return _never;
    }
  }
}

const TYPE_OPTIONS: ActionKind[] = ['open-url', 'open-app', 'run-command', 'snippet'];

export function ActionForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Action;
  onSubmit: (action: Action) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function submit() {
    const parsed = ActionSchema.safeParse(buildAction(draft));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid action');
      return;
    }
    onSubmit(parsed.data);
  }

  const tokenHint = draft.argEnabled
    ? `Use {${draft.argName || 'query'}} in the fields below to insert the argument.`
    : undefined;

  return (
    <div className="space-y-5">
      <Field label="Title">
        <Input
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Open GitHub"
        />
      </Field>

      <Field label="Type">
        <Select value={draft.type} onChange={(e) => set('type', e.target.value as ActionKind)}>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {actionTypeLabel[t]}
            </option>
          ))}
        </Select>
      </Field>

      {draft.type === 'open-url' && (
        <Field label="URL" description={tokenHint}>
          <Input
            value={draft.url}
            onChange={(e) => set('url', e.target.value)}
            placeholder="https://www.npmjs.com/package/{query}"
          />
        </Field>
      )}

      {draft.type === 'open-app' && (
        <Field label="Application or path" description={tokenHint}>
          <Input
            value={draft.target}
            onChange={(e) => set('target', e.target.value)}
            placeholder="/Applications/Visual Studio Code.app"
          />
        </Field>
      )}

      {draft.type === 'run-command' && (
        <>
          <Field label="Command" description={tokenHint}>
            <Input
              value={draft.command}
              onChange={(e) => set('command', e.target.value)}
              placeholder="open"
            />
          </Field>
          <Field label="Arguments" description="One per line.">
            <textarea
              value={draft.argsText}
              onChange={(e) => set('argsText', e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-fg outline-none focus:border-accent"
              placeholder="-a&#10;Safari"
            />
          </Field>
        </>
      )}

      {draft.type === 'snippet' && (
        <Field label="Content" description={tokenHint}>
          <textarea
            value={draft.content}
            onChange={(e) => set('content', e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-fg outline-none focus:border-accent"
            placeholder="Text copied to the clipboard"
          />
        </Field>
      )}

      <div className="space-y-3 rounded-lg border border-border p-4">
        <Toggle
          checked={draft.argEnabled}
          onChange={(v) => set('argEnabled', v)}
          label="Accepts an argument (parameterized)"
        />
        {draft.argEnabled && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Token name">
              <Input value={draft.argName} onChange={(e) => set('argName', e.target.value)} />
            </Field>
            <Field label="Placeholder">
              <Input
                value={draft.argPlaceholder}
                onChange={(e) => set('argPlaceholder', e.target.value)}
                placeholder="package name"
              />
            </Field>
            <div className="col-span-2">
              <Toggle
                checked={draft.argRequired}
                onChange={(v) => set('argRequired', v)}
                label="Required"
              />
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <Button variant="primary" onClick={submit}>
          {initial ? 'Save changes' : 'Create action'}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
