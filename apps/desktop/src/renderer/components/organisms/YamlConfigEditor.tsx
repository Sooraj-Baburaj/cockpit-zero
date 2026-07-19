import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CONFIG_YAML_FILES,
  configToYamlFiles,
  formatConfigYaml,
  mergeConfigSlice,
  validateYaml,
  yamlFileToConfigSlice,
  type Config,
  type ConfigYamlFile,
  type ValidationIssue,
} from '@cockpitzero/shared';
import { api } from '../../lib/api.js';
import { cn } from '../../lib/cn.js';
import { highlightYamlLine } from '../../lib/yaml-highlight.js';
import { Button } from '../atoms/Button.js';

/** A thin-line glyph per config file (mirrors the mockup's file-tree icons). */
const FILE_GLYPH: Record<ConfigYamlFile, React.ReactNode> = {
  'config.yaml': (
    <>
      <path d="M6 2h9l4 4v16H6Z" />
      <path d="M15 2v4h4" />
    </>
  ),
  'aliases.yaml': (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </>
  ),
  'workflows.yaml': (
    <>
      <path d="M12 3 21 7l-9 4-9-4 9-4Z" />
      <path d="m3 12 9 4 9-4M3 17l9 4 9-4" />
    </>
  ),
  'routines.yaml': (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 4v4h4M12 8v4l3 2" />
    </>
  ),
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** One outline entry: a top-level label and an optional indented sub-line. */
interface OutlineEntry {
  label: string;
  sub?: string;
}

/** Structural outline of a file's current (parsed) content for the side panel. */
function buildOutline(file: ConfigYamlFile, text: string): OutlineEntry[] {
  const result = yamlFileToConfigSlice(file, text);
  if (!result.ok) return [];
  const slice = result.slice;
  switch (file) {
    case 'config.yaml':
      return [
        { label: 'settings', sub: slice.settings?.theme },
        {
          label: 'ai',
          sub: slice.ai && `${slice.ai.provider}${slice.ai.model ? ` · ${slice.ai.model}` : ''}`,
        },
        { label: plural(slice.actions?.length ?? 0, 'action') },
      ];
    case 'aliases.yaml':
      return (slice.aliases ?? []).map((a) => ({ label: a.keyword, sub: a.label }));
    case 'workflows.yaml':
      return (slice.workflows ?? []).map((w) => ({
        label: w.name,
        sub: plural(w.steps.length, 'step'),
      }));
    case 'routines.yaml':
      return (slice.routines ?? []).map((r) => ({
        label: r.id,
        sub: r.schedule
          ? `${plural(r.sources.length, 'source')} · ${plural(r.summarize.maxItems, 'item')}`
          : 'on demand',
      }));
  }
}

/**
 * The YAML config editor (Phase 6) — a power-user surface to edit the config by
 * hand. Rendered as a Console tab (no new window): a file tree, a token-themed syntax
 * YAML editor (a controlled textarea overlaid with a CSP-safe highlight layer),
 * live schema validation, and an outline/shortcuts side panel.
 *
 * "The schemas lead": serialization + validation are the pure `@cockpitzero/shared`
 * mapping fns, so validation is instant (renderer-side) and Save round-trips
 * through the same validated config path the GUI uses (`onSave` → `setConfig`).
 * A schema-invalid edit blocks Save, so a bad hand-edit can never corrupt config.
 */
export function YamlConfigEditor({
  config,
  onSave,
}: {
  config: Config;
  /** Persist a full, merged config through the validated config path (setConfig). */
  onSave: (next: Config) => void;
}) {
  // Buffers are seeded once from the config the editor opened with; `saved`
  // tracks the last-persisted text per file so we can show per-file unsaved dots.
  // We intentionally don't re-sync from `config` on every prop change — Save then
  // reopen is the GUI-sync story (the panel owns the live text while open).
  const [buffers, setBuffers] = useState<Record<ConfigYamlFile, string>>(() =>
    configToYamlFiles(config),
  );
  const [saved, setSaved] = useState<Record<ConfigYamlFile, string>>(() =>
    configToYamlFiles(config),
  );
  const [activeFile, setActiveFile] = useState<ConfigYamlFile>('config.yaml');
  const [caret, setCaret] = useState<{ line: number; col: number }>({ line: 0, col: 0 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const text = buffers[activeFile];
  const lines = useMemo(() => text.split('\n'), [text]);
  const issues = useMemo(() => validateYaml(activeFile, text), [activeFile, text]);
  const outline = useMemo(() => buildOutline(activeFile, text), [activeFile, text]);

  const hasError = issues.some((i) => i.level === 'error');
  const errorCount = issues.filter((i) => i.level === 'error').length;
  const dirty = (file: ConfigYamlFile) => buffers[file] !== saved[file];
  const activeDirty = dirty(activeFile);

  // Reset the caret + refocus the editor whenever the active file changes.
  useEffect(() => {
    setCaret({ line: 0, col: 0 });
    textareaRef.current?.focus();
  }, [activeFile]);

  const updateCaret = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const upto = ta.value.slice(0, ta.selectionStart);
    const segs = upto.split('\n');
    setCaret({ line: segs.length - 1, col: segs[segs.length - 1]?.length ?? 0 });
  };

  // Keep the highlight overlay + gutter scrolled in lockstep with the textarea
  // (the textarea is the only real scroller; the others are visual mirrors).
  const syncScroll = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = ta.scrollTop;
      highlightRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  };

  const setText = (value: string) => setBuffers((b) => ({ ...b, [activeFile]: value }));

  const save = () => {
    if (hasError) return; // Blocked — the side panel shows the error.
    const result = yamlFileToConfigSlice(activeFile, text);
    if (!result.ok) return;
    onSave(mergeConfigSlice(config, result.slice));
    setSaved((s) => ({ ...s, [activeFile]: text }));
  };

  const format = () => {
    const formatted = formatConfigYaml(activeFile, text);
    if (formatted !== text) setText(formatted);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.code === 'KeyS') {
      e.preventDefault();
      save();
    } else if (e.altKey && e.shiftKey && e.code === 'KeyF') {
      e.preventDefault();
      format();
    } else if (mod && e.code === 'Enter') {
      // Validate: it already runs live on every keystroke, so this just keeps the
      // chord from inserting a newline and confirms the current state.
      e.preventDefault();
    }
  };

  const modKey = api.platform === 'darwin' ? '⌘' : 'Ctrl';
  const altKey = api.platform === 'darwin' ? '⌥' : 'Alt';

  return (
    <div
      className="cz-yaml flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden rounded-[var(--cz-radius-lg)] border [border-color:var(--cz-line-faint)] [background:var(--cz-surface)]"
      onKeyDown={onKeyDown}
    >
      {/* Titlebar: active filename + unsaved dot, Format / Save. */}
      <header className="flex h-[50px] flex-none items-center justify-between border-b [border-color:var(--cz-line-faint)] px-[18px]">
        <div className="flex items-center gap-2.5 text-[13px] text-muted">
          <span className="font-mono text-fg">{activeFile}</span>
          {activeDirty && (
            <span
              className="size-[7px] rounded-full [background:var(--cz-accent)]"
              title="Unsaved changes"
            />
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={format} title={`Format (${altKey}⇧F)`}>
            <svg
              viewBox="0 0 24 24"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" />
            </svg>
            Format
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={save}
            disabled={hasError || !activeDirty}
            title={`Save (${modKey}S)`}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
              <path d="M17 21v-8H7v8M7 3v5h7" />
            </svg>
            Save
          </Button>
        </div>
      </header>

      {/* Body: file tree · editor · validation/outline panel. */}
      <div className="grid min-h-0 flex-1 grid-cols-[180px_1fr_220px]">
        {/* File tree */}
        <aside className="border-r [border-color:var(--cz-line-faint)] px-3 py-4">
          <div className="px-2 pb-2.5 text-[10px] font-semibold tracking-[0.14em] text-subtle uppercase">
            ~/.cockpit
          </div>
          {CONFIG_YAML_FILES.map((file) => {
            const isActive = file === activeFile;
            return (
              <button
                key={file}
                onClick={() => setActiveFile(file)}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'mb-0.5 flex w-full items-center gap-2.5 rounded-[var(--cz-radius-sm)] px-2.5 py-2 font-mono text-[13px] transition',
                  isActive
                    ? 'text-fg [background:var(--cz-surface-hover)]'
                    : 'text-muted hover:[background:var(--cz-surface-inset)]',
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={cn(
                    'size-[15px] flex-none',
                    isActive ? 'text-[var(--cz-accent)]' : 'text-subtle',
                  )}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {FILE_GLYPH[file]}
                </svg>
                <span className="truncate">{file}</span>
                {dirty(file) && (
                  <span className="ml-auto size-1.5 flex-none rounded-full [background:var(--cz-accent)]" />
                )}
              </button>
            );
          })}
        </aside>

        {/* Editor: gutter + highlighted textarea overlay. */}
        <div className="grid min-w-0 grid-cols-[50px_1fr] overflow-hidden font-mono text-[13px] leading-[1.78]">
          <div ref={gutterRef} className="overflow-hidden pt-4 text-right select-none">
            {lines.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'cz-yaml-gutter-num pr-4 text-[var(--cz-fg-faint)]',
                  i === caret.line && 'act',
                )}
              >
                {i + 1}
              </div>
            ))}
          </div>

          <div className="relative min-w-0 overflow-hidden">
            <div
              ref={highlightRef}
              className="pointer-events-none absolute inset-0 overflow-hidden pt-4"
            >
              {lines.map((line, i) => {
                const tokens = highlightYamlLine(line);
                return (
                  <div
                    key={i}
                    className={cn(
                      'cz-yaml-line w-max min-w-full pr-4 pl-3 whitespace-pre',
                      i === caret.line && 'act',
                    )}
                  >
                    {tokens.length === 0
                      ? ' '
                      : tokens.map((t, j) => (
                          <span key={j} className={t.cls}>
                            {t.text}
                          </span>
                        ))}
                  </div>
                );
              })}
            </div>
            <textarea
              ref={textareaRef}
              value={text}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              wrap="off"
              aria-label={`${activeFile} source`}
              onChange={(e) => {
                setText(e.target.value);
                updateCaret();
              }}
              onScroll={syncScroll}
              onClick={updateCaret}
              onKeyUp={updateCaret}
              onSelect={updateCaret}
              className="absolute inset-0 size-full resize-none overflow-auto bg-transparent pt-4 pr-4 pl-3 font-mono text-[13px] leading-[1.78] whitespace-pre text-transparent caret-[var(--cz-accent)] outline-none [&::selection]:bg-[var(--cz-accent-soft)]"
            />
          </div>
        </div>

        {/* Validation + outline + shortcuts */}
        <aside className="overflow-y-auto border-l [border-color:var(--cz-line-faint)] px-4 py-[18px]">
          <div className="mb-3 text-[10px] font-semibold tracking-[0.14em] text-subtle uppercase">
            Validation
          </div>
          {issues.map((issue, i) => (
            <ValidationRow key={i} issue={issue} />
          ))}

          <div className="mt-6">
            <div className="mb-3 text-[10px] font-semibold tracking-[0.14em] text-subtle uppercase">
              Outline
            </div>
            {outline.length === 0 ? (
              <p className="text-[12.5px] text-subtle italic">Unavailable while invalid.</p>
            ) : (
              outline.map((entry, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2.5 py-1.5 font-mono text-[12.5px] font-medium text-muted">
                    <span className="size-[5px] flex-none rounded-full [background:var(--cz-accent)]" />
                    <span className="truncate">{entry.label}</span>
                  </div>
                  {entry.sub && (
                    <div className="flex items-center gap-2.5 pl-4 font-mono text-[12.5px] text-subtle">
                      <span className="size-[5px] flex-none rounded-full [background:var(--cz-fg-faint)]" />
                      <span className="truncate">{entry.sub}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="mt-6">
            <div className="mb-3 text-[10px] font-semibold tracking-[0.14em] text-subtle uppercase">
              Shortcuts
            </div>
            <Shortcut label="Save" keys={[modKey, 'S']} />
            <Shortcut label="Format" keys={[altKey, '⇧', 'F']} />
            <Shortcut label="Validate" keys={[modKey, '↵']} />
          </div>
        </aside>
      </div>

      {/* Status bar */}
      <footer className="flex h-10 flex-none items-center justify-between border-t [border-color:var(--cz-line-faint)] px-[18px]">
        <div className="flex items-center gap-4">
          <span className="font-mono text-[12px] text-subtle">YAML</span>
          <span className="font-mono text-[12px] text-subtle">
            Ln {caret.line + 1}, Col {caret.col + 1}
          </span>
          <span className="font-mono text-[12px] text-subtle">UTF-8</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[12px] text-subtle">Spaces: 2</span>
          {hasError ? (
            <span className="flex items-center gap-2 text-[12px] font-medium text-[var(--cz-danger)]">
              <span className="size-[7px] rounded-full [background:var(--cz-danger)]" />
              {plural(errorCount, 'error')}
            </span>
          ) : (
            <span className="flex items-center gap-2 text-[12px] font-medium text-muted">
              <span className="size-[7px] rounded-full [background:var(--cz-success)]" />
              {activeDirty ? 'Validated · unsaved' : 'Validated · saved'}
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}

/** A single ✓/⚠/✕ validation row. */
function ValidationRow({ issue }: { issue: ValidationIssue }) {
  return (
    <div className="mb-2.5 flex gap-2.5 text-[13px] leading-[1.4] text-fg">
      {issue.level === 'ok' ? (
        <svg
          viewBox="0 0 24 24"
          className="mt-px size-4 flex-none text-[var(--cz-success)]"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12 2.5 2.5 4.5-5" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className={cn(
            'mt-px size-4 flex-none',
            issue.level === 'error' ? 'text-[var(--cz-danger)]' : 'text-[var(--cz-warn)]',
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3 2 20h20L12 3Z" />
          <path d="M12 10v4M12 17h.01" />
        </svg>
      )}
      <span>
        {issue.code && (
          <>
            <code className="font-mono text-[12px] text-[var(--cz-accent-text)]">
              {issue.code}
            </code>{' '}
          </>
        )}
        {issue.message}
      </span>
    </div>
  );
}

/** A labelled keycap row in the Shortcuts list. */
function Shortcut({ label, keys }: { label: string; keys: string[] }) {
  return (
    <div className="flex items-center justify-between py-[7px]">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="flex gap-1">
        {keys.map((k, i) => (
          <span
            key={i}
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--cz-radius-xs)] border [border-color:var(--cz-line-strong)] px-1.5 font-mono text-[11px] font-medium text-muted [background:var(--cz-surface-inset)]"
          >
            {k}
          </span>
        ))}
      </span>
    </div>
  );
}
