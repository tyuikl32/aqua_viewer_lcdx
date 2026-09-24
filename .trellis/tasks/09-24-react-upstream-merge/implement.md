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

## User-confirmed decisions (2026-09-24, do not re-ask)

- Q1: final adoption = `master reset --hard` to ported branch; `legacy-angular` branch keeps Angular history.
- Q2: EULA stays, but LCDX accounts must pass automatically (never stuck; verify `eulaRequired` source for LCDX accounts).
- Q3: port all three standalone pages (onetime-sign-in, netcode-bind, kop-ranking).
- Q4: default theme = **Liquefy** (verify cabinet pages look right under it).

## Current position (updated 2026-09-24 session 2)

**Phase 0 ✅ · Phase 1 ✅ · Phase 2 ✅ (4/4 cabinet pages) · Phase 3 ✅ (setting 引继 + netcode-bind + onetime-sign-in + kop) · Phase 4/5 ⏳ NOT STARTED — see HANDOFF NOTES at the end**

Commits so far on `migrate/react-port`:
- `e1d92ae` — restore .trellis onto React baseline
- `221ebb6` — i18n merge (993 keys) + env scaffolding + task docs
- `0968738` — LCDX API client + botPermission + mai asset host + laochan.svg + .env.development
- `2c06ff2` cabinets · `2ed986d` remote-control · `7bda5be` locks · `e0db341` cabmode (Phase 2)
- `cfe5b9e` setting 引继/绑定卡 · `38f8c00` netcode-bind · `d825a98` onetime-sign-in · `d4b0ab9` kop (Phase 3)

### Phase 0 — Baseline (DONE)

- [x] `legacy-angular` branch created at old master (b1c3fb4)
- [x] `migrate/react-port` branch created from `backup` (90ed95b)
- [x] `.trellis/` restored from master + committed
- [x] `npm ci` OK (328 packages). **NOTE: `npm ci` initially failed because the host `safe-delete` wrapper blocks bulk node_modules deletion (>50 entries) → solution: delete `node_modules` with the PowerShell tool (`Remove-Item -Recurse -Force`), then `npm ci`.**
- [x] `npm run build` OK — tsc passes, vite emits `dist/` in ~2.5s.

### Phase 1 — Infrastructure (DONE)

- [x] **i18n merge**: 993 keys, zh/en synced, both `src/i18n/` and `public/assets/i18n/` updated. 6 conflicts → master (LCDX) values. Fixed upstream dead `Ongeki.RecentPage.UnknownArtist` key.
- [x] **env**: `.env` (prod: `VITE_LCDX_API_SERVER=/`, `VITE_MAI_ASSETS_HOST=alist.am-allnet.com/d/189/`) + `.env.development` (dev: lcdxnet.am-allnet.com, rinnet CDN) + `src/vite-env.d.ts` declarations.
- [x] **LCDX API client** in `src/lib/api/client.ts`: `LCDX_API_SERVER` constant, `buildUrl`/`perform` parameterized by base, exported `lcdx = { get, post, delete }`. Shares auth header, 401 single-flight refresh, ref-count loading, EULA/banned error mapping.
- [x] **`src/lib/botPermission.ts`** (new): constants (0/1/3/4/7/10 + NORMAL_REMOTE_COMMANDS), `botPermissionStore` + `useBotPermission()`, `loadBotPermission(userName)` (parallel EP-01 + EP-18, partial merge, failures keep defaults), `clearBotPermission()`, pure fns `filterCommands` / `filterLcsetKeys` / `roleBand`, `isBotAdmin()`.
- [x] **mounted** in `src/lib/user.ts`: `loadBotPermission(user.username)` after successful `loadUser`, `clearBotPermission()` in `clearUser` (mirrors master user.service.ts:56/81).
- [x] **`maiAssetsHost`** added to `src/lib/utils.ts`; **`public/assets/laochan.svg`** ported.
- [ ] ⚠️ **Deferred to Phase 5 — PWA service worker not generated**: `vite build` exits 0 but `vite-plugin-pwa` `closeBundle` throws `MODULE_NOT_FOUND: @rollup/plugin-babel`, so `dist/sw.js` / `dist/registerSW.js` are missing (manifest.webmanifest IS emitted). Likely a vite-plugin-pwa↔vite-8 incompatibility or missing optional dep. Decide: add the dep, pin/patch the plugin, or drop PWA. Does not block feature work.

