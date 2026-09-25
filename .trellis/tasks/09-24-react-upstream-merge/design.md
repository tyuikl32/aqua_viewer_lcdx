# Design — Upstream React Rewrite Merge & LCDX Feature Port

## 1. Situation analysis

### 1.1 What actually happened upstream (intent, not diff)

The 41 upstream commits are not a UI refresh — they are a **full-stack rewrite of the frontend**, executed with deliberate engineering discipline:

| Commit cluster | Intent |
|---|---|
| `5e7056b` bootstrap React + shadcn workspace (revived) | Revive an abandoned React branch as the new foundation |
| `b8505d3`, `9085e35` core infrastructure, app shell, data router | Rebuild shell/routing (react-router 7 `createBrowserRouter`) |
| `cd6611b` M2 account pages | Dashboard/profile/cards/keychip/importer/announcements |
| `4b12e04`..`2a54776` M3 ongeki + parity migration | All 12 ongeki pages |
| mai2/chuni pages | All 13 mai2 + 10 chuni v2 pages |
| `90d8f11`, `b512ca7`, `6660183` theme system | Semantic-token theme system, Liquefy + Animal Friends themes |
| parity suite (`tests/ui-parity/*`, `serve-legacy-baseline.mjs`) | Screenshot/behavior parity harness vs the old Angular build |
| `178746a` AGPL license, CI updates | Governance |

Upstream explicitly targets "1:1 equivalence with the old Angular version, user-imperceptible switch" (README). Concretely they preserved: localStorage key names/structures, IndexedDB `Aqua` v6 (16 stores), i18n key structure with `{{}}` interpolation (i18next reads the *same* JSON files), API paths, `--bs-*` CSS variables rebuilt as theme tokens (Bootstrap 5.3.3 kept as a devDependency bridge). Every ported service carries a `等价旧版 xxx` (equivalent of legacy xxx) header comment.

**This is the single most important fact for our plan**: upstream already solved "Angular semantics → React implementation" for the shared app. Our job is the same translation, applied to the parts upstream never had — the LCDX features — plus replaying LCDX modifications onto shared pages.

### 1.2 Why `git merge master ← backup` is impossible

- `backup` **deletes the entire `src/app/` Angular tree** (690 files changed). There is no common file "language" between sides: master's world is `*.component.ts` + modules + services; backup's world is `*.tsx` + `lib/` + hooks.
- A merge would surface thousands of delete/modify and add/add conflicts with no semantically correct resolution; git's rename detection cannot help (contents are 100% rewritten).
- Correct mental model: this is a **rebase of intent**, not a merge of text.

### 1.3 Inventory — what we get for free (no porting needed)

- All shared pages in React: Home, SignIn/SignUp/PasswordReset/OAuth-callback, Dashboard, Profile, Cards, Keychip, Importer, Announcements (+Edit), Admin, Contributors, NotFound, Banned, EULA.
- Full game sections: mai2 (13 pages), chuni v2 (10), ongeki (12) — including LCDX-era upstream fixes LCDX never had (chuni version filters, ongeki search suggestion fix, scroll/dialog/animation polish).
- New theme system (semantic tokens, Liquefy / Animal Friends / legacy), PWA via vite-plugin-pwa, HTTPS dev server on `portal.naominet.live` with self-signed certs, AGPL license.
- Parity test infrastructure we will reuse to verify our own ports.

### 1.4 Inventory — what must be ported (from `defebab..master`, 152 commits)

**A. Infrastructure**

| Angular source | React target | Notes |
|---|---|---|
| `api.service.ts` `getLcdx/postLcdx/deleteLcdx` + `environment.lcdxApiServer` | extend `src/lib/api/client.ts` with an LCDX client | prod same-origin `/` (verify reverse-proxy prefixes), dev `https://lcdxnet.am-allnet.com/`; share token refresh logic |
| `bot-permission.service.ts` | `src/lib/botPermission.ts` | five-tier constants 0/1-3/4-6/7-9/10, thresholds 0/1/4/7/10; mirror of `LCDXNetApi/Services/PermissionLevels.cs` |
| `auth/cabinet-guards.service.ts` | route guards in `src/router.tsx` | P≥4 / P≥7 gating for cabinet pages |
| i18n `zh/en.json` (982 keys, 24 top groups) | merge into `src/i18n/{zh,en}.json` | master adds `NetCodeBindPage`, `NotFound`, `AdminPage`, cabinet groups etc.; upstream adds new theme/filter keys; structure & `{{}}` interpolation identical |
| `environment.maiAssetsHost` (alist.am-allnet.com) | `.env` / `VITE_ASSETS_HOST` handling | check where mai asset host is consumed in React code |
| `src/assets/laochan.svg` | `public/assets/` | brand asset |
| `menu.service.ts` LCDX entries | `src/lib/menu.ts` | mai2 group: cabinets/cabmode/locks/remote/kop entries with display conditions (permission-based, not just HasProfile) |

