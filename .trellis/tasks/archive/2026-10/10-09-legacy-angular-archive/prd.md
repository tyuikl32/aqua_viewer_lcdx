# Push legacy-angular to origin as the permanent archive of the old Angular code before master adoption

## Background

`legacy-angular` is this fork's permanent archive pointer for the **old Angular implementation** of the
frontend. Once Phase 5 "master adoption" happens (`master` reset to `test/lcdx-react-port-audit`), the
Angular history disappears from `master` — `legacy-angular` is then the only way back.

**Verified provenance — `legacy-angular` is OURS, not upstream's:**

| Check | Result |
|---|---|
| `git rev-parse legacy-angular` | `b1c3fb4` |
| `git rev-parse master` | `b1c3fb4` (identical — `master...legacy-angular` = `0 0`) |
| Commit contents | `fix(cabmode): allow editing cc CustomCameraConfig input`, `chore(task): archive 09-17-remote-locks-cabinet-location-name`, `fix(cabinet-select): show locationName on remote/locks` — all LCDX-specific trellis/cabinet work |
| Does upstream have this branch? | No. Upstream uses `upstream/main`, `upstream/beta`, `upstream/next`, `upstream/oauth2`, `upstream/webauthn`. There is no `legacy-angular` anywhere upstream |

## Problem

The branch existed **only locally**. `git ls-remote --heads origin legacy-angular` returned empty.
Meanwhile `master` and `legacy-angular` are the last holders of the Angular code — if the local disk
failed before a push, the old implementation would be **gone with no remote recovery**.

## Requirements

- **R1** Create `origin/legacy-angular` pointing at the same commit as the local `legacy-angular`
  (`b1c3fb4`).
- **R2** Change nothing else. Specifically: do NOT move `master`, do NOT move `backup`, do NOT move
  `test/lcdx-react-port-audit`, do NOT touch the working tree.
- **R3** Do not push any other branch (including `master` and the working branch).

## Acceptance Criteria

- [x] `git ls-remote --heads origin legacy-angular` returns `b1c3fb4…`
- [x] Local `master` / `legacy-angular` / `backup` / `test/lcdx-react-port-audit` SHAs are **byte-identical**
      before and after the operation
- [x] `origin/backup` still points at `90ed95b` (i.e. the stale remote backup was not "helpfully" updated)
- [x] Working tree clean apart from this task's own directory