### Phase 2 — Cabinet pages ✅ COMPLETE (4 of 4 ported, builds green)

All four cabinet pages are ported, routed, menu-gated and committed on `migrate/react-port`:

| Page | File | Route (guard) | Menu gate |
|---|---|---|---|
| 机台列表 ① | `src/features/mai2/Maimai2CabinetsPage.tsx` | `mai2/cabinets` (Manage) | hasManage |
| 机台控制 ② | `src/features/mai2/Maimai2CabmodePage.tsx` + `.css` | `mai2/cabmode` (Manage) | hasManage |
| 远程控制 ③ | `src/features/mai2/Maimai2RemoteControlPage.tsx` + `.css` | `mai2/remotecontrol` (Manage) | hasManage |
| 操作记录与授权 ④ | `src/features/mai2/Maimai2LocksPage.tsx` + `.css` | `mai2/locks` (Admin, P≥4) | P≥4 |

Shared: `src/features/mai2/cabinet-models.ts` (all DTOs + LC_MODES/CABINET_LEVELS/LCSET_KEYS/REMOTE_COMMANDS + `truncateFileName` + date formatters), `Maimai2Pagination` reused for all paging, `RequireCabinetManage`/`RequireCabinetAdmin` in `src/router.tsx`, `Menu.requiredBotPermission` in `src/lib/menu.ts`, `useBotPermission()` subscription in `AppShell.SidebarNav`.

Commits: `2c06ff2` (cabinets), `2ed986d` (remote-control), `7bda5be` (locks), `e0db341` (cabmode).

Notable ports/decisions:
- **cabmode** keeps master's `formatModeButtonLabel` (brand-break + display-width>16 break; CJK counts 2) and the whole `cab-mode-*` CSS incl. all responsive breakpoints; LC mode options come from the `CabmodeList` catalog filtered by cabinet level with `LC_MODES` i18n fallback; level card honours D13 (P4-6 → 2..5 only, P7+ → full −1..7); reboot is read-and-clear with a confirm dialog — **fixed master's hardcoded Chinese confirm string to `Maimai2.CabinetControl.RebootConfirm`**; backend `CabinetLevelResult.warning` is surfaced via `notice(..., 'warning')` (master stored it but never displayed).
- **locks** waits for `permission.loaded` before judging no-permission (legacy could flash the warning on deep-link before probes returned).
- **remote-control** keeps the 2s×30 poll cap and 94041-keep-pending semantics.
- CSS note: React CSS is **global** (no Angular view encapsulation) — `cab-mode-*` / `cabinet-select*` names verified unique across the repo; `cabinet-select*` rules are intentionally shared verbatim by three pages.

**Next — Phase 3: setting merge block + standalone pages**

**Done (all committed):**
- `src/features/mai2/cabinet-models.ts` — ALL cabinet DTOs + LC_MODES / CABINET_LEVELS / LCSET_KEYS / REMOTE_COMMANDS / `truncateFileName` + `formatFullDateTime|formatClock|formatShortDateTime` (Angular date-pipe equivalents).
- `src/features/mai2/Maimai2CabinetsPage.tsx` (commit `2c06ff2`) — EP-19 selector, EP-04/05/06/07 cards, 30s auto-refresh, `progressBadgeClass`.
- `src/features/mai2/Maimai2RemoteControlPage.tsx` + `.css` (commit `2ed986d`) — role-filtered commands, EP-13 send, 2s×30 polling by requestId, session log (printscr `<img>` / text `<pre>`).
- `src/router.tsx` — `RequireCabinetManage` (EP-18) + `RequireCabinetAdmin` (P≥4), **both exported** (Admin is consumed by locks); routes `mai2/cabinets`, `mai2/remotecontrol`.
- `src/lib/menu.ts` — `Menu.requiredBotPermission`; `showItem` AfterLogin honors it (0=hasManage, >0=min permission); Cabinets + RemoteControl entries.
- `src/components/shell/AppShell.tsx` — `useBotPermission()` in `SidebarNav` so async permission load re-renders gated menu items.

**⭐ Key convention:** upstream React **keeps Bootstrap class names** (`card`, `row/col`, `form-select`, `badge text-bg-*`, `page-heading`) — `globals.css` rebuilds the `--bs-*` tokens. So LCDX Angular templates translate almost 1:1 into JSX; only @if/@for/ngModel/pipes become React state. **Do NOT rewrite these pages into shadcn/Tailwind** — Bootstrap keeps 1:1 visual parity.