**B. LCDX-only pages → new React feature pages** (no upstream counterpart; full port)

| Page | Key complexity |
|---|---|
| `maimai2-cabinets` | list + player-count windows (incl. daily) via `lcdx/cabinet/global-players` |
| `maimai2-remote-control` | command dispatch, permission filtering, locationName |
| `maimai2-locks` | tier model UI, inline note edit, P10 mandatory note, sorting, pagination |
| `maimai2-cabmode` | catalog-driven LC modes, 9-key LC settings + restore defaults, D13 tier gating (P≥4; 2-5 for P4-6, full for P7+), cc `CustomCameraConfig` editable |
| `maimai2-kop-ranking` | `lcdx/kop/rank`, XaCDN assets |
| `netcode-bind` | bind/add/remove/get access codes |
| `onetime-sign-in` | flow origin to confirm during research (see open questions) |
| `sega/maimai2/model/CabinetModels.ts` | types → `src/features/mai2/models` or shared lib |

**C. LCDX modifications to shared pages** (extract from `defebab..master`, re-express in React)

| File (Angular) | Δ | Nature of change |
|---|---|---|
| `maimai2-setting` | +210 | merge-request block (R4) + other deltas — biggest shared-page change |
| `sign-up` | +258/−387 | LCDX register flow (correct success/error messages, simplified form?) |
| `dashboard` | +471/−173 | LCDX dashboard restructure (content + a daily window) |
| `home` | +130/−156 | branding/ICP footer, content |
| `admin` | +87 | announcement mgmt vs LCDX backend (`lcdx/announcement/recent`?) |
| `menu.service` | ±174 | menu restructure for cabinet entries |
| `cards` | +36 | access-code related |
| `keychip` | +52 | FullKeychip / region display |
| `announcements`(+edit) | +31/+10 | LCDX backend integration |
| `profile`/`importer`/`user.service`/`maimai2-recent`/`maimai2-profile`/portrait dialog | small | misc (defaultCard.luid etc.) |

**D. LCDX deletions vs upstream restores**

- EULA: LCDX removed it; upstream React restored `/eula` + `eulaRequired` redirect in `RequireAuth`. → open question Q2.
- `onetime-sign-in`/`netcode-bind`: present on master, absent in React rewrite.

## 2. Strategy

**Baseline switch + intent-level port.** Do not attempt a text merge.

```
master (Angular, 152 LCDX commits)          backup (upstream React, 41 commits)
        │                                            │
        ├─ tag/branch: legacy-angular (safety line)  │
        │                                            │
        └────────── port intent ──────────► test/lcdx-react-port-audit (new branch from backup)
                                                     │  Phase 1..5
                                                     ▼
                                          master ← reset/merge (final, user decides)
```

- `legacy-angular` branch permanently preserves the Angular app (also used later as parity baseline).
- `test/lcdx-react-port-audit` starts from `backup`; `.trellis/` is copied in from master (not tracked upstream).
- Final adoption of `master`: recommended `git reset --hard` (linear history; a merge commit would carry no real merge semantics) — open question Q1.

### Porting model (how each item is translated)

1. Read the Angular source + its `defebab..master` commit messages to extract **intent** (what user sees, which APIs, which permission gates).
2. Find the upstream React pattern for the same concern (e.g. how `AdminPage` does authenticated data fetching, how menu guards work, how dialogs are done) and imitate it — keeps the codebase uniform.
3. UI translation: prefer shadcn/ui components + semantic theme tokens; the `--bs-*` bridge keeps old Bootstrap class idioms working where a 1:1 port is faster (upstream deliberately kept `bootstrap` for this).
4. i18n: reuse existing master keys verbatim; add new keys only when React idioms need new copy; zh/en in sync (project rule).
5. Verify: `tsc`+build, manual smoke against LCDXNetApi (dev), and where feasible a parity-style Playwright spec for the ported page.

