import { Octokit } from '@octokit/rest';
import { exchangeWebFlowCode } from '@octokit/oauth-methods';
import type { Connector } from '../../services/integrations/connector.js';
import type { RawItem } from '../../services/routines/source.js';
import { connectorError, oauthAppFor, runOAuthFlow } from './oauth.js';

/**
 * The GitHub connector (production P10). API access via the official
 * `@octokit/rest` SDK; the OAuth web-flow code exchange via the official
 * `@octokit/oauth-methods` helper (never hand-rolled). Connect paths:
 *
 *   - OAuth: system browser → github.com/login/oauth/authorize → loopback.
 *     Needs `COCKPITZERO_GITHUB_CLIENT_ID/SECRET` (OAuth apps allow loopback
 *     redirect URIs).
 *   - Token paste: a personal access token with the `notifications` scope.
 *
 * Reads map the authenticated user's notification threads (review requests,
 * mentions, CI, …) to digest `RawItem`s.
 */

const OAUTH_SCOPES = ['notifications'];
const MAX_ITEMS = 25;
const MAX_TEXT = 300;

/** api.github.com subject URL → the human web URL (best-effort). */
function webUrl(subjectUrl: string | null | undefined): string {
  if (!subjectUrl) return 'https://github.com/notifications';
  return subjectUrl
    .replace('https://api.github.com/repos/', 'https://github.com/')
    .replace('/pulls/', '/pull/');
}

async function accountLabel(token: string): Promise<string> {
  const { data } = await new Octokit({ auth: token }).users.getAuthenticated();
  return data.name ? `${data.name} (@${data.login})` : `@${data.login}`;
}

export const githubConnector: Connector = {
  id: 'github',

  oauthReady() {
    return oauthAppFor('github') !== null;
  },

  async connectOAuth(openExternal) {
    const app = oauthAppFor('github');
    if (!app) return { ok: false, error: 'GitHub OAuth app is not configured on this machine.' };
    return runOAuthFlow({
      openExternal,
      buildAuthorizeUrl: (redirectUri, state) => {
        const url = new URL('https://github.com/login/oauth/authorize');
        url.searchParams.set('client_id', app.clientId);
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('scope', OAUTH_SCOPES.join(' '));
        url.searchParams.set('state', state);
        return url.toString();
      },
      exchange: async (code, redirectUri) => {
        // The official Octokit OAuth helper — not a hand-rolled token exchange.
        const { authentication } = await exchangeWebFlowCode({
          clientType: 'oauth-app',
          clientId: app.clientId,
          clientSecret: app.clientSecret,
          code,
          redirectUrl: redirectUri,
        });
        const label = await accountLabel(authentication.token);
        return {
          ok: true,
          tokens: { accessToken: authentication.token },
          accountLabel: label,
          scopes: authentication.scopes ?? OAUTH_SCOPES,
        };
      },
    });
  },

  async connectToken(token) {
    try {
      const label = await accountLabel(token);
      return { ok: true, tokens: { accessToken: token }, accountLabel: label, scopes: [] };
    } catch (err) {
      return { ok: false, error: connectorError(err, 'GitHub rejected that token.') };
    }
  },

  // OAuth-app web-flow tokens don't expire (and PATs manage their own lifetime).
  async refresh() {
    return null;
  },

  async revoke(tokens) {
    const app = oauthAppFor('github');
    if (!app) return; // a pasted PAT is revoked from github.com settings, not the API
    try {
      const basic = Buffer.from(`${app.clientId}:${app.clientSecret}`).toString('base64');
      await fetch(`https://api.github.com/applications/${app.clientId}/token`, {
        method: 'DELETE',
        headers: {
          authorization: `Basic ${basic}`,
          accept: 'application/vnd.github+json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ access_token: tokens.accessToken }),
      });
    } catch {
      /* best-effort — the vault token is cleared regardless */
    }
  },

  async fetchItems(accessToken, since) {
    const octokit = new Octokit({ auth: accessToken });
    const { data } = await octokit.activity.listNotificationsForAuthenticatedUser({
      since: new Date(since).toISOString(),
      all: false,
      per_page: MAX_ITEMS,
    });
    return data.map<RawItem>((n) => ({
      id: `github-${n.id}`,
      who: n.repository.full_name,
      source: 'github',
      text: `${n.subject.type}: ${n.subject.title} (${n.reason.replace(/_/g, ' ')})`.slice(
        0,
        MAX_TEXT,
      ),
      timestamp: new Date(n.updated_at).getTime(),
      openPath: webUrl(n.subject.url),
    }));
  },
};
