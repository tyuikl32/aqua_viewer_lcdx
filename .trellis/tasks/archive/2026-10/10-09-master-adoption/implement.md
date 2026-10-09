# implement.md — Progress Tracker

## Result: COMPLETE — master now carries the React tree with both histories; nothing pushed

### The near-miss (recorded honestly, per the user's "不要出错了")

The first execution attempt used `git merge -s ours test/lcdx-react-port-audit` **from master** —
following the method as initially written in the PRD. That method was **backwards**: `-s ours` from
master keeps **master's tree (the Angular tree)** and merely records test as a second parent. The
post-merge verification (AC3, tree-hash equality) caught it immediately:

- master's tree after the wrong merge == `b1c3fb4`'s tree — **452 Angular files, no `src/router.tsx`**.

The wrong merge commit `4f1b87d` was discarded with `git reset --hard b1c3fb4` (reflog confirms; it was
**never pushed**, zero external effect), the PRD was corrected, and the proper method below was executed.

### Correct method executed: `git commit-tree` two-parent commit

```bash
MT=$(git rev-parse master)                                   # b1c3fb45e5bd… (Angular tip, first parent)
TT=$(git rev-parse test/lcdx-react-port-audit)                # 5f2a25e1d0c0… (React tip, second parent)
TTREE=$(git rev-parse "test/lcdx-react-port-audit^{tree}")    # b8bf10e8bba2… (React tree)
M=$(git commit-tree "$TTREE" -p "$MT" -p "$TT" -F merge-msg.txt)
# → b4731f9fdabbbe669832c0d1cc48ccfe1c903d30
git update-ref refs/heads/master "$M"    # executed while HEAD was on test — master not checked out
```

Why this is the safest form of "merge" for this situation:

- The commit is **created with test's tree-hash directly** — no conflict-resolution machinery runs at
  all, so nothing can leak in (no Angular resurrection) or out (no React file lost).
- Both histories become ancestors of master (two explicit parents).
- `update-ref` touches exactly **one ref**; legacy-angular / backup / test / remotes untouched.
- First parent = `b1c3fb4` = current `origin/master`, so a **future push of master is a normal
  fast-forward** — no force-push ever needed.

### Acceptance results

| AC | Check | Result |
|---|---|---|
| AC1 | clean tree + 4 branch SHAs recorded pre-op | ✅ (in prd + below) |
| AC2 | commit-tree + update-ref, explicit SHAs | ✅ `M = b4731f9` |
| AC3 | `master^{tree}` == `test^{tree}` | ✅ both `b8bf10e8bba2…` |
| AC4 | test ⊆ master | ✅ `is-ancestor` exit 0 |
| AC5 | `b1c3fb4` ⊆ master (Angular history kept) | ✅ exit 0 |
| AC6 | `src/app/` on master = **0**; `src/router.tsx` present | ✅ 0 / 1 |
| AC7 | `npm run build` on checked-out master | ✅ green; `dist/index.html`, `sw.js`, `manifest.webmanifest` all emitted |
| AC8 | other tips unchanged; **no push**; `origin/master` still `b1c3fb4` | ✅ (remote listing unchanged) |
| AC9 | two-parent graph | ✅ `* b4731f9 … |\` with test line visible |

### Branch state after the operation

| Branch | Before | After |
|---|---|---|
| `master` | `b1c3fb4` (Angular) | **`b4731f9` (merge: React tree, parents b1c3fb4 + 5f2a25e)** |
| `legacy-angular` | `b1c3fb4` | `b1c3fb4` (untouched) |
| `backup` | `99029d7` | `99029d7` (untouched) |
| `test/lcdx-react-port-audit` | `5f2a25e` | `5f2a25e` (untouched by the merge; its own docs commits are session work) |
| `origin/master` | `b1c3fb4` | `b1c3fb4` (**not pushed** — CI triggers on master push) |

### Remaining follow-ups (NOT done, need user approval)

1. **Push master** (`git push origin master`): normal fast-forward for the remote, but it fires
   `.github/workflows/deploy-test-server.yml` (npm ci → build → artifact). Awaiting explicit approval.
2. Also unpushed on the working branch: 5 commits from this evening (parity docs, README, legacy
   archive record, adoption docs). Same standing no-push rule applies.
3. Parent task `09-24-react-upstream-merge` Phase 5: "Adopt into master (Q1)" is now DONE; the only
   remaining item there is the UI-parity suite (blocked by design in this fork — documented as
   non-functional). Consider archiving 09-24 after user review.
4. `09-14` / `09-28` / `09-29` task archiving — waiting per "告诉我但不开工".
