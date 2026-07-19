import { useCallback, useEffect, useState } from 'react';
import {
  INTEGRATION_CAPABILITIES,
  INTEGRATION_SOURCE_IDS,
  integrationSourceLabel,
} from '@cockpitzero/shared';
import type { ConnectionStatus, IntegrationSourceId } from '@cockpitzero/shared';
import { api } from '../../lib/api.js';
import { cn } from '../../lib/cn.js';
import { Button } from '../atoms/Button.js';
import { Input } from '../atoms/Input.js';

/**
 * Console → Integrations (production P10). One card per connectable source:
 * connect via OAuth (system browser; enabled when the OAuth app credentials are
 * configured on this machine) or by pasting the service's long-lived credential
 * where that's a supported path. Shows the connected account, granted scopes,
 * and connect time; Disconnect revokes (best-effort) and clears the vault token.
 *
 * Tokens never reach this window — the bridge exposes only connect/disconnect
 * and metadata-only status (the same no-plaintext rule as the secrets vault).
 */
export function IntegrationsPanel() {
  const [statuses, setStatuses] = useState<ConnectionStatus[] | null>(null);
  const [busy, setBusy] = useState<IntegrationSourceId | null>(null);
  /** Local connect errors (per source) — status errors surface too. */
  const [errors, setErrors] = useState<Partial<Record<IntegrationSourceId, string>>>({});

  const refresh = useCallback(async () => {
    setStatuses(await api.connectionStatus());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = async (source: IntegrationSourceId, token?: string) => {
    setBusy(source);
    setErrors((e) => ({ ...e, [source]: undefined }));
    try {
      const res = await api.connectSource(source, token);
      if (!res.ok) setErrors((e) => ({ ...e, [source]: res.error ?? 'Connecting failed.' }));
      await refresh();
      return res.ok;
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (source: IntegrationSourceId) => {
    setBusy(source);
    setErrors((e) => ({ ...e, [source]: undefined }));
    try {
      await api.disconnectSource(source);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const statusOf = (source: IntegrationSourceId) => statuses?.find((s) => s.source === source);

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h1 className="text-[19px] leading-none font-semibold text-fg">
          Integrations
        </h1>
        <p className="mt-2 max-w-[62ch] text-[13px] text-muted">
          Connect real accounts so routines can pull your actual notifications and the assistant can
          act in your tools (always behind your approval). Credentials are encrypted in the OS
          keychain — they never sync and never leave this machine unencrypted.
        </p>
      </header>

      <div className="space-y-2.5">
        {INTEGRATION_SOURCE_IDS.map((source) => (
          <SourceCard
            key={source}
            source={source}
            status={statusOf(source)}
            busy={busy === source}
            error={errors[source] ?? statusOf(source)?.error}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        ))}
      </div>

      <footer className="mt-7 border-t [border-color:var(--cz-line-faint)] pt-4 text-[12.5px] text-subtle">
        OAuth connects need the matching COCKPITZERO_*_CLIENT_ID / _CLIENT_SECRET environment
        variables (your own OAuth app registration). Disconnect revokes access and clears the stored
        token.
      </footer>
    </div>
  );
}

function SourceCard({
  source,
  status,
  busy,
  error,
  onConnect,
  onDisconnect,
}: {
  source: IntegrationSourceId;
  status?: ConnectionStatus;
  busy: boolean;
  error?: string;
  onConnect: (source: IntegrationSourceId, token?: string) => Promise<boolean>;
  onDisconnect: (source: IntegrationSourceId) => Promise<void>;
}) {
  const [token, setToken] = useState('');
  const caps = INTEGRATION_CAPABILITIES[source];
  const connected = status?.connected ?? false;

  const connectToken = async () => {
    if (token.trim() === '') return;
    const ok = await onConnect(source, token.trim());
    if (ok) setToken('');
  };

  return (
    <div className="rounded-[var(--cz-radius-md)] border border-border px-[18px] py-[14px] [background:var(--cz-surface)] [box-shadow:var(--cz-shadow-sm)]">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="text-[14.5px] font-semibold text-fg">
              {integrationSourceLabel[source]}
            </span>
            <StatusPill connected={status ? connected : null} />
          </div>
          <div className="mt-1 truncate text-[12.5px] text-muted">
            {connected ? (
              <>
                {status?.account || 'Connected'}
                {status?.connectedAt ? ` · since ${formatDate(status.connectedAt)}` : ''}
                {status?.scopes && status.scopes.length > 0
                  ? ` · ${status.scopes.slice(0, 4).join(', ')}${status.scopes.length > 4 ? '…' : ''}`
                  : ''}
              </>
            ) : (
              connectHint(source, status)
            )}
          </div>
        </div>

        <div className="flex flex-none items-center gap-2">
          {connected ? (
            <Button variant="danger" size="sm" disabled={busy} onClick={() => onDisconnect(source)}>
              {busy ? 'Working…' : 'Disconnect'}
            </Button>
          ) : (
            caps.oauth && (
              <Button
                variant="primary"
                size="sm"
                disabled={busy || !status?.oauthReady}
                title={
                  status?.oauthReady
                    ? 'Opens your browser to authorize'
                    : 'Set the OAuth app env variables to enable'
                }
                onClick={() => void onConnect(source)}
              >
                {busy ? 'Waiting for browser…' : 'Connect'}
              </Button>
            )
          )}
        </div>
      </div>

      {!connected && caps.token && (
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void connectToken();
              }
            }}
            placeholder={caps.tokenHint ?? 'Paste a token…'}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            aria-label={`${integrationSourceLabel[source]} token`}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={busy || token.trim() === ''}
            onClick={() => void connectToken()}
          >
            Connect
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-[12.5px] [color:var(--cz-warn)]">{error}</p>}
    </div>
  );
}

/** What an unconnected card's sub-line says about how to connect. */
function connectHint(source: IntegrationSourceId, status?: ConnectionStatus): string {
  const caps = INTEGRATION_CAPABILITIES[source];
  if (caps.oauth && caps.token) {
    return status?.oauthReady
      ? 'Connect with OAuth, or paste a token below.'
      : 'Paste a token below (or configure the OAuth app to connect via browser).';
  }
  if (caps.oauth) {
    return status?.oauthReady
      ? 'Connect with OAuth — opens your browser to authorize.'
      : 'Needs the Google OAuth app env variables configured on this machine.';
  }
  return 'Paste the service credential below to connect.';
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Connected" / "Not connected" pill (neutral until the first status read). */
function StatusPill({ connected }: { connected: boolean | null }) {
  const label = connected === null ? 'Checking…' : connected ? 'Connected' : 'Not connected';
  return (
    <span className="inline-flex shrink-0 items-center gap-2 rounded-[var(--cz-radius-pill)] border border-border px-[11px] py-1 text-[11px] font-medium text-muted [background:var(--cz-surface)]">
      <span
        className={cn(
          'size-[7px] rounded-full',
          connected ? '[background:var(--cz-success)]' : '[background:var(--cz-fg-faint)]',
        )}
      />
      {label}
    </span>
  );
}
