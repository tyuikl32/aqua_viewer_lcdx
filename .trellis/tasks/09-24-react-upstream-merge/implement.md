# Implement — Progress Tracker

> **This file is the session handoff point.** Update it after every completed unit of work.
> A fresh session should be able to continue from this file + design.md alone.

## How to resume (for a new session)

```bash
cd E:/ALL.Net/Project_LCDX_NET/aqua_viewer_lcdx
git status && git log --oneline -5          # confirm clean tree on migrate/react-port
py -3 ./.trellis/scripts/task.py start 09-24-react-upstream-merge   # re-activate session task
py -3 ./.trellis/scripts/task.py current    # verify
cat .trellis/tasks/09-24-react-upstream-merge/implement.md   # this file — read "Current position"
```

Context docs (read in order): `design.md` (full analysis & phased plan) → `prd.md` (requirements/acceptance) → this file.
**Also read `.trellis/spec/frontend/` — it was rewritten for React on 2026-09-25 and is now accurate** (it used to be Angular-era docs).

## User-confirmed decisions (2026-09-24, do not re-ask)

- Q1: final adoption = `master reset --hard` to ported branch; `legacy-angular` branch keeps Angular history.
- Q2: EULA — superseded: the whole EULA feature was **removed** to match LCDX upstream commit `e1f80ea` (see Phase 4).
- Q3: port all three standalone pages (onetime-sign-in, netcode-bind, kop-ranking). ✅ done.
- Q4: default theme = **Liquefy**. ✅ verified at runtime.
- Q5 (CI): self-investigate. ✅ done — the fork *does* use `deploy-test-server.yml`; its customizations were merged back (commit `eced86a`).

## Current position (updated 2026-09-25 session 4)

**Phase 0 ✅ · Phase 1 ✅ · Phase 2 ✅ · Phase 3 ✅ · Phase 4 ✅ · Phase 5 ⏳ 5 of 6 done — see Phase 5 below**

**45 commits ahead of `backup`, all local (user asked to commit but NOT push).** Working tree clean.
`master` is still the old Angular code; `legacy-angular` points at it — do not touch them until Phase 5's last step.

### Phase 4 — Shared-page replay ✅ COMPLETE

Every delta measured from `defebab..master` has been replayed into the React counterpart. Commits, in order:

| Commit | What |
|---|---|
| `4b1e7fd` | dashboard: quick-nav tiles, global-players card (only caller of `lcdx/cabinet/global-players`), card unbind, index-based announcements |
| `b7fab46` | menu: hide ongeki/chusan sidebar groups (LCDX is mai2-only); code preserved, not deleted |
| `18dbf8b` | router: remove duplicated `/onetime-sign-in` + `/netcode-bind` entries |
| `10e2efc` | sign-up: LCDX QQ-only register/reset (`lcdx/register_start` + `register_confirm`), "注册账号或重设密码" |
| `cbe5c7f` | sign-in: LCDX QQ login (`POST lcdx/login` → `login_lcdx_common`) + TOTP; email/passkey/OAuth entry points dropped |
| `eeb49d0` | shell + home: laochan hero, "NET" title, ICP 备案 footer, trimmed nav/user menu |
| `60c1248` | admin + announcements: LCDX backend wiring (`lcdx/announcement/*`), admin EULA tab dropped |
| `21fc2d1` | not-found: LCDX 404 redesign (Bootstrap card + terminal log + i18n) |
| `ff36ec9` | i18n replay: keychip / cards / profile / importer / mai2-recent+profile |
| `9c4c50a` | i18n replay: oauth-callback + password-reset |
| `5fb27b6` | **EULA removed entirely** (components, route, status codes) per LCDX upstream `e1f80ea` |
| `290cacc` | error-object `notice` passthrough → `Common.OperationFailed` |
| `c88af01` | notices localized in rival / card / rating / dxpass pages |
| `75838b9` | **repo-wide notice sweep → zero hardcoded strings** |
| `cf62226` | maimai2 images routed through `maiAssetsHost` CDN |
| `7633613` | four missed LCDX deltas: rival ID obfuscation (`60001233 - id`), vsRank icon inversion, song versions `PRiSM+`/`CiRCLE`, Chuni username placeholder |
| `33c36b7` | branding: index.html title/favicon, PWA manifest, prod CDN env |

**EULA resolution (was Q2).** The concern was "LCDX accounts must never be stuck on the EULA page".
Investigation: `eulaRequired` came from the backend `api/account/status`, and the frontend flow was
self-service (so never permanently stuck by frontend logic) — but LCDX upstream had already deleted
the feature outright in `e1f80ea`. We followed upstream and removed it. **No frontend hack, no
backend change needed.**

