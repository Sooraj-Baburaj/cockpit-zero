# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).

Run `pnpm changeset` to record a version bump for a package, then
`pnpm version-packages` to apply pending changesets and update changelogs.

Apps (`@cockpitzero/desktop`, `@cockpitzero/backend`, `@cockpitzero/web`) are ignored —
only publishable `packages/*` are versioned here.
