import { LinearClient, IssueNotification } from '@linear/sdk';
import type { Connector } from '../../services/integrations/connector.js';
import type { RawItem } from '../../services/routines/source.js';
import { connectorError } from './oauth.js';

/**
 * The Linear connector (production P10), via the official `@linear/sdk`.
 * Connects with a **personal API key** (`lin_api_…`) — a first-class Linear
 * auth path — pasted in the Console; the key is validated with a `viewer`
 * read and stored in the vault. Reads map the user's Linear inbox
 * notifications (assignments, mentions, status changes) to digest `RawItem`s.
 */

const MAX_ITEMS = 10;
const MAX_TEXT = 300;

function client(token: string): LinearClient {
  // Personal API keys (`lin_api_…`) authenticate differently from OAuth tokens.
  return token.startsWith('lin_api_')
    ? new LinearClient({ apiKey: token })
    : new LinearClient({ accessToken: token });
}

/** "issueAssignedToYou" → "issue assigned to you". */
function humanizeType(type: string): string {
  return type.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

export const linearConnector: Connector = {
  id: 'linear',

  oauthReady() {
    return false; // Linear connects with a personal API key.
  },

  async connectOAuth() {
    return {
      ok: false,
      error:
        'Linear connects with a personal API key — paste one from linear.app → Settings → API.',
    };
  },

  async connectToken(token) {
    try {
      const viewer = await client(token).viewer;
      const label = viewer.email ? `${viewer.name} (${viewer.email})` : viewer.name;
      return { ok: true, tokens: { accessToken: token }, accountLabel: label, scopes: [] };
    } catch (err) {
      return { ok: false, error: connectorError(err, 'Linear rejected that API key.') };
    }
  },

  async refresh() {
    return null; // API keys are long-lived.
  },

  async revoke() {
    // Linear API keys are revoked from linear.app settings; nothing to call here.
  },

  async fetchItems(accessToken, since) {
    const linear = client(accessToken);
    const page = await linear.notifications({ first: 25 });
    const items: RawItem[] = [];
    for (const n of page.nodes) {
      const timestamp = n.createdAt.getTime();
      if (timestamp < since) continue;
      const actor = await n.actor;
      let text = humanizeType(n.type);
      let openPath = 'https://linear.app/inbox';
      if (n instanceof IssueNotification) {
        const issue = await n.issue;
        if (issue) {
          text = `${humanizeType(n.type)}: ${issue.identifier} ${issue.title}`;
          openPath = issue.url;
        }
      }
      items.push({
        id: `linear-${n.id}`,
        who: actor?.name ?? 'Linear',
        source: 'linear',
        text: text.slice(0, MAX_TEXT),
        timestamp,
        openPath,
      });
      if (items.length >= MAX_ITEMS) break;
    }
    return items;
  },
};
