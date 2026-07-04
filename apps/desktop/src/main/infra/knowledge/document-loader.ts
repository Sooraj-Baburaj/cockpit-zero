import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { dialog } from 'electron';
import { KNOWLEDGE_MAX_UPLOAD_BYTES } from '@cockpitzero/shared';
import type { KnowledgeUpload } from '../../services/knowledge/knowledge-service.js';

/**
 * The OS-touching half of knowledge ingestion (P8): the native open dialog and
 * the filesystem reads, kept in infra per the layering rules so the knowledge
 * service stays electron-free and unit-testable. Folders are expanded one level
 * deep (a "folder of docs", not a recursive crawl), unsupported/oversized files
 * are skipped by name, and everything is bounded so a giant selection can't
 * stall the main process.
 */

/** What we can ingest today: PDFs (extracted server-side) + plain text. */
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.text']);
const PDF_EXTENSION = '.pdf';

/** Bound one ingest run — the Console shows what was skipped. */
const MAX_FILES_PER_INGEST = 20;

export async function pickDocumentPaths(): Promise<string[]> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Add to knowledge',
    buttonLabel: 'Add to knowledge',
    properties: ['openFile', 'openDirectory', 'multiSelections'],
    filters: [{ name: 'Documents', extensions: ['pdf', 'txt', 'md', 'markdown', 'text'] }],
  });
  return canceled ? [] : filePaths;
}

function uploadType(path: string): 'pdf' | 'text' | null {
  const ext = extname(path).toLowerCase();
  if (ext === PDF_EXTENSION) return 'pdf';
  if (TEXT_EXTENSIONS.has(ext)) return 'text';
  return null;
}

export async function loadDocumentFiles(
  paths: string[],
): Promise<{ uploads: KnowledgeUpload[]; skipped: string[] }> {
  const uploads: KnowledgeUpload[] = [];
  const skipped: string[] = [];

  // Expand folders one level; keep files as-is.
  const files: string[] = [];
  for (const path of paths) {
    try {
      const info = await stat(path);
      if (info.isDirectory()) {
        const children = await readdir(path);
        files.push(...children.map((child) => join(path, child)));
      } else {
        files.push(path);
      }
    } catch {
      skipped.push(basename(path));
    }
  }

  for (const file of files) {
    const name = basename(file);
    const type = uploadType(file);
    if (!type) {
      // Only surface real candidates as "skipped" — folder noise (.DS_Store,
      // subfolders) is silently ignored.
      if (extname(file) !== '') skipped.push(name);
      continue;
    }
    if (uploads.length >= MAX_FILES_PER_INGEST) {
      skipped.push(name);
      continue;
    }
    try {
      const info = await stat(file);
      if (!info.isFile() || info.size === 0 || info.size > KNOWLEDGE_MAX_UPLOAD_BYTES) {
        skipped.push(name);
        continue;
      }
      const bytes = await readFile(file);
      uploads.push({ name, type, content: bytes.toString('base64') });
    } catch {
      skipped.push(name);
    }
  }

  return { uploads, skipped };
}
