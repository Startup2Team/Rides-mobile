---
name: Expo workflow setup
description: How to start the Taravelis Expo workflow when preview pane is blank
---

## Problem
`listArtifacts()` returns `[]` even though `artifacts/mobile/.replit-artifact/artifact.toml` exists. The workflow also fails with `--port $PORT` because PORT env is not set by the workflow runner.

## Fix (in order)

1. **Re-register the artifact** — write a temp file to `artifacts/mobile/.replit-artifact/artifact.edit.toml` (same content as existing artifact.toml), then call `verifyAndReplaceArtifactToml`. After this `listArtifacts()` will return the artifact with id `"artifacts/mobile"`.

2. **Start the workflow with explicit PORT** — use:
   ```javascript
   await configureWorkflow({
     name: "Taravelis",
     command: "PORT=18115 pnpm --filter @workspace/mobile run dev",
     outputType: "webview",
     autoStart: true
     // no waitForPort — 18115 is not in the supported port list
   });
   ```
   Do NOT pass `waitForPort: 8080` (wrong port) or `waitForPort: 18115` (unsupported).

3. **Present the artifact** using the ID returned from `listArtifacts()`.

**Why:** The Expo dev script uses `$PORT` which is empty in the workflow runner environment. The artifact.toml service env block only applies when the artifact's own service runner is used, not the configureWorkflow path.

**How to apply:** Any time the user says "preview is blank" or "nothing shows in preview" for this project.