## 3. Phased plan

### Phase 0 — Baseline preparation (no feature work)

1. `git branch legacy-angular master` (on master).
2. `git checkout -b test/lcdx-react-port-audit backup`; copy `.trellis/` from master; commit.
3. `npm install`, `npm run build` — confirm the React baseline builds as-is.
4. Record parity-harness prerequisites (certs via `npm run gen:cert`, hosts entry) — dev-env only, non-blocking.

### Phase 1 — Infrastructure (R1)

LCDX API client (shared token/refresh/loading with existing client), `botPermission` lib, router guards, i18n merge (scripted key diff: master 24 groups vs upstream 17 — union, conflict-free by construction), menu entries (may land as inert routes first), asset hosts + `laochan.svg`.
**Verify**: build green; existing pages unaffected; i18n key count ≥ master's 982 on both languages.

### Phase 2 — Cabinet pages (R2, largest chunk; order = risk ascending)

1. models + `cabinets` page
2. `remote-control`
3. `locks`
4. `cabmode` (most complex: catalog-driven modes, LC settings + tier gating)
Each page: route + guard + menu activation + i18n + smoke test vs dev LCDX API.
**Verify**: permission gating matrix (0/1/4/7/10) behaves exactly as Angular version (cross-check against locks spec on master).

### Phase 3 — Setting merge flow + standalone pages (R3/R4)

`maimai2-setting` merge-request block; `netcode-bind`; `onetime-sign-in`; `kop-ranking`.

### Phase 4 — Shared-page modification replay (R3)

For each row in §1.4-C: `git log -p defebab..master -- <file>` → distill LCDX intents → re-apply to the React counterpart. Dashboard first (largest), then sign-up, home, admin, then the small ones. Cross-check every replayed behavior against Angular UX.

### Phase 5 — Finalize

- Resolve open questions (EULA, theme default).
- `npm run build`; run upstream parity suite against `legacy-angular` dist where feasible (serve via `serve-legacy-baseline.mjs`, `LEGACY_DIST_DIR` pointed at Angular dist).
- Rewrite `.trellis/spec/frontend/*` for React/Vite/shadcn (directory structure, component→function component, service→lib/hook, state via `createStore`, i18next usage, keep the "user-facing messages localized" rule).
- Move `master` (strategy per Q1), update journal, archive task.

## 4. Risks

| Risk | Mitigation |
|---|---|
| Dashboard rewrite collision (LCDX restructured it heavily; upstream rebuilt it too) | Treat dashboard as its own mini-task in Phase 4; compare both versions side-by-side before coding |
| API base for LCDX endpoints in prod (same-origin `/` assumed) | Verify reverse-proxy mapping before Phase 1 client work; config via env, not hardcoded |
| Angular specs don't translate | Accept loss of karma unit tests; parity-style Playwright specs for critical pages (locks permission matrix) |
| Upstream moves again mid-port | Port is on a branch; re-sync = rebase backup pointer, port commits are additive |
| npm dependency drift (TS 7, Vite 8 are very new) | Pin via lockfile; `npm ci` |

## 5. Decisions (confirmed by user 2026-09-24)

- **Q1 → reset hard-switch.** `master` will `git reset --hard` to the ported branch; `legacy-angular` keeps the Angular history. (A merge commit would carry no real merge semantics.)
- **Q2 → EULA stays, but LCDX accounts must pass automatically.** Restore `/eula` + `eulaRequired` flow as upstream built it, but ensure LCDX-managed accounts are never stuck on the EULA page (no forced admin-assisted unblocking). Implementation: verify where `eulaRequired` comes from for LCDX accounts; if it can never be true for them, keep the flow untouched; otherwise auto-accept server-side for LCDX accounts (frontend hack is a last resort).
- **Q3 → port all three pages.** `onetime-sign-in`, `netcode-bind`, `kop-ranking` are all in scope (R2).
- **Q4 → Liquefy is the default theme.** Verify LCDX ported pages look coherent under Liquefy semantic tokens (the `--bs-*` bridge helps, but check cabinet cards specifically).
- **Q5 (CI)** — self-investigate during Phase 5: check whether the LCDX fork uses `deploy-test-server.yml` before adopting upstream workflow changes.
