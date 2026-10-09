# Adopt the React port into master — `git merge -s ours`

## Goal

Phase 5 final step of the parent task `09-24-react-upstream-merge`: make `master` carry the React
implementation from `test/lcdx-react-port-audit`, in the **safest possible way** (user instruction:
"操作前请再三确认，不要出错了").

The user asked specifically: "最安全的做法是 merge 吧，把 test/lcdx-react-port-audit 合并到 master
怎么样更安全、更不容易出错" — so this task's core deliverable is a **method comparison** plus the
chosen, verified-safe execution.

## Method comparison (why `-s ours` and not the other three)

Facts established by dry-run analysis (all reproducible):

- `master...test/lcdx-react-port-audit` = **152 ahead / 114 behind**; merge-base is `defebab`.
- `git merge-tree --write-tree` reports **302 conflicting paths**.
- `src/app/` (old Angular code): **452 files on master, 0 on test** — deleted deliberately by the port.
  A plain merge would resurrect **95 of them** into the final tree, because delete/modify conflicts
  resolve toward keeping the modified file unless every one is hand-resolved to "delete".

| Method | History kept? | Tree = React tree? | Conflict risk | Angular resurrection risk | Verdict |
|---|---|---|---|---|---|
| `git reset --hard test` | ❌ drops the 152 master-only commits from master's ancestry | ✅ | none | none | 09-24's original Q1 plan; rejected now — user wants history preserved; also loses the "no force-push needed" property (below) |
| plain `git merge` | ✅ | ❌ mixed | **302 conflicts** | **95 Angular files resurrect** | worst option — days of hand-resolution, high error risk |
| `git merge -X theirs` | ✅ | ❌ | ~0 reported conflicts, **silently wrong**: theirs-only resolution keeps master-only **additions** (e.g. `angular.json` may survive; spec files blend) | partial | deceptive "no conflict" green light; tree ≠ test tree |
| **`git merge -s ours test`** | ✅ master's 152 commits stay in ancestry | ✅ **bit-for-bit** | **0** by construction | **none** by construction | **chosen** |

### Why `-s ours` is the correct semantics here (not a hack)

The "ours" strategy means: *the merge result is master's current tree, unchanged* — while **recording
test as a second parent**. That is exactly the intent: "React tree wins wholesale; the old Angular
history remains reachable." Nothing from test's tree leaks in (not needed — test's tip **is** the
tree we want), and nothing of master's tree survives (not wanted).

After the merge:

- `master` tree == `test/lcdx-react-port-audit` tree, **verified by tree-hash equality**, not by spot checks.
- `git rev-list --count test..master` ≥ 1 (merge commit) and `master..test` = 0 → test fully contained.
- The 152 old commits remain reachable **from master itself** (no need to check out legacy-angular).
- **No force-push required**: origin/master (`b1c3fb4`) remains an ancestor of the new master, so a
  future `git push origin master` is a normal fast-forward from the remote's point of view.

### Why the switch stays on `test/lcdx-react-port-audit` during the merge

`git merge -s ours` must be run **from master's tip** (`b1c3fb4` = legacy Angular tree). Running it the
other way (`git checkout test && git merge -s ours master`) would make **test** the parent and do
nothing to master. So: `git checkout master` → merge → `git checkout test/lcdx-react-port-audit` back.
The working tree is clean, so checkout is safe.

## Constraints

- **C1 (hard): do NOT push master** after the merge. `.github/workflows/deploy-test-server.yml`
  triggers on push to master (build + artifact). Pushing needs separate explicit user approval.
- **C2**: do not modify `legacy-angular` / `backup` / `test/lcdx-react-port-audit` branches.
- **C3**: the merge commit message must record WHAT was merged and WHY this strategy, so future
  archaeology understands the Angular→React cutover.
- **C4**: before merging, verify the working tree is clean and record all four branch SHAs; after
  merging, verify tree-hash equality with test and that the other branches did not move.
- **C5**: `dist/` and untracked runtime dirs stay untracked — the merge does not touch them.

## Acceptance Criteria

- [ ] AC1 Before: `git status --short` clean (except this task's dir); four branch SHAs recorded.
- [ ] AC2 The merge command is exactly `git merge --no-ff -s ours test/lcdx-react-port-audit` on master.
- [ ] AC3 After: `git rev-parse master^{tree}` == `git rev-parse test/lcdx-react-port-audit^{tree}`
      (bit-for-bit identical trees).
- [ ] AC4 After: `git merge-base --is-ancestor test/lcdx-react-port-audit master` → exit 0.
- [ ] AC5 After: `git merge-base --is-ancestor b1c3fb4 master` → exit 0 (old Angular history retained).
- [ ] AC6 After: `src/app/` count on master == **0**; `src/` has the React layout (`src/router.tsx` etc.).
- [ ] AC7 After: `npm run build` green on the merged master (same tree as test, so must pass; run on
      the checked-out master to be certain — requires a fresh checkout copy of files since dist/node_modules
      are per-branch; node_modules is untracked so it persists across checkout).
- [ ] AC8 `legacy-angular`, `backup`, `test/lcdx-react-port-audit`, all remote refs untouched
      (`git ls-remote` unchanged except nothing).
- [ ] AC9 No push performed; origin/master still `b1c3fb4`.