### Phase 5 — Finalize ⏳ 5 of 6 done

| Item | Status | Evidence |
|---|---|---|
| Liquefy as default theme (Q4) | ✅ **verified** | `DEFAULT_FAMILY = 'liquefy'` in `src/lib/theme.ts` (+ `'modern'` migration); at runtime `<html data-theme="liquefy" data-color-scheme="light" data-bs-theme="light">`, `:root` bg = `rgb(201,233,231)` (= `#c9e9e7` from `liquefy.css`), `body::before` gradient applied, `.liquefy-app` wrapper present |
| PWA service worker | ✅ **resolved** | was `MODULE_NOT_FOUND: @rollup/plugin-babel` in `closeBundle`; fixed by restoring the CJS entry files the host safe-delete wrapper had renamed. `vite build` now emits `dist/sw.js` + `dist/workbox-9c191d2f.js` (47 precache entries) |
| CI workflow (Q5) | ✅ **merged** | commit `eced86a` — kept the fork's `master` trigger, `HAS_DEPLOY_SECRETS` guard and artifact/failed-run cleanup; kept upstream's `concurrency`, `npm ci` cache and React build paths |
| `.trellis/spec/frontend/*` React rewrite | ✅ **done** | commit `d50691e` — all six files (five were empty templates) |
| **Run-time verification** | ✅ **done (first time ever)** | Playwright smoke over 14 routes on a `vite preview` build: **zero console errors / zero page errors**, `#root` mounted on every route, theme `liquefy/light` everywhere. Verified: `/` (Home + ICP footer, Chinese copy), `/sign-in` (QQ + 密码 form), `/sign-up` (QQ号 + 验证码 + "注册账号或重设密码"), `/password-reset`, `/contributors`, `/not-found` ("TRACK 404 · SIGNAL LOST"), unknown route → `/not-found`, and the 6 auth-guarded routes correctly redirect guests to `/`. Not covered: anything behind login (needs a live LCDX backend) |
| **Hardcoded Chinese copy sweep** | ✅ **done** | see below — 8 commits, catalogs now 1203 keys |
| Adopt into `master` (Q1) | ⏸ **awaiting user confirmation** | `git checkout master && git reset --hard migrate/react-port` — destructive, not done |
| UI-parity suite | ⛔ **blocked** | needs a hosts entry mapping `portal.naominet.live` → `127.0.0.1` (`scripts/add-hosts.ps1`, requires Administrator). Certs already exist under `ssl/`. Playwright uses `channel: 'chrome'` (system Chrome), and `ms-playwright` has no downloaded browser |

### Hardcoded Chinese copy sweep ✅ COMPLETE (2026-09-25 session 3–4)

The earlier notice sweep covered toasts only. An AST-based scan (Babel `jsx` + `typescript`, skipping
comments and i18n keys) found **354 literal CJK strings in 30 files**; ~90 of them were genuine
user-facing copy, the rest game-native data. The user approved an immediate full sweep, executed as
one commit per functional unit (catalogs merged + `tsc -b` + `vite build` green before each commit):

| Commit | Unit |
|---|---|
| `8e07df2` | `ConfirmDialog` defaults — highest leverage, affects every `confirm()` call site |
| `3d07cc0` | `AdminPage` (78 keys: labels, filters, table headers, confirm prompts, detail panel) |
| `449ce76` | `Maimai2ServerMissionsPage` (refresh cycles, points, pagination) |
| `4930423` | `Maimai2FestaPage` (phases, team vote, rankings) |
| `6b846b0` | `Maimai2PointExchangesPage` (item types, reasons, filters) |
| `2d10d46` | `Maimai2CabmodePage` + `Maimai2DxPassPage` + `Maimai2PhotosPage` + `cabinet-models.ts` |
| `9c31f94` | `AnnouncementEditPage` (heading, tab label, placeholders, type/pin selects, buttons) |
| `97dfa10` | `BannedPage`, `PlaceholderPage`, `KeychipPage`, `OngekiUserRankingPage`, `main.tsx`, `Maimai2SongListPage` |

**Result**: 4 catalogs at **1203 keys each, zh/en key sets identical**; `tsc -b` + `vite build` green;
scan down to **99 findings in 15 files, all verified non-copy** — full-width character palette
(`ChuniV2SettingPage`), maimai dan ranks, music genre names, song-title `「」` decoration, ongeki
card-name `【】` transform, the `lcset` protocol key `跳过闭店` (submitted to the backend verbatim),
ICP licence number, developer names, the QQ group number, and the `languages` display names.

