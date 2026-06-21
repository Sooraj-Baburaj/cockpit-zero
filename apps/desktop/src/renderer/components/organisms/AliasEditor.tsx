import { createId, type Action, type Alias } from '@cockpitzero/shared';
import { Button } from '../atoms/Button.js';
import { EmptyState } from '../atoms/EmptyState.js';
import { Input } from '../atoms/Input.js';
import { Dropdown } from '../molecules/Dropdown.js';

/**
 * Edits the keyword → action mappings. A keyword is what the user types to
 * trigger an action; for parameterized actions it's also the Level-2 trigger
 * (e.g. keyword `g` + a `{query}` action → typing `g hello`).
 */
export function AliasEditor({
  aliases,
  actions,
  onChange,
}: {
  aliases: Alias[];
  actions: Action[];
  onChange: (aliases: Alias[]) => void;
}) {
  const titleOf = (actionId: string) => actions.find((a) => a.id === actionId)?.title ?? '';

  const update = (id: string, patch: Partial<Alias>) =>
    onChange(aliases.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const remove = (id: string) => onChange(aliases.filter((a) => a.id !== id));

  const add = () => {
    const first = actions[0];
    if (!first) return;
    onChange([
      ...aliases,
      { id: createId('al'), keyword: '', label: first.title, actionId: first.id },
    ]);
  };

  if (actions.length === 0) {
    return <EmptyState title="No actions to alias" hint="Create an action first." />;
  }

  return (
    <div className="space-y-3">
      {aliases.length === 0 && (
        <EmptyState title="No aliases yet" hint="Add a keyword to trigger an action quickly." />
      )}

      {aliases.map((alias) => (
        <div key={alias.id} className="flex items-center gap-2">
          <Input
            value={alias.keyword}
            onChange={(e) => update(alias.id, { keyword: e.target.value })}
            placeholder="keyword"
            className="w-40 font-mono"
          />
          <Dropdown
            ariaLabel="Action"
            className="flex-1"
            value={alias.actionId}
            options={actions.map((a) => ({ value: a.id, label: a.title }))}
            onChange={(v) => update(alias.id, { actionId: v, label: titleOf(v) })}
          />
          <Button variant="danger" size="sm" onClick={() => remove(alias.id)}>
            Remove
          </Button>
        </div>
      ))}

      <Button variant="primary" onClick={add}>
        Add alias
      </Button>
    </div>
  );
}
