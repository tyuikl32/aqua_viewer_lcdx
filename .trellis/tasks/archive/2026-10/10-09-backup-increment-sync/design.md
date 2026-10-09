# Design — selective sync of 7 upstream commits onto the LCDX React port

> Investigation date: 2026-10-09. All findings below were verified against the actual repository
> state (`git show`, `git diff --stat backup..test/lcdx-react-port-audit`, grep on working tree).
> **No code has been changed yet.**

## 1. The delta

```
git rev-list --reverse 90ed95b..backup   # 7 commits
```

| # | Commit | Date | Subject | Files |
|---|---|---|---|---|
| 1 | `7e3c1cc` | 09-27 | feat: add playlog inquiry functions | 5 (+1301) |
| 2 | `f352515` | 09-29 | fix: ongeki export index.html + modal confirm buttons reload (#56,#55) | 7 (+11/−10) |
| 3 | `5489245` | 09-29 | chore(deps): bump crypto-js 4.1.1 → 4.2.0 | pkg + lock |
| 4 | `4ff21ba` | 09-29 | chore(deps-dev): bump @types/pixelmatch 5.2.6 → 7.1.0 | pkg + lock |
| 5 | `aa49de3` | 09-29 | chore(deps-dev): bump vite 8.2.2 → 8.3.0 | pkg + lock |
| 6 | `0b862f0` | 09-29 | chore(deps-dev): bump @playwright/test 1.62.1 → 1.63.0 | pkg + lock |
| 7 | `99029d7` | 09-29 | chore(deps): bump fast-uri to 3.1.8 (CVE-2026-84292 / CVE-2026-84394) | lock only |

## 2. Classification

### 2.1 PORT — ingest as-is

**#3–#7, all five dependency commits.** No LCDX conflict surface: LCDX did not pin or fork any of
these packages. Verified LCDX `package.json` still shows the pre-bump ranges, which proves the
upstream bumps are genuinely absent:

| Package | LCDX current | Upstream target | Channel |
|---|---|---|---|
| `crypto-js` | `^4.1.1` | `^4.2.0` | dependency |
| `@types/pixelmatch` | `^5.2.6` | `^7.1.0` | devDependency |
| `vite` | `^8.2.2` | `^8.3.0` | devDependency |
| `@playwright/test` | `^1.62.1` | `^1.63.0` | devDependency |
| `fast-uri` | — | `3.1.8` | **transitive only** (lockfile) |

Notes:
- `fast-uri` is not a direct dependency; the commit only touches `package-lock.json`. It carries two
  CVE fixes and should be taken regardless of any other decision.
- `vite` 8.2.2 → 8.3.0 is a minor bump on a very fast-moving major; `npm run build` must be
  re-verified after applying it (R4).
- `@types/pixelmatch` 5 → 7 is a two-major jump of a *types-only* package; it is only used by the
  upstream UI-parity suite. Low risk, but if `tsc -b` complains in `tests/ui-parity/`, prefer
  keeping the upstream version and fixing the type usage over pinning backwards.

**Mechanism:** these five are safest as individual `cherry-pick`s — they touch only
`package.json` / `package-lock.json`, files LCDX never modified, so they apply cleanly.

### 2.2 ADAPT — PORT, but the primary file was rewritten by LCDX

**#2 `f352515` — ongeki export + modal confirm-button reload fix.**

This commit is a genuine cross-cutting bug fix, not cosmetic ongeki polish. Its diff splits into
three groups:

| Group | Files | Verdict |
|---|---|---|
| **a. Shared public pages** — the reload bug | `AnnouncementsPage`, `CardsPage`, `KeychipPage`, `ProfilePage` | **MUST PORT** — plain `type="button"` additions inside `<form>`; without them, confirming a delete/modal reloads the page on these four LCDX-relevant pages |
| **b. `client.ts` doc comment** | `src/lib/api/client.ts` | **PORT** — comment-only, clarifies that `rawFetch` requires an absolute path |
| **c. ongeki files** | `OngekiRivalPage`, `OngekiSettingPage` | See below |

**On the ongeki split (the nuance worth flagging):** the `OngekiSettingPage` half is *the same class
of bug* as group (a) — the profile export used `rawFetch('api/game/ongeki/export')` **without a
leading slash**, so it resolved relative to the current route and downloaded the SPA's `index.html`
instead of the JSON export. This is a real functional defect, not styling.

The LCDX repo rule ("ChuniV2/Ongeki are frozen — do not touch") exists to avoid **diverging from
upstream**; porting an *upstream fix verbatim* is the opposite of divergence. **Recommendation:
port group (c) too, as a verbatim copy of the upstream diff** (it is a 1-line `type="button"`, a
6-line import/method swap). This keeps LCDX identical to upstream for those files, which is exactly
the stated goal. If you prefer a strict literal reading of the freeze rule, group (c) can be dropped
— but note that LCDX currently does have the ongeki export bug, since LCDX does carry
`src/features/ongeki/`.

Verified: the LCDX `client.ts` **already exposes `api.blob(path)`** (used by profile export), so the
upstream replacement `api.blob('api/game/ongeki/export')` needs no new API surface. The only
behavioral difference is `buildUrl` prefixing — this is precisely the bug being fixed.

**Mechanism:** split into two commits — (a)+(b) as one "shared page reload fix", (c) as a separate
"ongeki export + confirm" commit so it can be dropped independently if the freeze rule is enforced
literally.

### 2.3 PORT-WITH-REWORK — the one real conflict

**#1 `7e3c1cc` — admin playlog inquiry.**

New files (apply cleanly, no LCDX conflict):

| File | Lines | Notes |
|---|---|---|
| `src/features/admin/AdminPlaylogs.tsx` | 275 | new dir `src/features/admin/` (does not exist yet on LCDX — no conflict) |
| `src/features/admin/playlogs.ts` | 45 | imports `api`, `StatusCode`, contracts — all present on LCDX |
| `src/lib/api/admin-playlog-contracts.ts` | 671 | pure types, zero imports |

All four UI dependencies already exist on LCDX (`@/components/ui/dialog`, `@/components/shared/
Pagination`, `@/lib/api/client`, `@/lib/models`) — verified by file existence on the working tree.

**The collision is `src/pages/AdminPage.tsx` only.** LCDX rewrote this file heavily
(`+121 / −242` vs backup) — among other things it **removed the EULA tab entirely** (parent task
Phase 4, per upstream LCDX commit `e1f80ea`). Upstream's `AdminTab` union is
`'users' | 'keychips' | 'eula' | 'playlogs'`; LCDX's is already `'users' | 'keychips'` (EULA gone).
A raw cherry-pick **will conflict**.

Required rework in `AdminPage.tsx`, expressed against the LCDX shape:

1. Extend the LCDX union: `type AdminTab = 'users' | 'keychips' | 'playlogs'`.
2. Add the `游玩记录` tab button (do **not** re-introduce the EULA button).
3. Render `{tab === 'playlogs' && <AdminPlaylogs />}`.
4. Port the `keychipId` search-field guard in `loadUsers` (early-return with a warning when empty).
5. Add the `keychipId` `<option>` to the search-field `<select>` + the explanatory note.

**Mandatory i18n rework (R2).** Upstream's `AdminPlaylogs.tsx` ships **hardcoded Chinese** copy
(verified: 25+ matches for CJK on lines 20–124, e.g. `'Aqua 用户名'`, `'游玩记录详情'`,
`'正在加载详情…'`, `'重试'`, `'未绑定 Aqua'`). The same is true of the tab button and the guard
message added to `AdminPage.tsx` (`'游玩记录'`, `'请输入 Keychip ID'`, the keychipId note). This
**violates the repo's i18n rule** and must be converted to `t('Key')` with new keys added to all four
catalogs. Suggested key prefix: `AdminPage.Playlogs.*` and `AdminPage.Tab.Playlogs`.

> Note: this is an upstream code-quality gap, not an LCDX regression. LCDX's own i18n sweep
> (parent Phase 5) had already driven hardcoded copy to zero; ingesting #1 verbatim would re-open it.

### 2.4 Not present in the delta (checked, no action)

- No changes to `router`, `menu`, `theme`, or LCDX-specific directories.
- No i18n **catalog** changes upstream (the 4-catalog sync requirement is driven purely by the
  ADAPT rework in 2.3).
- No upstream changes to `src/lib/api/client.ts` beyond the doc comment in group (b).

## 3. Recommended execution order

Ordered to keep every step independently revertible and to run the expensive checks once.

1. **Dependency commits (#3–#7)** — five cherry-picks, then `npm ci` + `npm run build`.
2. **Shared-page reload fix (#2 a+b)** — `type="button"` additions on the four pages + the
   `client.ts` comment.
3. **Playlog feature (#1)** — drop in the three new files verbatim; rework `AdminPage.tsx` against
   the LCDX shape; **localize all new copy**; add keys to all four catalogs.
4. **Ongeki half of #2** — separate commit; include only if the freeze rule is read permissively
   (recommended).
5. **Verification** — `npm run build`, `npm run test:lcdx-regression`, `node scripts/audit-i18n.mjs`,
   zh/en key-parity check.
6. **Stop and report** — commit locally, do **not** push, do **not** touch `master` until the user
   approves (user standing rule).

## 4. Open decisions for the user

| # | Decision | Recommendation |
|---|---|---|
| D1 | Include the ongeki half of `f352515`? | **Include** — it is an upstream fix; identical-to-upstream is the freeze rule's goal |
| D2 | Localize `AdminPlaylogs` (diverge from upstream) or ingest verbatim (hardcoded zh)? | **Localize** — repo i18n rule is a hard constraint; upstream copy is a known gap |
| D3 | Push the result to origin, or keep local until master adoption? | Keep local until the user approves (matches existing workflow) |
| D4 | Cherry-pick (preserves upstream hashes/narrative) vs. squash into fewer LCDX commits? | Cherry-pick the dep bumps; hand-craft the ADAPT commits so their messages explain the LCDX rework |

## 5. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| `vite` 8.3.0 breaks the build | Low | Build gate at step 1; revert the single bump if needed |
| `AdminPage.tsx` rework drops an LCDX behavior | Medium | Diff LCDX AdminPage against backup before editing; keep EULA removed |
| New hardcoded copy slips in | Medium | `scripts/audit-i18n.mjs` + CJK grep as a gate |
| Ongeki freeze rule interpretation | Low | Isolated commit (step 4) — trivially droppable |
| Proxy/TLS instability during push | Medium | Known: use `CURL_CA_BUNDLE=/ucrt64/etc/ssl/certs/ca-bundle.crt` + `-c http.sslBackend=openssl -c http.proxy=http://127.0.0.1:7897` (recorded 2026-10-09) |