**Next — locks** (`master:src/app/sega/maimai2/maimai2-locks/`: 380 ts + 311 html + 13 css). Three cards + member-permission table:

- ✅ DONE (commit `7bda5be`) → `src/features/mai2/Maimai2LocksPage.tsx` (+ `.css`), route `mai2/locks` with `RequireCabinetAdmin`, menu entry `requiredBotPermission: 4`.
  - Card A EP-14 `lcdx/cabinet/locks/{user}` (page/size=20 + targetQQ/fullKeychip/action/since/until, server paging), Card B EP-15 `grants/{user}` (QQ prefix filter, client paging 10/20/100, EP-16 POST `grants`, EP-17 DELETE + confirm), Card C P≥7: EP-20L `permissions/{user}`, EP-20 POST (0..own level only, P10 note required), EP-20D DELETE + confirm, 4-column sort, one-row-at-a-time inline note edit (reuses EP-20 upsert with original permission), client paging 20.
  - `visibleMembers` keeps the display-layer `permission <= own` filter (second line of defense).
  - Deviation from legacy (intentional, better): permission probing is async, so the page waits for `loaded` before judging `noPermission` — legacy could flash "no permission" on direct URL access before probes returned. Guards already pass through while `!loaded`.
  - Reused `Maimai2Pagination` (ngx-pagination-compatible) for all three paging controls.
  - `cabinet-models.ts` gained `formatMinutesDateTime` (`yyyy-MM-dd HH:mm` used by grantedAt/addedSince columns).

### Phase 3 — Setting merge block + standalone pages ✅ COMPLETE

All four items ported, routed and committed:

| Item | File | Route | Notes |
|---|---|---|---|
| setting 引继 + 绑定卡 | `src/features/mai2/Maimai2SettingPage.tsx` (rewritten) | `mai2/setting` | commit `cfe5b9e` |
| 网络码绑定 | `src/pages/NetcodeBindPage.tsx` | `/netcode-bind` (auth, no sidebar) | commit `38f8c00` |
| 一次性登录 | `src/pages/auth/OnetimeSignInPage.tsx` + `loginLcdxOnetime` in `src/lib/auth/auth.ts` | `/onetime-sign-in` (public, no sidebar) | commit `d825a98` |
| KOP 排行 | `src/features/mai2/Maimai2KopRankingPage.tsx` + `.css` | `mai2/kop` (no guard; menu HasProfile) | commit `d4b0ab9` |

Splice decisions & fixes (all deliberate):
- **setting**: kept upstream's four cards, spliced LCDX bind-card + merge-request cards. Bind-card uses `cards[0].luid`, merge uses `defaultCard.luid` — **two different cards, keep it that way**. **Portrait upload stays DISABLED** (`UploadPortraitDisabled` warning) per LCDX behaviour; upstream's `PortraitDialog`/`centerSquareJpeg` were removed as dead code. Added key `Maimai2.Setting.AccessCodeLoading` (zh 请稍后 / en Please wait) to replace the legacy hardcoded input placeholder.
- **procLoginResp** (`src/lib/auth/auth.ts`) gained the LCDX branch: after `loadUser`, `cards.length === 0` → `/netcode-bind`. This is shared by every login path (password / oauth / onetime).
- **netcode-bind**: fixed legacy bug where a success also flashed `OperationFailed` (unconditional notice before redirect).
- **kop**: legacy had hardcoded title/headers/empty-state → now i18n (`Maimai2.KopPage.*`, 5 new keys); `.medal` + th/td rules scoped under `.kop-ranking-page` (legacy `public.ranking.scss` had global `th{}`/`td{}` which would pollute React); response is a **bare array** (not the ApiResponse envelope) — code tolerates both.
- **EULA (Q2 investigation result)**: `eulaRequired` originates from the **backend** `api/account/status` (`src/lib/auth/access.ts` → `restoreAccess`). The React flow (redirect to `/eula` → `acceptEula` → re-check) is **self-service — a user can never be permanently stuck by frontend logic**. Whether LCDX accounts ever hit it depends on the deployed backend returning `acceptedEulaVersion < currentEulaVersion`. → **Follow-up for the backend owner**: confirm LCDX accounts either never get `eulaRequired`, or can accept once; if the intent is "auto-pass", the backend should auto-accept the current EULA for LCDX-registered accounts (frontend hack is NOT recommended). No frontend action taken.

