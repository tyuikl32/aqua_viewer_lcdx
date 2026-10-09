# Sync the 7 post-port upstream commits from `backup` into `test/lcdx-react-port-audit`

## Goal

`test/lcdx-react-port-audit` was branched from `backup` at `90ed95b`. Upstream (`RinNET-OpenSource/
RinNET_frontend` main, mirrored locally as `backup`) has since advanced to `99029d7` — 7 commits.
Bring the LCDX port branch up to date **selectively**: replay what belongs to LCDX, skip what does not,
and adapt what collides with LCDX customization.

End state: the port branch contains every upstream change that is relevant to a mai2-only LCDX
deployment, builds green, passes the offline regression suite, and is ready for the final
`master reset --hard` (Phase 5 of the parent task).

## Background

- Port baseline: `90ed95b` (merge-base of `backup` and `test/lcdx-react-port-audit`).
- Port branch: 58 commits ahead of `90ed95b`, clean tree, synced to origin.
- `backup` HEAD: `99029d7` (2026-09-29).
- Delta to ingest: `git rev-list --reverse 90ed95b..backup` → 7 commits (listed in design.md).

## Requirements

### R1 — Classify every commit, with reasons

Each of the 7 commits must be labelled **PORT**, **SKIP**, or **ADAPT**, with an explicit rationale.
No commit may be left unclassified.

### R2 — Replay the ported changes by intent, not by raw cherry-pick

Where a commit touches a file LCDX has heavily customized (e.g. `AdminPage.tsx`, which LCDX rewrote
with 121+/242− lines), the change must be re-expressed against the LCDX version, keeping:

- the repo convention "upstream keeps Bootstrap class names; LCDX pages must not be rewritten into
  shadcn/Tailwind" (see `.trellis/spec/frontend/`),
- the i18n rule: **no hardcoded user-facing copy**; all four catalogs stay in sync
  (`src/i18n/{zh,en}.json` AND `public/assets/i18n/{zh,en}.json`).

### R3 — Dependency bumps applied consistently

`package.json` and `package-lock.json` must both be updated; `npm ci` must succeed afterwards.

### R4 — Verification

- `npm run build` (tsc -b && vite build) green.
- `npm run test:lcdx-regression` green (56 tests as of the last run).
- `node scripts/audit-i18n.mjs` reports no errors.
- If any ported code renders new user-visible strings, they must be localized (zh/en synced).

## Constraints

- Do **not** rewrite LCDX pages into shadcn/Tailwind.
- Do **not** commit or push until the user approves (see user rule: every stage confirmed).
- Do **not** touch `master` / `legacy-angular` in this task.
- Preserve the `ChuniV2`/`Ongeki` freeze rule *where it applies*: those features are frozen for
  local beautification, but they still must track upstream **fixes** — see the classification in
  design.md for how the ongeki fix is handled.

## Acceptance Criteria

- [ ] All 7 commits classified with rationale (design.md table).
- [ ] Ported commits replayed as individual, descriptive commits on `test/lcdx-react-port-audit`.
- [ ] `package.json` + `package-lock.json` bumps match upstream versions.
- [ ] `npm run build` exits 0.
- [ ] `npm run test:lcdx-regression` passes.
- [ ] `node scripts/audit-i18n.mjs` clean; zh/en key sets identical in both catalog copies.
- [ ] Working tree clean; branch pushed only with explicit user approval.
- [ ] Journal + implement.md updated; parent task (09-24) unblocked for Phase 5.
