import { createId, type Action, type Alias } from '@cockpitzero/shared';
import { actionSubtitle } from '../../lib/format.js';
import { Button } from '../atoms/Button.js';
import { EmptyState } from '../atoms/EmptyState.js';
import { ActionTypeBadge } from '../molecules/ActionTypeBadge.js';
import { Dropdown } from '../molecules/Dropdown.js';

/** Mono uppercase column header, per the design system's settings tables. */
function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={
        'border-b px-3.5 pb-3 text-left font-mono text-[10.5px] font-medium tracking-[var(--cz-tracking-label)] text-subtle uppercase [border-color:var(--cz-line-faint)] ' +
        (className ?? '')
      }
    >
      {children}
    </th>
  );
}

/**
 * Edits the keyword → action mappings as the design system's aliases table:
 * Alias (the mono keyword chip, editable in place) | Action | Type | Target.
 * A keyword is what the user types to trigger an action; for parameterized
 * actions it's also the Level-2 trigger (e.g. keyword `g` + a `{query}` action
 * → typing `g hello`).
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
  const actionOf = (actionId: string) => actions.find((a) => a.id === actionId);
  const titleOf = (actionId: string) => actionOf(actionId)?.title ?? '';

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
    <div className="space-y-4">
      {aliases.length === 0 ? (
        <EmptyState title="No aliases yet" hint="Add a keyword to trigger an action quickly." />
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>Alias</Th>
              <Th>Action</Th>
              <Th>Type</Th>
              <Th>Target</Th>
              <Th className="w-0" />
            </tr>
          </thead>
          <tbody>
            {aliases.map((alias) => {
              const action = actionOf(alias.actionId);
              return (
                <tr
                  key={alias.id}
                  className="group/tr border-b transition-colors duration-110 [border-color:var(--cz-line-faint)] hover:bg-surface-2"
                >
                  <td className="px-3.5 py-3">
                    <input
                      value={alias.keyword}
                      onChange={(e) => update(alias.id, { keyword: e.target.value })}
                      placeholder="keyword"
                      spellCheck={false}
                      autoComplete="off"
                      aria-label="Alias keyword"
                      className="w-24 rounded-[var(--cz-radius-sm)] border px-[11px] py-1 text-center font-mono text-[13px] font-medium text-[var(--cz-accent-bright)] outline-none [background:var(--cz-accent-soft)] [border-color:var(--cz-accent-line)] placeholder:font-normal placeholder:text-subtle focus:[box-shadow:var(--cz-ring-focus)]"
                    />
                  </td>
                  <td className="px-3.5 py-3">
                    <Dropdown
                      ariaLabel="Action"
                      className="min-w-44"
                      value={alias.actionId}
                      options={actions.map((a) => ({ value: a.id, label: a.title }))}
                      onChange={(v) => update(alias.id, { actionId: v, label: titleOf(v) })}
                    />
                  </td>
                  <td className="px-3.5 py-3">
                    {action && <ActionTypeBadge kind={action.type} />}
                  </td>
                  <td className="max-w-0 px-3.5 py-3">
                    <span className="block truncate font-mono text-[13px] text-muted">
                      {action ? actionSubtitle(action) : ''}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => remove(alias.id)}
                      className="opacity-0 transition-opacity group-hover/tr:opacity-100 focus-visible:opacity-100"
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <Button variant="primary" onClick={add}>
        Add alias
      </Button>
    </div>
  );
}
