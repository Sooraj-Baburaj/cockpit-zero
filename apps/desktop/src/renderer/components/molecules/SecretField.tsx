import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { cn } from '../../lib/cn.js';
import { Input } from '../atoms/Input.js';
import { Button } from '../atoms/Button.js';

/**
 * A reusable **masked secret field** for the Console (production Phase 2). Backs
 * a single named secret in the OS-keychain-backed vault — a password input plus
 * Save / Clear and a status pill driven by `secretStatus()`. P3's BYOP provider
 * panel reuses this for the per-provider API key.
 *
 * It can show whether a value is **set** (`••••• set`) but can **never reveal**
 * the stored value: there is no `getSecret` path to the renderer by design, so
 * the input always starts empty and "Save" replaces rather than edits. When
 * secure storage is unavailable (e.g. Linux without a keyring), a save resolves
 * `{ ok: false }` and the field warns instead of pretending it stored anything.
 */
export function SecretField({
  name,
  label,
  description,
  placeholder = 'Paste a key…',
  onStatusChange,
}: {
  /** The vault key — build it with `SecretName.*` (shared), never a raw string. */
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  /** Notified after a successful save/clear with the new present state (optional). */
  onStatusChange?: (present: boolean) => void;
}) {
  // null = status not yet loaded (avoids a flash of "Not set" before the first read).
  const [present, setPresent] = useState<boolean | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const refresh = useCallback(async () => {
    const status = await api.secretStatus();
    setPresent(!!status[name]);
  }, [name]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async () => {
    const trimmed = value.trim();
    if (trimmed === '' || busy) return;
    setBusy(true);
    try {
      const { ok } = await api.setSecret(name, trimmed);
      setUnavailable(!ok);
      if (ok) {
        setValue('');
        setPresent(true);
        onStatusChange?.(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.clearSecret(name);
      setValue('');
      setUnavailable(false);
      setPresent(false);
      onStatusChange?.(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[var(--cz-radius-md)] border border-border [background:var(--cz-glass-1)] px-[18px] py-[13px] [box-shadow:var(--cz-shadow-sm)]">
      <div className="mb-2.5 flex items-center justify-between gap-4">
        <div>
          <div className="text-[14.5px] font-semibold text-fg">{label}</div>
          {description && (
            <div className="mt-[3px] max-w-[52ch] text-[13px] text-muted">{description}</div>
          )}
        </div>
        <StatusPill present={present} />
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void save();
            }
          }}
          placeholder={present ? '••••••••••••  (set — paste to replace)' : placeholder}
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          aria-label={label}
        />
        <Button variant="dark" onClick={() => void save()} disabled={value.trim() === '' || busy}>
          Save
        </Button>
        <Button variant="danger" onClick={() => void clear()} disabled={!present || busy}>
          Clear
        </Button>
      </div>

      {unavailable && (
        <p className="mt-2 text-[12.5px] [color:var(--cz-warn)]">
          Secure storage isn’t available on this machine, so keys can’t be saved. CockpitZero never
          stores a key unencrypted.
        </p>
      )}
    </div>
  );
}

/** "Set" / "Not set" pill, mirroring the AI panel's connection chip. Stays
 *  neutral until the first status read so it never flashes a misleading state. */
function StatusPill({ present }: { present: boolean | null }) {
  const label = present === null ? 'Checking…' : present ? '••••• set' : 'Not set';
  return (
    <span className="inline-flex shrink-0 items-center gap-2 rounded-[var(--cz-radius-full)] border border-border [background:var(--cz-glass-1)] px-[13px] py-1.5 text-xs font-medium text-muted [box-shadow:var(--cz-shadow-sm)]">
      <span
        className={cn(
          'size-[7px] rounded-full',
          present ? '[background:var(--cz-success)]' : '[background:var(--cz-fg-faint)]',
        )}
      />
      {label}
    </span>
  );
}
