import { authService, backendClient } from '../auth/index.js';
import { loadDocumentFiles, pickDocumentPaths } from '../../infra/knowledge/document-loader.js';
import { createKnowledgeService } from './knowledge-service.js';

/**
 * The wired knowledge-ingest service (P8): the pure upload/list/remove flows
 * coupled to their concrete ports — the shared backend client, the vault-held
 * session token, and the electron dialog + fs loader in infra.
 */
export const knowledgeService = createKnowledgeService({
  http: backendClient,
  getToken: () => authService.token(),
  pickPaths: pickDocumentPaths,
  loadFiles: loadDocumentFiles,
});
