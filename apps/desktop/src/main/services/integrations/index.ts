import { shell } from 'electron';
import type { IntegrationSourceId } from '@cockpitzero/shared';
import {
  calendarConnector,
  calendarCreateEvent,
  gmailConnector,
} from '../../infra/integrations/google.js';
import { githubConnector } from '../../infra/integrations/github.js';
import { linearConnector } from '../../infra/integrations/linear.js';
import { notionConnector } from '../../infra/integrations/notion.js';
import { slackConnector, slackSend } from '../../infra/integrations/slack.js';
import { authService, backendClient } from '../auth/index.js';
import { getConfig, updateConfig } from '../config-service.js';
import { secretsService } from '../secrets/index.js';
import type { IntegrationActionsPort } from '../agent/tools/ports.js';
import type { Connector } from './connector.js';
import { createIntegrationService, type CloudTokenStore } from './integration-service.js';
import { createIntegrationSources } from './notification-sources.js';

/**
 * The wired integration service (production P10) — the one place that couples
 * the pure integration service / notification sources / tool actions to their
 * concrete dependencies: the real connectors (official SDKs in `infra`), the P2
 * vault, the config store, the system browser, and the backend token mirror.
 * Mirrors how `routines/index` and `agent/index` wire their pieces.
 */

const connectors: Partial<Record<IntegrationSourceId, Connector>> = {
  slack: slackConnector,
  gmail: gmailConnector,
  calendar: calendarConnector,
  github: githubConnector,
  linear: linearConnector,
  notion: notionConnector,
};

/**
 * Signed-in users mirror tokens to the backend (encrypted server-side, P7 auth)
 * so cloud routines can run; signed-out this is a silent no-op. Every call is
 * best-effort — the local vault is always the source of truth.
 */
const cloud: CloudTokenStore = {
  async push(source, payload) {
    const token = authService.token();
    if (!token) return;
    await backendClient.request(`/integrations/${source}`, {
      method: 'POST',
      token,
      json: {
        accountLabel: payload.accountLabel,
        scopes: payload.scopes,
        tokens: payload.tokens,
      },
    });
  },
  async remove(source) {
    const token = authService.token();
    if (!token) return;
    await backendClient.request(`/integrations/${source}`, { method: 'DELETE', token });
  },
};

export const integrationService = createIntegrationService({
  connectors,
  vault: secretsService,
  getConfig,
  setConfig: (config) => {
    updateConfig(config);
  },
  openExternal: (url) => shell.openExternal(url),
  cloud,
});

/** Real digest notification sources over the connected integrations (Phase-5 port). */
export const integrationSources = createIntegrationSources(integrationService, connectors);

/** The agent tools' write-action port — resolves the vault token per call, so a
 *  freshly connected/disconnected source takes effect with no restart. */
export const integrationActions: IntegrationActionsPort = {
  async slackSend(input) {
    const token = await integrationService.accessToken('slack');
    if (!token) {
      return { ok: false, error: 'Slack is not connected — connect it in Console → Integrations.' };
    }
    return slackSend(token, input);
  },

  async calendarCreateEvent(input) {
    const token = await integrationService.accessToken('calendar');
    if (!token) {
      return {
        ok: false,
        error: 'Google Calendar is not connected — connect it in Console → Integrations.',
      };
    }
    return calendarCreateEvent(token, input);
  },
};