**Next — Phase 4: shared-page modification replay**

- `maimai2-setting` merge-request block: port from `master:src/app/sega/maimai2/maimai2-setting.component.{ts,html}` (state polling `lcdx/mergeRegistry/{userName}/{cardId}`, POST request w/ confirm dialog, isOnRequest/lastRequestDate/lastSuccessDate display). React target: `src/features/mai2/Maimai2SettingPage.tsx`.
- netcode-bind page (`master:src/app/netcode-bind/`), onetime-sign-in page (`master:src/app/onetime-sign-in/`), kop-ranking page (`master:src/app/sega/maimai2/maimai2-kop-ranking/`, uses `lcdx/kop/rank` + XaCDN assets).
- EULA auto-pass investigation (Q2 constraint): trace `restoreAccess()` in `src/lib/auth/access.ts` → where eulaRequired comes from; confirm LCDX accounts can't get stuck.

### Phase 4 — Shared-page replay (NOT STARTED) — **bulk of remaining work**

Method for every file: `git log --oneline defebab..master -- <path>` to find the LCDX commits, then `git show <commit> -- <path>` (or `git diff defebab master -- <path>`) to read the intent, then re-express it in the React counterpart. **Never copy Angular code** — understand what the user saw / which API was called, then implement with React state + Bootstrap classes (same convention as Phase 2/3). Commit per file.

Measured LCDX deltas (`defebab..master`, non-spec files) and what to look for:

| Angular source | Δ | What the LCDX change is about | React target |
|---|---|---|---|
| `dashboard/dashboard.component.*` | +471/−173 | **biggest**: restructured dashboard cards + **daily/global player window** calling `lcdx/cabinet/global-players` (the only caller of that endpoint) | `src/pages/DashboardPage.tsx` |
| `sign-up/sign-up.component.*` | +258/−387 | LCDX register flow: **QQ号 + 4-digit code** + combined "注册账号或重设密码"; also the 6 i18n conflicts we resolved in Phase 1 came from here | `src/pages/auth/SignUpPage.tsx` |
| `home/home.component.*` | +130/−156 | laochan brand hero + **ICP 备案主体** footer content | `src/pages/HomePage.tsx` |
| `admin/admin.component.*` | +87 | announcement management wired to LCDX backend (`lcdx/announcement/recent`) | `src/pages/AdminPage.tsx` |
| `sign-in/*` | — | LCDX password login uses **`POST lcdx/login`** (`login_lcdx_common`, body `{usernameOrEmail, password}`) plus `lcdx/onetime-v2` — check whether React `SignInPage` must call the LCDX endpoint instead of `api/auth/signin` | `src/pages/auth/SignInPage.tsx`, `src/lib/auth/auth.ts` |
| `keychip/keychip.component.*` | +52 | FullKeychip / 辖区 display changes | `src/pages/KeychipPage.tsx` |
| `cards/cards.component.ts` | +36 | access-code related UI | `src/pages/CardsPage.tsx` |
| `announcements/*` (+edit) | +31/+10 | LCDX announcement API + the `/announcements/edit` admin route | `src/pages/AnnouncementsPage.tsx`, `AnnouncementEditPage.tsx` |
| `profile/profile.component.ts` | +28 | small | `src/pages/ProfilePage.tsx` |
| `user.service.ts` | +15 | botPermission load/clear wiring — **already done** in Phase 1 | `src/lib/user.ts` ✅ |
| `menu.service.ts` | ±174 | menu restructure — **already done** in Phase 1/2 | `src/lib/menu.ts` ✅ |
| `sega/maimai2/maimai2-recent`, `maimai2-profile`, `upload-user-portrait.dialog` | +7/+2/+6 | tiny; check each | corresponding `src/features/mai2/*` |
| `importer/importer.component.ts` | +8 | tiny | `src/pages/ImporterPage.tsx` |
| `oauth-callback`, `password-reset`, `auth/*.service.ts` | small | LCDX login/oauth deltas (`login_lcdx_common`, error handling) | `src/pages/auth/*`, `src/lib/auth/*` |

Also apply the **project's i18n rule** while replaying: any user-visible string that upstream left as `notice(String(error))` / hardcoded English should become `notice(t('...'))` with zh/en keys (this is the LCDX convention recorded in `.trellis/spec/frontend/quality-guidelines.md`). Do it only in files you are already touching (avoid a repo-wide sweep unless the user asks).

