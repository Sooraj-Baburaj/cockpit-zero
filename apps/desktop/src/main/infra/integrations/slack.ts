import { WebClient } from '@slack/web-api';
import type {
  ConnectOutcome,
  Connector,
  StoredTokens,
} from '../../services/integrations/connector.js';
import type { RawItem } from '../../services/routines/source.js';
import { connectorError, oauthAppFor, runOAuthFlow } from './oauth.js';

/**
 * The Slack connector (production P10) — the first real integration, replacing
 * the Phase-5 mock source. All Slack API access goes through the official
 * `@slack/web-api` SDK (including the OAuth v2 code exchange and token-rotation
 * refresh — never hand-rolled). Connect paths:
 *
 *   - OAuth: system browser → `oauth.v2.authorize` (user scopes) → loopback →
 *     `oauth.v2.access`. Needs `COCKPITZERO_SLACK_CLIENT_ID/SECRET`.
 *   - Token paste: a user/bot token (`xoxp-…`/`xoxb-…`) validated via `auth.test`.
 *
 * Reads map recent DM/group-DM messages to digest `RawItem`s; the write action
 * (`slack.send`) posts via `chat.postMessage` and is only ever reached through
 * the agent runner's grant + review gates.
 */

/** Least-privilege user scopes: read DMs/group DMs + names, post messages. */
const USER_SCOPES = [
  'channels:read',
  'im:read',
  'im:history',
  'mpim:read',
  'mpim:history',
  'users:read',
  'chat:write',
];

const MAX_CONVERSATIONS = 8;
const MESSAGES_PER_CONVERSATION = 5;
const MAX_ITEMS = 20;
const MAX_TEXT = 300;

/** `auth.test` → a human account label + the team id for deep links. */
async function whoami(
  client: WebClient,
): Promise<{ label: string; teamId: string; userId: string }> {
  const res = await client.auth.test();
  const label = [res.user, res.team].filter(Boolean).join(' · ');
  return { label: label || 'Slack account', teamId: res.team_id ?? '', userId: res.user_id ?? '' };
}

function outcomeFromTokens(tokens: StoredTokens, label: string, scopes: string[]): ConnectOutcome {
  return { ok: true, tokens, accountLabel: label, scopes };
}

