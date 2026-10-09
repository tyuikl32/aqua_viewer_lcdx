# implement.md — Progress Tracker

> Session handoff point. Update after every completed unit of work.

## How to resume

```bash
cd E:/ALL.Net/Project_LCDX_NET/aqua_viewer_lcdx
git status && git log --oneline -3        # expect clean tree on test/lcdx-react-port-audit
cat .trellis/tasks/10-09-parity-fork-notes/prd.md      # requirements + provenance audit
cat .trellis/tasks/10-09-parity-fork-notes/implement.md # this file
```

## Scope guard (do not drift)

**Docs-only task.** The user explicitly decided to KEEP the upstream parity harness rather than delete it
(deleting would just have to be redone on every upstream sync).

- ❌ Do NOT delete `playwright.parity.config.ts`, `tests/ui-parity/**`,
  `scripts/serve-legacy-baseline.mjs`, `scripts/add-hosts.ps1`
- ❌ Do NOT remove the 3 npm scripts
- ❌ Do NOT touch `vite.config.ts` (its proxies are live; proxy lines already match upstream)
- ✅ Only `.md` files may change

Any `git status` showing a deletion means the scope was violated — stop and revert.

## Plan

| # | Unit | Files | Commit |
|---|---|---|---|
| 1 | Fork note in the parity section of the quality spec | `.trellis/spec/frontend/quality-guidelines.md` | `docs(trellis): mark UI-parity harness as non-functional in this fork` |
| 2 | Directory-tree entries annotated | `.trellis/spec/frontend/directory-structure.md` | (same commit as #1) |
| 3 | Tests row in spec index | `.trellis/spec/frontend/index.md` | (same commit as #1) |
| 4 | Cross-reference in the LCDX regression README | `tests/lcdx-regression/README.md` | (same commit as #1) |
| 5 | README rewrite | `README.md` | `docs(readme): rewrite for the LCDX fork` |

Rationale for two commits: #1–#4 are "annotate the harness", #5 is "rewrite the README" — different
review units, both user-requested as separate items.

## Progress

**COMPLETE — 3 commits, docs-only, zero deletions, nothing pushed.**

| Commit | What |
|---|---|
| `c1a4ce0` | `docs(trellis): mark the UI-parity harness as non-functional in this fork` — quality-guidelines.md, directory-structure.md, index.md, tests/lcdx-regression/README.md |
| `c433480` | `docs(readme): rewrite for the LCDX fork` — README.md, 47 → ~250 lines, 7 sections |
| `9eb0fcc` | `docs(trellis): catch two more ui-parity references that still read as usable` — directory-structure.md:66, type-safety.md:117 |

### Why there is a third commit

The PRD's AC1 ("every remaining mention must be marked") was re-checked **after** commit 1 by grepping
all `*.md`. That found two earlier misses: the `tests/ui-parity/` line in the directory tree (still
described as an ordinary suite, and `tests/lcdx-regression/` was not listed at all), and the
**Verification section of `type-safety.md`**, which recommended `tests/ui-parity/` as a verification
path — actively misleading, since it cannot run here. Both fixed in `9eb0fcc`.

### Verification

| Check | Result |
|---|---|
| Zero deletions across all 3 commits | ✅ `git diff --name-status` shows only `M` (5 `.md`) and `A` (3 task files) |
| Harness files untouched | ✅ `playwright.parity.config.ts`, `tests/ui-parity/**`, `scripts/*`, `package.json`, `vite.config.ts` all unmodified |
| AC1 — every `ui-parity` / `serve-legacy-baseline` mention in non-archive docs carries a fork-status marker | ✅ remaining grep hits are continuation lines inside annotated blocks |
| AC3 — `npm run build` green | ✅ `tsc -b` + `vite build`, PWA 47 precache entries |
| i18n audit unaffected | ✅ `node scripts/audit-i18n.mjs` → `errors: []`, 1280 keys × 4 catalogs |
| Provenance table reproducible | ✅ every row re-derived via `git cat-file -e backup:<file>` / `git diff backup -- <file>` |

### README facts verified before writing (not copied from the old README)

- `notice()` exported at `src/lib/message.ts:29`; `api` at `client.ts:164`, `lcdx` at `client.ts:184`
- `Common.OperationFailed` exists in both `zh.json` and `en.json`
- `src/lib/menu.ts:25` comment confirms mai2-only: "旧版已删除 ongeki/chusan 两组，这里保持一致"
- `src/features/chuni/` = 27 files, `src/features/ongeki/` = 32 files, `src/router.tsx` = 60 `path:` entries
- backend `launchSettings.json`: `http://localhost:5104` / `:40508`
- `vite.config.ts` deviates from upstream in exactly 4 lines (PWA branding); proxy lines byte-identical


## Notes / gotchas

- Do not run `dotnet` from Bash (known env corruption). `py -3` is the working Python.
- `npm run lint` is not usable (no ESLint config, eslint not a dependency).
- Only commit, never push (user standing instruction).