Two deliberate shape decisions: `Maimai2CabmodePage`'s `LCSET_KEYS` gained `keyLabelKey`/`noteKey`
instead of translating the protocol `key` itself; `BannedPage` keeps its decorative "YOU ARE BANNED"
banner hardcoded (it is branding, not copy) and only the subtitle moves to a key.

## Phase 0–3 (recap, all done)

- **Phase 0**: `legacy-angular` created at old master (`b1c3fb4`); `migrate/react-port` from `backup`
  (`90ed95b`); `.trellis/` restored; `npm ci` OK; `npm run build` green.
- **Phase 1**: i18n merge (993 keys, zh/en synced in both copies), `.env` / `.env.development`,
  `src/lib/api/client.ts` (`api` + `lcdx`), `src/lib/botPermission.ts` (five-tier model),
  `maiAssetsHost`, `laochan.svg`, `loadBotPermission`/`clearBotPermission` wired into `src/lib/user.ts`.
- **Phase 2**: four cabinet pages — `Maimai2CabinetsPage` (`2c06ff2`), `Maimai2RemoteControlPage`
  (`2ed986d`), `Maimai2LocksPage` (`7bda5be`), `Maimai2CabmodePage` (`e0db341`); guards
  `RequireCabinetManage` / `RequireCabinetAdmin`; `Menu.requiredBotPermission`.
- **Phase 3**: setting 引继 + 绑定卡 (`cfe5b9e`), netcode-bind (`38f8c00`), onetime-sign-in
  (`d825a98`), KOP ranking (`d4b0ab9`).

## 🔁 HANDOFF NOTES (for the next AI)

**Branch / state**: work happens on `migrate/react-port` (branched from `backup`). 45 commits ahead of
`backup`, **pushed nowhere** (user asked to commit but not push). Working tree clean.

**Resume ritual**:
```bash
cd E:/ALL.Net/Project_LCDX_NET/aqua_viewer_lcdx
git log --oneline -3 && git status          # expect clean tree on migrate/react-port
py -3 ./.trellis/scripts/task.py start 09-24-react-upstream-merge
cat .trellis/tasks/09-24-react-upstream-merge/implement.md   # this file
```

**Non-negotiables**:
1. **Bootstrap classes, not shadcn rewrite** for ported LCDX pages (upstream keeps `--bs-*` tokens
   rebuilt in `globals.css`).
2. **All four i18n files must stay in sync**: `src/i18n/{zh,en}.json` AND `public/assets/i18n/{zh,en}.json`;
   zh/en key sets must match exactly.
3. **Never** `notice(String(error))` or a backend `status.message` passthrough in new/touched code —
   use `notice(t('Key'))` / `Common.OperationFailed`.
4. **Scope new CSS** under a page-specific class — Vite CSS is global, there is no Angular view
   encapsulation.
5. Commit after every completed unit with a descriptive message; **do not push**.
6. `npm run build` must be green before each commit (`tsc -b && vite build`). `npm run lint` is
   **not usable** (no ESLint config, eslint not a dependency).

**Verified so far**: compile-level (`npm run build`) **and** a 14-route Playwright smoke test on the
production build (public/guest routes only — nothing behind login has ever been exercised).

## Notes / gotchas

- `npm ci` on this machine takes >5 min (background it). It can be blocked by the host safe-delete
  wrapper → delete `node_modules` with the PowerShell tool first.
- Do NOT run `dotnet` from the Bash tool (known env corruption — see skill `dotnet-windows-env-fix`).
- `py -3` works for trellis scripts; plain `python` in Bash resolves to the Windows Store stub.
- Git topology: `master` (Angular, frozen) → `legacy-angular` (backup pointer, keep forever) ·
  `backup` (upstream main mirror, do not commit to) · `migrate/react-port` (work branch, base for the
  final master reset).
- LCDX API endpoints in use (all prefixed `lcdx/`): `cabinet/{permission,manage-access,command,
  global-players,grants,lcset,level,mode,permissions,reboot,info,players,delivery,dlprog}`,
  `mergeRegistry/{user}/{card}`, `announcement/recent`, `kop/rank`, `bind/`, `bind/user/{id}`,
  `addAccessCode/`, `removeAccessCode/`, `getBindAccessCode/`, `login`, `onetime-v2`,
  `register_start`, `register_confirm`.
- `shot1.png` in the repo root is an upstream stray artifact, tracked in git — leave it.
- `vite preview` inherits `server.https` from `vite.config.ts`, so it serves HTTPS with the dev cert;
  a browser that refuses self-signed certs cannot load it. Use a throwaway config with a `preview`
  block (no `server` key) to smoke-test over plain HTTP.
