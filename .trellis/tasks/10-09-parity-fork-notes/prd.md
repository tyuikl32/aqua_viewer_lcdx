# Annotate the upstream-only UI-parity harness as non-functional in this fork; rewrite README

## Background

The upstream `RinNET_frontend` repo ships a **UI-parity harness** whose purpose is to diff the new React
build against the **old Angular build** (screenshot / behavior comparison), to prove the "用户无感切换"
claim of the port.

After forking, that harness is **dead code**: its baseline input does not exist on this machine. But
deleting it was explicitly rejected — see "Decision" below.

## Decision (user, 2026-10-09)

**KEEP the files. Do not delete.** Rationale given by the user:

> 删了下次跟上游同步又要改一次；既然没有功能性影响，就保留，写进 trellis 文档和 README。

This matches the project's standing principle: **align with upstream takes priority over local
tidiness** — every local deviation becomes a merge burden on the next upstream sync. The harness is
inert (not in the build chain, not in CI, not in `dist/`), so keeping it costs nothing at runtime.

Therefore this task is **documentation-only**. No file is deleted, no npm script is removed.

## Provenance audit — which of these are upstream, which are local?

Required by the user ("你提出的这几个，是rin上游的还是本机的"). Verified by diffing against the
`backup` branch (upstream main mirror):

| Artifact | Origin | Evidence |
|---|---|---|
| `playwright.parity.config.ts` | **Upstream** | present on `backup` |
| `tests/ui-parity/` (27 files) | **Upstream** | present on `backup` |
| `scripts/serve-legacy-baseline.mjs` | **Upstream** | present on `backup` |
| `scripts/add-hosts.ps1` | **Upstream** | present on `backup`; contains the upstream author's absolute path `C:\Users\rin\Documents\aqua_viewer_revived\...` |
| `package.json` → `test:ui-parity`, `test:ui-parity:auth`, `parity:legacy-server` | **Upstream** | present on `backup` |
| `vite.config.ts` → `/api`, `/Maimai2Servlet` proxies to `aqua.naominet.live` | **Upstream (proxy lines untouched); file carries local PWA branding** | verified: `git diff backup -- vite.config.ts` shows exactly 4 changed lines — `includeAssets` turtle.svg→laochan.svg, and PWA `name`/`short_name`/`description` RinNet→`LCDX - RinNet`. The two `proxy` targets are byte-identical to `backup`. **Still a live dependency** — see below |
| `scripts/gen-cert.mjs`, `ssl/` | Upstream (cert re-generated locally 2026-09-24) | script on `backup`; `ssl/portal.naominet.live.{crt,key}` regenerated locally |
| `playwright.lcdx.config.ts`, `tests/lcdx-regression/`, `test:lcdx-regression` | **Local (LCDX)** | verified NOT on `backup` (`git cat-file -e backup:playwright.lcdx.config.ts` fails) — this repo's own regression suite |

### Why `portal.naominet.live` must NOT be treated as a leftover

It is a **real runtime dependency**, in three places:

1. **Backend** — `LCDXNetApi/LCDXNetApi/appsettings.json` → `TitleSettings.RinnetHost`. Consumed by
   `LoginRegisterService.cs` (login via `/api/auth/signin`), `EulaService.cs`, `RinnetAdminTokenService.cs`.
2. **Frontend (browser)** — game-data pages call the RinNET main site directly; LCDX's own backend only
   serves `lcdx/*`.
3. **Frontend (dev proxy)** — `vite.config.ts` forwards `/api` + `/Maimai2Servlet` there, otherwise
   `npm run dev` cannot log in.

Only the **parity harness** wiring (`portal.naominet.live` → `127.0.0.1` hosts entry) is fork-dead.

## Why the harness cannot run here (evidence)

1. `scripts/serve-legacy-baseline.mjs` line ~10 resolves its static root to
   `../aqua_viewer/dist/aqua-viewer/browser`. **Verified missing**: `ls ../aqua_viewer` →
   `No such file or directory`. Lines 19-23 then `throw new Error('Legacy parity prerequisite is missing')`.
   So it fails at startup, by its own assertion — not intermittently.
2. `playwright.parity.config.ts` starts that script as one of two `webServer` entries, so the whole
   suite cannot boot.
3. `tests/ui-parity/` is dominated by `chuni-*` (6) and `ongeki-*` (5) specs — pages that are **frozen**
   in this fork (aligned with upstream, no local changes). Even if it ran, differences there are not
   actionable.
4. CI does not run it: `.github/workflows/deploy-test-server.yml` does `npm ci` → `npm run build` →
   `tar dist/`. No test step.

## Requirements

- **R1** Add a clearly-visible fork note stating the UI-parity harness is **non-functional in this fork**
  and why (missing Angular baseline), plus the fact that it is intentionally kept for upstream alignment.
  Place it where a developer would look: the trellis spec files that describe it, and the README.
- **R2** Do **not** delete or modify the harness itself (`playwright.parity.config.ts`,
  `tests/ui-parity/**`, `scripts/serve-legacy-baseline.mjs`, `scripts/add-hosts.ps1`, the 3 npm scripts).
  Keeping them byte-identical to upstream is the whole point.
- **R3** Do **not** touch `vite.config.ts` proxies or `ssl/` — they are live dependencies (see above).
- **R4** Clarify in the README that this is the **LCDX fork** (deployed at `lcdxnet.am-allnet.com` with
  the `LCDXNetApi` backend), not upstream RinNET, and that the `portal.naominet.live` dev-host setup
  remains required because the backend authenticates against it.
- **R5** Record the provenance table above in the docs so the "upstream vs local" distinction does not
  have to be re-derived.

## Scope

| In scope | Out of scope |
|---|---|
| `.trellis/spec/frontend/quality-guidelines.md` (parity section) | Any deletion of harness files |
| `.trellis/spec/frontend/directory-structure.md` (tree entries) | `vite.config.ts` changes |
| `.trellis/spec/frontend/index.md` (tests row) | `ssl/` changes |
| `tests/lcdx-regression/README.md` (cross-ref line) | `package.json` script removal |
| `README.md` (rewrite: fork identity, harness note, provenance) | Backend (`LCDXNetApi`) changes |

## Acceptance Criteria

- [ ] Grep for `test:ui-parity` / `playwright.parity` / `serve-legacy-baseline` in `*.md` returns only
      text that explicitly marks the harness as non-functional in this fork.
- [ ] `git status` shows **zero deletions** of harness files — only `.md` files modified.
- [ ] `npm run build` still green (docs-only change must not break anything).
- [ ] README states: fork identity, target deployment, dev-env prerequisites, and that
      `portal.naominet.live` is a **backend** dependency rather than a leftover.
- [ ] Every claim in the provenance table is reproducible by a `git diff backup <file>` check.