### Phase 5 — Finalize (NOT STARTED)

- **Liquefy as default theme** (user decision Q4) — verify LCDX pages (cabinet cards, tables) look right under it; check `src/lib/theme.ts` default family.
- **Run-time verification** (never done — only `npm run build` was verified): needs `npm run gen:cert` + hosts entry for `portal.naominet.live`, `npm run dev`, and a reachable LCDX backend (`VITE_LCDX_API_SERVER`); smoke-test the four cabinet pages + setting merge flow + bind-card against a dev account.
- **PWA service worker**: `vite-plugin-pwa` `closeBundle` throws `MODULE_NOT_FOUND: @rollup/plugin-babel` → no `dist/sw.js` (manifest OK). Decide: add the dep, pin the plugin, or drop PWA.
- **CI**: check whether this fork uses `.github/workflows/deploy-test-server.yml` (upstream repointed it at the React branch) before adopting.
- **`.trellis/spec/frontend/*` rewrite for React** (currently Angular-era docs): directory structure, component patterns, state via `createStore`, i18next usage, keep the "user-facing messages must be localized" rule.
- **Adopt into master**: `git checkout master && git reset --hard migrate/react-port` (user decision Q1). `legacy-angular` keeps the Angular history. Then `task.py archive 09-24-react-upstream-merge` + journal entry.

## 🔁 HANDOFF NOTES (for the next AI)

**Branch / state**: work happens on `migrate/react-port` (branched from `backup`). 14 commits ahead of `backup`, all pushed nowhere (user asked to commit but **not push**). `master` is still the old Angular code and `legacy-angular` points at it — do not touch them until Phase 5.

**Resume ritual**:
```bash
cd E:/ALL.Net/Project_LCDX_NET/aqua_viewer_lcdx
git log --oneline -3 && git status          # expect clean tree on migrate/react-port
py -3 ./.trellis/scripts/task.py start 09-24-react-upstream-merge
cat .trellis/tasks/09-24-react-upstream-merge/implement.md   # this file
```

**Non-negotiables**:
1. **Bootstrap classes, not shadcn rewrite** for ported LCDX pages (upstream keeps `--bs-*` tokens rebuilt in `globals.css`).
2. **Both i18n copies must stay in sync**: `src/i18n/{zh,en}.json` AND `public/assets/i18n/{zh,en}.json`; zh/en key sets must match exactly. Currently 999 keys.
3. **Never** `notice(String(error))` or a backend `status.message` passthrough in new/touched code — use `notice(t('Key'))` / `Common.OperationFailed`.
4. Commit after every completed unit with a descriptive message; **do not push**.
5. `npm run build` must be green before each commit (`tsc -b && vite build`; the trailing PWA warning is expected/known).
6. Do not run `dotnet` from the Bash tool (known environment corruption — see skill `dotnet-windows-env-fix`). `npm ci` may be blocked by the host safe-delete wrapper → delete `node_modules` with the PowerShell tool first.

**Verified so far**: only compile-level (`npm run build`). No browser/runtime testing has been done.

## Notes / gotchas

- Upstream keeps TWO copies of i18n: `src/i18n/` (bundled, authoritative) and `public/assets/i18n/` (PWA static copy). **Both must be kept in sync** when adding keys.
- `npm ci` on this machine takes >5 min (background it).
- Do NOT run `dotnet` from the Bash tool (known env corruption issue — see user memory / skill `dotnet-windows-env-fix`). Frontend-only work in this task anyway.
- `py -3` works for trellis scripts; plain `python` in Bash resolves to the Windows Store stub (fails silently).
- Git branch topology: `master` (Angular, frozen) → `legacy-angular` (backup pointer, keep forever) · `backup` (upstream main mirror, do not commit to) · `migrate/react-port` (work branch, base for final master reset).
- LCDX API endpoints in use (all prefixed `lcdx/`): `cabinet/{permission,manage-access,command,global-players,grants,lcset,level,mode,permissions,reboot}` (manage-access/{user} & permission/{user} are GET probes), `mergeRegistry/{user}/{card}`, `announcement/recent`, `kop/rank`, `bind/`, `bind/user/{id}`, `addAccessCode/`, `removeAccessCode/`, `getBindAccessCode/`.
