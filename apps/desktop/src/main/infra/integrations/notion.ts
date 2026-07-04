import { Client } from '@notionhq/client';
import type { Connector } from '../../services/integrations/connector.js';
import type { RawItem } from '../../services/routines/source.js';
import { connectorError } from './oauth.js';

/**
 * The Notion connector (production P10), via the official `@notionhq/client`.
 * Connects with an **internal integration secret** (`ntn_…` / `secret_…`) — the
 * standard Notion auth path for personal/workspace tooling — validated with a
 * `users.me` read. Notion has no notifications API, so reads map the most
 * recently edited pages shared with the integration to "doc updated" digest
 * items (the same shape the v1 mock promised).
 */

const MAX_ITEMS = 10;

/** Pull the page title out of a page object's properties (or "Untitled"). */
function pageTitle(page: { properties?: Record<string, unknown> }): string {
  for (const prop of Object.values(page.properties ?? {})) {
    if (
      prop &&
      typeof prop === 'object' &&
      'type' in prop &&
      prop.type === 'title' &&
      'title' in prop &&
      Array.isArray(prop.title)
    ) {
      const text = prop.title
        .map((t: { plain_text?: string }) => t.plain_text ?? '')
        .join('')
        .trim();
      if (text) return text;
    }
  }
  return 'Untitled';
}

export const notionConnector: Connector = {
  id: 'notion',

  oauthReady() {
    return false; // Notion connects with an internal integration secret.
  },

  async connectOAuth() {
    return {
      ok: false,
      error:
        'Notion connects with an internal integration secret — create one at notion.so/my-integrations and paste it.',
    };
  },

  async connectToken(token) {
    try {
      const me = await new Client({ auth: token }).users.me({});
      const workspace =
        me.type === 'bot' && 'workspace_name' in me.bot ? me.bot.workspace_name : null;
      const label = [me.name, workspace].filter(Boolean).join(' · ') || 'Notion workspace';
      return { ok: true, tokens: { accessToken: token }, accountLabel: label, scopes: [] };
    } catch (err) {
      return { ok: false, error: connectorError(err, 'Notion rejected that secret.') };
    }
  },

  async refresh() {
    return null; // integration secrets are long-lived.
  },

  async revoke() {
    // Notion secrets are revoked from notion.so/my-integrations; nothing to call.
  },

  async fetchItems(accessToken, since) {
    const notion = new Client({ auth: accessToken });
    const res = await notion.search({
      filter: { property: 'object', value: 'page' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: 20,
    });
    const items: RawItem[] = [];
    for (const result of res.results) {
      if (!('last_edited_time' in result) || !('url' in result)) continue;
      const timestamp = Date.parse(result.last_edited_time);
      if (Number.isNaN(timestamp) || timestamp < since) continue;
      items.push({
        id: `notion-${result.id}`,
        who: 'Notion',
        source: 'notion',
        text: `“${pageTitle(result as { properties?: Record<string, unknown> })}” was updated.`,
        timestamp,
        openPath: result.url,
      });
      if (items.length >= MAX_ITEMS) break;
    }
    return items;
  },
};
