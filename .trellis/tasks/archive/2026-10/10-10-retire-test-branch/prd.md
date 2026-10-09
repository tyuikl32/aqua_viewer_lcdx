# Retire the `test/lcdx-react-port-audit` branch

## Background

`test/lcdx-react-port-audit` was the React-port work branch (forked from the `backup` mirror at
`90ed95b`). The React tree was adopted into `master` on 2026-10-09 via the two-parent merge `b4731f9`
plus catch-up merges, and all subsequent work has been done directly on `master`. The branch has no
remaining role.

## Safety review (2026-10-10, before deletion) — all checks passed

| # | Check | Command | Result |
|---|---|---|---|
| 1 | Any commit on test missing from master? | `git log --oneline test ^master` | ✅ **empty** |
| 2 | Is test's tip an ancestor of master? (authoritative reachability test) | `git merge-base --is-ancestor test master` | ✅ exit 0 — tip `41bfa5a` permanently reachable from `master` |
| 3 | Any content (file) that exists only on test? | `git diff --name-status test master` | ✅ exactly one `D`: `.trellis/tasks/09-14-…/implement.md` |
| 3b | Is that `D` real content loss? | blob diff of test path vs its archive copy | ✅ **archive copy is a superset** — only additions (checked box + closing note). Archive-move artifact, not a loss |
| 4 | Code-area diff direction | `git diff --name-status test master -- src/ public/ tests/ package*.json vite.config.ts tsconfig*.json .github/` | ✅ only `M`×4 + `A`×1 (master's newer work: shell fix + songlist feature + new spec) |
| 5 | Any file under `src/ tests/ public/` on test missing in master? | per-file `git cat-file -e master:<path>` loop | ✅ **0 missing** |
| 6 | Any other ref pointing at test? | `git for-each-ref` | ✅ only the branch itself + its `origin/` tracking ref |
| 7 | Recovery anchor recorded | `git rev-parse test` | `41bfa5a5d4ec853e63260784e68c4367f0b51aab` |

**Unrelated observation (not a blocker)**: two `refs/stash` entries exist — `stash@{0}` "On backup" and
`stash@{1}` "On main" — GitHub-Desktop auto-stashes, each containing a single `.gitignore` line addition,
based on `99029d7` (the `backup` tip). Not related to this branch; left untouched.

*(Method note: `git diff <rev>:<path> <rev>:<path>` fails under Git-Bash's MSYS path conversion — the
colon-path gets rewritten (`:` → `;`). Prefix with `MSYS_NO_PATHCONV=1` to run such comparisons.)*

## Decision

Delete **both** the local branch and `origin/test/lcdx-react-port-audit`. Nothing is lost:

- All commits remain reachable from `master` (check 2).
- Recovery if ever needed: `git branch test/lcdx-react-port-audit 41bfa5a` (then push).
- The old Angular side is separately preserved by `legacy-angular` (`b1c3fb4`).

## Requirements

- **R1** Delete with the **safe** form `git branch -d` first (git's own merged-check acts as a second
  gate; fall back to `-D` only if `-d` refuses despite check 2, and record why).
- **R2** Delete the remote ref with an explicit refspec; verify afterwards via `ls-remote`.
- **R3** Update the README branch-model table — it still documents the branch as the work branch and
  describes `master` as still-Angular; both are now false.
- **R4** Record the recovery anchor (`41bfa5a`) in the task docs and the README note.

## Acceptance Criteria

- [ ] `git branch` no longer lists `test/lcdx-react-port-audit`; deleted via `-d` (safe form)
- [ ] `git ls-remote origin` no longer lists `refs/heads/test/lcdx-react-port-audit`
- [ ] `master`, `legacy-angular`, `backup` untouched (SHAs unchanged)
- [ ] README branch model reflects: master = React mainline; branch retired with anchor recorded
- [ ] `41bfa5a` still resolvable locally (`git cat-file -t 41bfa5a` → commit) → recovery needs no network
