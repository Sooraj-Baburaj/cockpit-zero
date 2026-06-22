import type { ReactNode } from 'react';
import { Toggle } from '../atoms/Toggle.js';

/** One cell of the AI tool-grants grid: an icon chip, the tool's name + scope,
 *  and a toggle that grants/revokes it. Purely presentational — the parent maps
 *  the toggle through `setAiToolGrant`. */
export function ToolGrantCard({
  icon,
  name,
  scope,
  granted,
  onChange,
}: {
  icon: ReactNode;
  name: string;
  scope: string;
  granted: boolean;
  onChange: (granted: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--cz-radius-md)] border border-border [background:var(--cz-glass-1)] px-4 py-3.5 [box-shadow:var(--cz-shadow-sm)]">
      <span className="grid size-[34px] shrink-0 place-items-center rounded-[var(--cz-radius-md)] border border-border [background:var(--cz-glass-2)] text-muted">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold text-fg">{name}</div>
        <div className="mt-0.5 text-xs text-subtle">{scope}</div>
      </div>
      <span className="ml-auto">
        <Toggle checked={granted} onChange={onChange} ariaLabel={`${name} — ${scope}`} />
      </span>
    </div>
  );
}