export const slackConnector: Connector = {
  id: 'slack',

  oauthReady() {
    return oauthAppFor('slack') !== null;
  },

  async connectOAuth(openExternal) {
    const app = oauthAppFor('slack');
    if (!app) return { ok: false, error: 'Slack OAuth app is not configured on this machine.' };
    return runOAuthFlow({
      openExternal,
      buildAuthorizeUrl: (redirectUri, state) => {
        const url = new URL('https://slack.com/oauth/v2/authorize');
        url.searchParams.set('client_id', app.clientId);
        url.searchParams.set('user_scope', USER_SCOPES.join(','));
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('state', state);
        return url.toString();
      },
      exchange: async (code, redirectUri) => {
        // The official SDK's OAuth helper — not a hand-rolled token exchange.
        const res = await new WebClient().oauth.v2.access({
          client_id: app.clientId,
          client_secret: app.clientSecret,
          code,
          redirect_uri: redirectUri,
        });
        const user = res.authed_user;
        if (!user?.access_token) {
          return { ok: false, error: 'Slack returned no user token.' };
        }
        const tokens: StoredTokens = {
          accessToken: user.access_token,
          ...(user.refresh_token ? { refreshToken: user.refresh_token } : {}),
          ...(user.expires_in ? { expiresAt: Date.now() + user.expires_in * 1000 } : {}),
        };
        const { label } = await whoami(new WebClient(tokens.accessToken));
        return outcomeFromTokens(tokens, label, user.scope?.split(',') ?? USER_SCOPES);
      },
    });
  },

  async connectToken(token) {
    try {
      const { label } = await whoami(new WebClient(token));
      return outcomeFromTokens({ accessToken: token }, label, []);
    } catch (err) {
      return { ok: false, error: connectorError(err, 'Slack rejected that token.') };
    }
  },

  async refresh(tokens) {
    const app = oauthAppFor('slack');
    if (!tokens.refreshToken || !app) return null;
    try {
      const res = await new WebClient().oauth.v2.access({
        client_id: app.clientId,
        client_secret: app.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
      });
      // Rotation responses carry the user token either nested or at the top level.
      const accessToken = res.authed_user?.access_token ?? res.access_token;
      const refreshToken = res.authed_user?.refresh_token ?? res.refresh_token;
      const expiresIn = res.authed_user?.expires_in ?? res.expires_in;
      if (!accessToken) return null;
      return {
        accessToken,
        ...(refreshToken ? { refreshToken } : {}),
        ...(expiresIn ? { expiresAt: Date.now() + expiresIn * 1000 } : {}),
      };
    } catch {
      return null;
    }
  },

  async revoke(tokens) {
    try {
      await new WebClient(tokens.accessToken).auth.revoke();
    } catch {
      /* best-effort — the vault token is cleared regardless */
    }
  },

  async fetchItems(accessToken, since) {
    const client = new WebClient(accessToken);
    const me = await whoami(client);

    const convos = await client.users.conversations({
      types: 'im,mpim',
      exclude_archived: true,
      limit: 20,
    });
    const channels = (convos.channels ?? []).slice(0, MAX_CONVERSATIONS);

    // Resolve sender display names once per user id.
    const names = new Map<string, string>();
    const senderName = async (userId: string): Promise<string> => {
      const cached = names.get(userId);
      if (cached) return cached;
      let name = userId;
      try {
        const info = await client.users.info({ user: userId });
        name = info.user?.profile?.real_name || info.user?.real_name || info.user?.name || userId;
      } catch {
        /* fall back to the id */
      }
      names.set(userId, name);
      return name;
    };

    const items: RawItem[] = [];
    for (const channel of channels) {
      if (!channel.id) continue;
      const history = await client.conversations.history({
        channel: channel.id,
        oldest: String(since / 1000),
        limit: MESSAGES_PER_CONVERSATION,
      });
      for (const msg of history.messages ?? []) {
        // Skip join/leave noise and our own sent messages — they're not notifications.
        if (msg.subtype || !msg.ts || !msg.text) continue;
        if (msg.user && msg.user === me.userId) continue;
        const who = msg.user ? await senderName(msg.user) : 'Slack';
        items.push({
          id: `slack-${channel.id}-${msg.ts}`,
          who,
          source: 'slack',
          text: msg.text.slice(0, MAX_TEXT),
          timestamp: Math.round(parseFloat(msg.ts) * 1000),
          openPath: me.teamId
            ? `https://app.slack.com/client/${me.teamId}/${channel.id}`
            : 'https://app.slack.com/client',
        });
      }
    }
    return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_ITEMS);
  },
};

/**
 * The `slack.send` write action. `channel` accepts a `#name` (resolved via
 * `conversations.list`) or a raw channel/user id. Only the agent runner calls
 * this, after the grant check and the human review gate.
 */
export async function slackSend(
  accessToken: string,
  input: { channel: string; text: string },
): Promise<{ ok: boolean; detail?: string; error?: string }> {
  try {
    const client = new WebClient(accessToken);
    let channel = input.channel.trim();
    if (channel.startsWith('#')) {
      const name = channel.slice(1);
      const list = await client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 200,
      });
      const match = (list.channels ?? []).find((c) => c.name === name);
      if (!match?.id) return { ok: false, error: `No Slack channel named “${channel}”.` };
      channel = match.id;
    }
    await client.chat.postMessage({ channel, text: input.text });
    return { ok: true, detail: `sent to ${input.channel}` };
  } catch (err) {
    return { ok: false, error: connectorError(err, 'Slack rejected the message.') };
  }
}
