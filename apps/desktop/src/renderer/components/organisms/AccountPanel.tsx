import { useCallback, useEffect, useState } from 'react';
import type { AccountStatus, Config, OAuthProvider } from '@cockpitzero/shared';
import { api } from '../../lib/api.js';
import { cn } from '../../lib/cn.js';
import { Button } from '../atoms/Button.js';
import { Field } from '../atoms/Field.js';
import { Input } from '../atoms/Input.js';

/**
 * Console → Account (production P7). The optional backend account: sign in
 * (OAuth via the system browser, or email/password inline) to sync the Console
 * config across devices. **Login is optional by design** — the panel leads with
 * that, and every other surface works signed-out. The session token never
 * reaches this window: sign-in resolves ok/error over IPC and the token lands
 * in the main-process vault.
 */
export function AccountPanel({ onApplyConfig }: { onApplyConfig: (config: Config) => void }) {
  // null = status not yet loaded (avoids flashing the signed-out form).
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmingPull, setConfirmingPull] = useState(false);

  const refresh = useCallback(() => void api.authStatus().then(setStatus), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Run one account action with busy/error bookkeeping. */
  const run = async (key: string, action: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      if (!result.ok) setError(result.error ?? 'Something went wrong.');
      return result.ok;
    } finally {
      setBusy(null);
    }
  };

  const signInPassword = (create: boolean) =>
    run(create ? 'create' : 'password', async () => {
      const ok = await api.signIn('password', { email, password, create });
      if (ok.ok) {
        setPassword('');
        refresh();
        if (create) setNotice('Account created — check your inbox to verify your email.');
      }
      return ok;
    });

  const signInOAuth = (provider: OAuthProvider) =>
    run(provider, async () => {
      const ok = await api.signIn(provider);
      if (ok.ok) refresh();
      return ok;
    });

  const signOut = async () => {
    if (busy) return;
    setBusy('signout');
    setError(null);
    setNotice(null);
    try {
      await api.signOut();
      setConfirmingPull(false);
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const push = () =>
    run('push', async () => {
      const result = await api.syncPush();
      if (result.ok) setNotice('Synced — your config is up to date in the cloud.');
      return result;
    });

  const pull = () =>
    run('pull', async () => {
      const result = await api.syncPull();
      if (!result.ok) return result;
      setConfirmingPull(false);
      if (result.config === null) {
        setNotice('Nothing in the cloud yet — push from this device first.');
      } else {
        onApplyConfig(result.config);
        setNotice('Cloud config applied on this device.');
      }
      return result;
    });

  const canSubmit = email.trim() !== '' && password !== '' && !busy;

  return (
    <div className="max-w-[560px] space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Account</h2>
        <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-muted">
          <strong className="font-medium text-fg">Optional.</strong> CockpitZero is fully usable
          without an account — everything stays on this device. Sign in only if you want your
          actions, aliases, and workflows synced across devices.
        </p>
      </div>

      {status === null ? (
        <div className="text-sm text-muted">Checking session…</div>
      ) : status.signedIn ? (
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[14.5px] font-semibold text-fg">{status.email}</div>
              <div className="mt-[3px] text-[13px] text-muted">Signed in</div>
            </div>
            <PlanPill plan={status.plan} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="dark" onClick={() => void push()} disabled={busy !== null}>
              {busy === 'push' ? 'Syncing…' : 'Sync now'}
            </Button>
            {confirmingPull ? (
              <>
                <Button variant="danger" onClick={() => void pull()} disabled={busy !== null}>
                  {busy === 'pull' ? 'Pulling…' : 'Replace local config'}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingPull(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => setConfirmingPull(true)}
                disabled={busy !== null}
              >
                Pull from cloud
              </Button>
            )}
            <span className="flex-1" />
            <Button variant="danger" onClick={() => void signOut()} disabled={busy !== null}>
              {busy === 'signout' ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
          {confirmingPull && (
            <p className="mt-2 text-[12.5px] text-muted">
              Pulling replaces this device’s config with the cloud copy.
            </p>
          )}
        </Card>
      ) : (
        <Card>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => void signInOAuth('google')}
              disabled={busy !== null}
            >
              {busy === 'google' ? 'Waiting for the browser…' : 'Continue with Google'}
            </Button>
            <Button
              variant="outline"
              onClick={() => void signInOAuth('github')}
              disabled={busy !== null}
            >
              {busy === 'github' ? 'Waiting for the browser…' : 'Continue with GitHub'}
            </Button>
          </div>

          <div className="my-4 flex items-center gap-3 text-[12px] text-muted">
            <span className="h-px flex-1 [background:var(--cz-line-faint)]" />
            or with email
            <span className="h-px flex-1 [background:var(--cz-line-faint)]" />
          </div>

          <div className="space-y-3">
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                spellCheck={false}
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) {
                    e.preventDefault();
                    void signInPassword(false);
                  }
                }}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Field>
            <div className="flex items-center gap-2">
              <Button
                variant="dark"
                onClick={() => void signInPassword(false)}
                disabled={!canSubmit}
              >
                {busy === 'password' ? 'Signing in…' : 'Sign in'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => void signInPassword(true)}
                disabled={!canSubmit}
              >
                {busy === 'create' ? 'Creating…' : 'Create account'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {error && <p className="text-[12.5px] [color:var(--cz-danger)]">{error}</p>}
      {notice && <p className="text-[12.5px] [color:var(--cz-success)]">{notice}</p>}
    </div>
  );
}

/** The shared warm-surface card, matching SecretField's container. */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--cz-radius-md)] border border-border [background:var(--cz-glass-1)] px-[18px] py-[15px] [box-shadow:var(--cz-shadow-sm)]">
      {children}
    </div>
  );
}

/** Plan badge — `free` stays quiet; `pro` gets the accent dot. */
function PlanPill({ plan }: { plan: 'free' | 'pro' }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 rounded-[var(--cz-radius-full)] border border-border [background:var(--cz-glass-1)] px-[13px] py-1.5 text-xs font-medium text-muted [box-shadow:var(--cz-shadow-sm)]">
      <span
        className={cn(
          'size-[7px] rounded-full',
          plan === 'pro' ? '[background:var(--cz-accent)]' : '[background:var(--cz-fg-faint)]',
        )}
      />
      {plan === 'pro' ? 'Pro' : 'Free plan'}
    </span>
  );
}
