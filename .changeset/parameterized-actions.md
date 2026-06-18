---
'@cockpitzero/shared': minor
---

Add Level-2 parameterized actions and fzf-powered search to the shared domain core:

- `ArgumentSchema` + optional `argument` on every action; `{token}` templating.
- Pure helpers `applyArgument`, `hasArgument`, `extractTokens` (`actions.ts`).
- `search.ts`: `searchActions`, `buildSearchIndex`, and `resolveQuery` (results vs. argument
  capture) backed by `fzf`.
- IPC contract: replace `search` with `resolveQuery`; `runAction` now takes an optional `argument`.
