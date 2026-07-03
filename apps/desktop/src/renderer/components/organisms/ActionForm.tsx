import { useState } from 'react';
import { ActionSchema, createId, type Action, type ActionKind } from '@cockpitzero/shared';
import { actionTypeLabel } from '../../lib/format.js';
import { Button } from '../atoms/Button.js';
import { Field } from '../atoms/Field.js';
import { Input } from '../atoms/Input.js';
import { PathField } from '../molecules/PathField.js';
import { Dropdown } from '../molecules/Dropdown.js';
import { Toggle } from '../atoms/Toggle.js';

/**
 * Create/edit form for a single action. Fields adapt to the discriminated
 * `type`, and an optional "argument" section configures Level-2 parameterization
 * (`{token}` substitution). On submit the draft is validated against the shared
 * ActionSchema so the GUI can never persist a malformed action.
 */

/** One editable parameter row (mirrors a shared `Argument`). */
interface ArgDraft {
  name: string;
  placeholder: string;
  required: boolean;
}

interface Draft {
  id: string;
  title: string;
  /** The keyword typed in the launcher to trigger this action (an alias). */
  keyword: string;
  type: ActionKind;
  url: string;
  target: string;
  command: string;
  argsText: string;
  content: string;
  argEnabled: boolean;
  /** Ordered parameters captured positionally in the launcher. */
  args: ArgDraft[];
}

function toDraft(action?: Action, keyword?: string): Draft {
  return {
    id: action?.id ?? createId('act'),
    title: action?.title ?? '',
    keyword: keyword ?? '',
    type: action?.type ?? 'open-url',
    url: action?.type === 'open-url' ? action.url : '',
    target: action?.type === 'open-app' ? action.target : '',
    command: action?.type === 'run-command' ? action.command : '',
    argsText: action?.type === 'run-command' ? action.args.join('\n') : '',
    content: action?.type === 'snippet' ? action.content : '',
    argEnabled: (action?.arguments?.length ?? 0) > 0,
    args:
      action?.arguments?.map((a) => ({
        name: a.name,
        placeholder: a.placeholder ?? '',
        required: a.required,
      })) ?? [],
  };
}

function buildAction(d: Draft): Action {
  const args = d.args
    .map((a) => ({
      name: a.name.trim(),
      placeholder: a.placeholder.trim() || undefined,
      required: a.required,
    }))
    .filter((a) => a.name !== '');
  const base = {
    id: d.id,
    title: d.title,
    ...(d.argEnabled && args.length > 0 ? { arguments: args } : {}),
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
  initialKeyword,
  onSubmit,
  onCancel,
}: {
  initial?: Action;
  /** Existing trigger keyword (alias) for the action being edited, if any. */
  initialKeyword?: string;
  onSubmit: (action: Action, keyword: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial, initialKeyword));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  /** Enabling parameterization seeds a first row so the editor isn't empty. */
  const setArgEnabled = (v: boolean) =>
    setDraft((d) => ({
      ...d,
      argEnabled: v,
      args:
        v && d.args.length === 0 ? [{ name: 'query', placeholder: '', required: true }] : d.args,
    }));
  const setArg = <K extends keyof ArgDraft>(index: number, key: K, value: ArgDraft[K]) =>
    setDraft((d) => ({
      ...d,
      args: d.args.map((a, i) => (i === index ? { ...a, [key]: value } : a)),
    }));
  const addArg = () =>
    setDraft((d) => ({ ...d, args: [...d.args, { name: '', placeholder: '', required: true }] }));
  const removeArg = (index: number) =>
    setDraft((d) => ({ ...d, args: d.args.filter((_, i) => i !== index) }));

  function submit() {
    const parsed = ActionSchema.safeParse(buildAction(draft));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid action');
      return;
    }
    onSubmit(parsed.data, draft.keyword.trim());
  }

  const argNames = draft.args.map((a) => a.name.trim()).filter(Boolean);
  const tokenHint =
    draft.argEnabled && argNames.length > 0
      ? `Use ${argNames.map((n) => `{${n}}`).join(' ')} in the fields below to insert ${
          argNames.length > 1 ? 'each argument' : 'the argument'
        }.`
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

      <Field
        label="Keyword"
        description={
          draft.argEnabled && argNames.length > 0
            ? `Type this in the launcher, then a space, then ${
                argNames.length > 1 ? 'each value in order' : `the ${argNames[0]}`
              } — e.g. “${draft.keyword || 'gh'} ${argNames.join(' ')}”.`
            : 'Optional shortcut typed in the launcher to run this action.'
        }
      >
        <Input
          value={draft.keyword}
          onChange={(e) => set('keyword', e.target.value)}
          placeholder="gh"
          className="max-w-48 font-mono"
        />
      </Field>

      <Field label="Type">
        <Dropdown
          ariaLabel="Action type"
          value={draft.type}
          options={TYPE_OPTIONS.map((t) => ({ value: t, label: actionTypeLabel[t] }))}
          onChange={(v) => set('type', v as ActionKind)}
          className="max-w-60"
        />
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
          <PathField
            value={draft.target}
            onChange={(v) => set('target', v)}
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
              className="cz-input resize-none font-mono"
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
            className="cz-input resize-none"
            placeholder="Text copied to the clipboard"
          />
        </Field>
      )}

      <div className="space-y-3 rounded-lg border border-border bg-surface-2 p-4">
        <Toggle
          checked={draft.argEnabled}
          onChange={setArgEnabled}
          label="Accepts arguments (parameterized)"
        />
        {draft.argEnabled && (
          <div className="space-y-3">
            {draft.args.map((arg, i) => (
              <div key={i} className="space-y-3 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">Parameter {i + 1}</span>
                  <Button variant="danger" size="sm" onClick={() => removeArg(i)}>
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Token name">
                    <Input
                      value={arg.name}
                      onChange={(e) => setArg(i, 'name', e.target.value)}
                      placeholder="query"
                    />
                  </Field>
                  <Field label="Placeholder">
                    <Input
                      value={arg.placeholder}
                      onChange={(e) => setArg(i, 'placeholder', e.target.value)}
                      placeholder="package name"
                    />
                  </Field>
                </div>
                <Toggle
                  checked={arg.required}
                  onChange={(v) => setArg(i, 'required', v)}
                  label="Required"
                />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addArg}>
              Add parameter
            </Button>
            {argNames.length > 0 && draft.keyword.trim() === '' && (
              <p className="text-xs text-[var(--cz-warn)]">
                Set a Keyword above so you can pass arguments from the launcher.
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--cz-danger)]">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="primary" onClick={submit}>
          {initial ? 'Save changes' : 'Create action'}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
