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

### Step 1–4 — harness annotations ✅ (commit `feat`-style `docs`)

See results below.

### Step 5 — README rewrite ⏳

Target sections:
1. **What this is** — LCDX fork of RinNET portal; deployed at `lcdxnet.am-allnet.com`; backend is
   `LCDXNetApi` in the sibling directory (not upstream).
2. **Architecture** — the 3-way topology (browser / LCDX backend / RinNET main site), so the
   `portal.naominet.live` dependency is obvious rather than looking like a leftover.
3. **Local dev** — keep the existing hosts + cert + `npm run dev` steps, but explain WHY the host is
   needed (backend auth + OAuth callback + CDN referer).
4. **Upstream sync** — branch topology (`master` / `legacy-angular` / `backup` / working branch) and the
   "align with upstream, don't bend local files" rule.
5. **Testing** — `test:lcdx-regression` (works) vs `test:ui-parity` (**non-functional here**, with a
   pointer to the fork note).
6. **Compat contract** — keep the existing localStorage / IndexedDB / theme-attribute table (valuable).
7. **Directory map** — keep, lightly extended.

## Notes / gotchas

- Do not run `dotnet` from Bash (known env corruption). `py -3` is the working Python.
- `npm run lint` is not usable (no ESLint config, eslint not a dependency).
- Only commit, never push (user standing instruction).
