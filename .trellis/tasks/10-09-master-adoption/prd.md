# Adopt the React port into master — two-parent commit with test's tree (commit-tree)

> ⚠️ **Correction (2026-10-09, during execution)**: an earlier revision of this PRD claimed
> `git merge -s ours test` **from master** was the chosen method. That was **backwards**: `-s ours`
> from master keeps **master's tree (the Angular tree)** and records test as a parent — the opposite
> of the goal. The error was caught by the acceptance check "tree-hash equality" immediately after a
> real merge was executed: master's tree came out identical to `b1c3fb4` (452 Angular files, no
> `src/router.tsx`). The wrong merge commit was discarded (`git reset --hard b1c3fb4`; it had never
> been pushed, zero external effect) and the method below was executed instead. Recorded honestly
> because the user explicitly asked for extra care ("操作前请再三确认，不要出错了").

## Goal

Phase 5 final step of the parent task `09-24-react-upstream-merge`: make `master` carry the React
implementation from `test/lcdx-react-port-audit`, in the **safest possible way** (user instruction:
"操作前请再三确认，不要出错了").

The user asked specifically: "最安全的做法是 merge 吧，把 test/lcdx-react-port-audit 合并到 master
怎么样更安全、更不容易出错" — so this task's core deliverable is a **method comparison** plus the
chosen, verified-safe execution.

## Method comparison

Facts established by dry-run analysis (all reproducible):

- `master...test/lcdx-react-port-audit` = **152 ahead / 114 behind**; merge-base is `defebab`.
- `git merge-tree --write-tree` reports **302 conflicting paths**.
- `src/app/` (old Angular code): **452 files on master, 0 on test** — deleted deliberately by the port.
  A plain merge would resurrect **95 of them** into the final tree, because delete/modify conflicts
  resolve toward keeping the modified file unless every one is hand-resolved to "delete".

| Method | History kept? | Tree = React tree? | Conflict risk | Angular resurrection risk | Verdict |
|---|---|---|---|---|---|
| `git reset --hard test` | ❌ drops the 152 master-only commits from master's ancestry | ✅ | none | none | 09-24's original Q1 plan; rejected now — user wants history preserved; future `git push origin master` would also need force |
| plain `git merge` | ✅ | ❌ mixed | **302 conflicts** | **95 Angular files resurrect** | worst option — days of hand-resolution, high error risk |
| `git merge -X theirs` | ✅ | ❌ | ~0 reported conflicts, **silently wrong**: favors theirs per-hunk but keeps master-only additions and can still halt on delete/modify | partial | deceptive green light; tree ≠ test tree |
| `git merge -s ours test` **from master** | ✅ | ❌ **keeps the Angular tree** | 0 | **total** (that IS the semantics) | ❌ **backwards — do not use** (see the correction note above) |
| **two-parent commit via `git commit-tree`** | ✅ both lines become ancestors | ✅ **bit-for-bit by construction** (the commit is literally created with `test^{tree}`) | **0** by construction | **none** by construction | **chosen** |

### Chosen method: `git commit-tree` with test's tree and two parents

There is no built-in `-s theirs` strategy in git merge (only `-s ours` exists). The canonical way to
express "**take their tree exactly, keep our history as an ancestor**" is to create the merge commit
directly:

```bash
M=$(git commit-tree "test/lcdx-react-port-audit^{tree}" -p master -p test/lcdx-react-port-audit -F merge-msg.txt)
git update-ref refs/heads/master "$M"    # executed while HEAD is on test, master not checked out
```

Properties, each independently verifiable afterwards:

1. `M`'s **tree is literally test's tree** (passed by tree-hash at creation — not derived by any
   conflict-resolution process, so nothing can leak in or out).
2. `M`'s parents are (old master `b1c3fb4`, test tip) — both histories reachable from master forever.
3. `origin/master` (`b1c3fb4`) is the **first parent**, so a future `git push origin master` is a
   **normal fast-forward**, no force needed.
4. `legacy-angular` / `backup` / `test` refs are untouched (update-ref touches exactly one ref).
5. No checkout of master is needed during the operation → no working-tree churn mid-operation.

(Equivalent porcelain recipe — `git checkout test && git merge -s ours master && git checkout master
&& git merge --ff-only test` — yields the same shape but moves the test branch tip; rejected because
the user said 别的不动.)

## Constraints

- **C1 (hard): do NOT push master** after the merge. `.github/workflows/deploy-test-server.yml`
  triggers on push to master (build + artifact). Pushing needs separate explicit user approval.
- **C2**: do not modify `legacy-angular` / `backup` / `test/lcdx-react-port-audit` branch tips
  (normal work commits on the working branch are the session's established pattern and are fine).
- **C3**: the merge commit message must record WHAT was merged and WHY this method, so future
  archaeology understands the Angular→React cutover.
- **C4**: before merging, verify the working tree is clean and record all four branch SHAs; after
  merging, verify tree-hash equality with test and that the other branches did not move.
- **C5**: `dist/`, `node_modules/`, `test-results/` are untracked and survive branch switches —
  they must not appear in any commit.

## Acceptance Criteria

- [ ] AC1 Before: `git status --short` clean (except this task's dir); four branch SHAs recorded.
- [ ] AC2 The merge commit is created with `git commit-tree <test-tree> -p <old-master> -p <test>`
      and installed with `git update-ref refs/heads/master`.
- [ ] AC3 After: `git rev-parse master^{tree}` == `git rev-parse test/lcdx-react-port-audit^{tree}`
      (bit-for-bit identical trees).
- [ ] AC4 After: `git merge-base --is-ancestor test/lcdx-react-port-audit master` → exit 0.
- [ ] AC5 After: `git merge-base --is-ancestor b1c3fb4 master` → exit 0 (old Angular history retained).
- [ ] AC6 After: `src/app/` count on master == **0**; `src/router.tsx` present on master.
- [ ] AC7 After: `npm run build` green with master checked out (same tree as test, must pass).
- [ ] AC8 After: `legacy-angular`, `backup`, `test/lcdx-react-port-audit` tips unchanged; no remote
      ref changed; **no push performed**; `origin/master` still `b1c3fb4`.
- [ ] AC9 `git log --graph` on master shows the two-parent merge commit with both lines.
