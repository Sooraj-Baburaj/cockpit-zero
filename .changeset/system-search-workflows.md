---
'@cockpitzero/shared': minor
---

Generalize launcher results to a `LauncherItem` union (action / workflow / app / file) and switch
`ResolvedQuery` to it. Add a generic `fuzzyRank` ranker and `searchConfig` (actions + workflows);
add `runWorkflow` and `openPath` to the IPC contract. This is the shared groundwork for system
search (installed apps + files) and workflow execution in the desktop app.
