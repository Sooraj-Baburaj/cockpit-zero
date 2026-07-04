import { ROUTINE_SOURCE_INTEGRATION } from '@cockpitzero/shared';
import type { IntegrationSourceId, RoutineSourceId } from '@cockpitzero/shared';
import type { NotificationSource, RawItem } from '../routines/source.js';
import type { Connector } from './connector.js';
import type { IntegrationService } from './integration-service.js';

/**
 * Real `NotificationSource` adapters over the P10 connectors — the drop-in
 * replacement for the Phase-5 mock sources, behind the **same port** so the
 * digest runner doesn't change. Per the infra discipline (CLAUDE.md): every
 * fetch is time-boxed and degrades to `[]` on any failure (disconnected source,
 * network error, slow API), so one broken integration can never sink a digest
 * run. A routine source with no connected integration simply contributes
 * nothing — never fake items.
 */

/** Digest pulls run in the background, so the box is generous but firm. */
const FETCH_TIMEOUT_MS = 12_000;

function timeBoxed<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

/** Build the digest runner's source map from the connected real integrations. */
export function createIntegrationSources(
  service: IntegrationService,
  connectors: Partial<Record<IntegrationSourceId, Connector>>,
): Partial<Record<RoutineSourceId, NotificationSource>> {
  const sources: Partial<Record<RoutineSourceId, NotificationSource>> = {};

  for (const [routineId, integrationId] of Object.entries(ROUTINE_SOURCE_INTEGRATION) as [
    RoutineSourceId,
    IntegrationSourceId | null,
  ][]) {
    if (!integrationId) continue; // e.g. `teams` — no connector yet, contributes [].
    const connector = connectors[integrationId];
    const fetchItems = connector?.fetchItems?.bind(connector);
    if (!fetchItems) continue;

    sources[routineId] = {
      id: routineId,
      async fetch(since): Promise<RawItem[]> {
        try {
          const token = await service.accessToken(integrationId);
          if (!token) return []; // not connected / expired — never fake items.
          return await timeBoxed(fetchItems(token, since), FETCH_TIMEOUT_MS, []);
        } catch {
          return [];
        }
      },
    };
  }

  return sources;
}
