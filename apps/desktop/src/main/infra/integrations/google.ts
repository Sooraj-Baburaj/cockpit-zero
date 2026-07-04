import { google } from 'googleapis';
import type { Connector, StoredTokens } from '../../services/integrations/connector.js';
import type { RawItem } from '../../services/routines/source.js';
import { connectorError, oauthAppFor, runOAuthFlow } from './oauth.js';

/**
 * The Google connectors (production P10): **Gmail** (digest notification source,
 * read-only) and **Google Calendar** (the agent's `calendar.create-event` write
 * tool). Both ride the official `googleapis` SDK — its `OAuth2` client does the
 * authorize-URL, code exchange, refresh, and revoke (never hand-rolled). They
 * share one OAuth app (`COCKPITZERO_GOOGLE_CLIENT_ID/SECRET`, a "Desktop app"
 * client, which supports the 127.0.0.1 loopback redirect) but connect
 * separately with least-privilege scopes. Google issues no pasteable long-lived
 * tokens, so OAuth is the only connect path.
 */

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];
const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

const MAX_MESSAGES = 12;
const MAX_TEXT = 300;

function authed(accessToken: string) {
  const client = new google.auth.OAuth2();
  client.setCredentials({ access_token: accessToken });
  return client;
}

/** Decode the handful of HTML entities Gmail snippets carry. */
function decodeSnippet(snippet: string): string {
  return snippet
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** "Jane Doe <jane@x.com>" → "Jane Doe"; bare addresses pass through. */
function fromName(from: string): string {
  const match = /^"?([^"<]+?)"?\s*</.exec(from);
  return (match?.[1] ?? from).trim() || 'Gmail';
}

function createGoogleConnector(id: 'gmail' | 'calendar', scopes: string[]): Connector {
  return {
    id,

    oauthReady() {
      return oauthAppFor('google') !== null;
    },

    async connectOAuth(openExternal) {
      const app = oauthAppFor('google');
      if (!app) return { ok: false, error: 'Google OAuth app is not configured on this machine.' };
      return runOAuthFlow({
        openExternal,
        buildAuthorizeUrl: (redirectUri, state) =>
          new google.auth.OAuth2(app.clientId, app.clientSecret, redirectUri).generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: scopes,
            state,
          }),
        exchange: async (code, redirectUri) => {
          const client = new google.auth.OAuth2(app.clientId, app.clientSecret, redirectUri);
          const { tokens } = await client.getToken(code);
          if (!tokens.access_token) return { ok: false, error: 'Google returned no token.' };
          client.setCredentials(tokens);
          let account = 'Google account';
          try {
            const { data } = await google.oauth2({ version: 'v2', auth: client }).userinfo.get();
            if (data.email) account = data.email;
          } catch {
            /* the connection still works without the label */
          }
          return {
            ok: true,
            tokens: {
              accessToken: tokens.access_token,
              ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
              ...(tokens.expiry_date ? { expiresAt: tokens.expiry_date } : {}),
            },
            accountLabel: account,
            scopes: tokens.scope?.split(' ') ?? scopes,
          };
        },
      });
    },

    async connectToken() {
      return {
        ok: false,
        error: 'Google connections use OAuth — there is no pasteable long-lived token.',
      };
    },

    async refresh(tokens: StoredTokens) {
      const app = oauthAppFor('google');
      if (!tokens.refreshToken || !app) return null;
      try {
        const client = new google.auth.OAuth2(app.clientId, app.clientSecret);
        client.setCredentials({ refresh_token: tokens.refreshToken });
        const { token } = await client.getAccessToken(); // refreshes under the hood
        if (!token) return null;
        return {
          accessToken: token,
          refreshToken: tokens.refreshToken,
          ...(client.credentials.expiry_date ? { expiresAt: client.credentials.expiry_date } : {}),
        };
      } catch {
        return null;
      }
    },

    async revoke(tokens) {
      try {
        await new google.auth.OAuth2().revokeToken(tokens.refreshToken ?? tokens.accessToken);
      } catch {
        /* best-effort — the vault token is cleared regardless */
      }
    },

    // Only Gmail is a notification source; Calendar is write-only (the agent tool).
    ...(id === 'gmail'
      ? {
          async fetchItems(accessToken: string, since: number): Promise<RawItem[]> {
            const gmail = google.gmail({ version: 'v1', auth: authed(accessToken) });
            const list = await gmail.users.messages.list({
              userId: 'me',
              q: `in:inbox after:${Math.floor(since / 1000)}`,
              maxResults: 20,
            });
            const refs = (list.data.messages ?? []).slice(0, MAX_MESSAGES);
            const items: RawItem[] = [];
            for (const ref of refs) {
              if (!ref.id) continue;
              const { data } = await gmail.users.messages.get({
                userId: 'me',
                id: ref.id,
                format: 'metadata',
                metadataHeaders: ['From', 'Subject'],
              });
              const headers = data.payload?.headers ?? [];
              const header = (name: string) =>
                headers.find((h) => h.name?.toLowerCase() === name)?.value ?? '';
              const subject = header('subject');
              const snippet = decodeSnippet(data.snippet ?? '');
              items.push({
                id: `gmail-${ref.id}`,
                who: fromName(header('from')),
                source: 'gmail',
                text: [subject, snippet].filter(Boolean).join(' — ').slice(0, MAX_TEXT),
                timestamp: Number(data.internalDate ?? Date.now()),
                openPath: `https://mail.google.com/mail/u/0/#inbox/${ref.id}`,
              });
            }
            return items;
          },
        }
      : {}),
  };
}

export const gmailConnector = createGoogleConnector('gmail', GMAIL_SCOPES);
export const calendarConnector = createGoogleConnector('calendar', CALENDAR_SCOPES);

/**
 * The `calendar.create-event` write action — inserts a real event on the
 * user's primary calendar. Only the agent runner calls this, after the grant
 * check and the human review gate.
 */
export async function calendarCreateEvent(
  accessToken: string,
  input: { title: string; startIso: string; endIso: string; description?: string },
): Promise<{ ok: boolean; detail?: string; error?: string; link?: string }> {
  try {
    const calendar = google.calendar({ version: 'v3', auth: authed(accessToken) });
    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: input.title,
        ...(input.description ? { description: input.description } : {}),
        start: { dateTime: input.startIso },
        end: { dateTime: input.endIso },
      },
    });
    return {
      ok: true,
      detail: `“${input.title}” created`,
      ...(data.htmlLink ? { link: data.htmlLink } : {}),
    };
  } catch (err) {
    return { ok: false, error: connectorError(err, 'Google Calendar rejected the event.') };
  }
}
