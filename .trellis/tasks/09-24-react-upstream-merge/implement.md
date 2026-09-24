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

## Current position (updated 2026-09-24 session 1)

**Phase 0 ✅ complete · Phase 1 🔄 in progress (i18n done, env done, next: LCDX client + botPermission)**

### Phase 0 — Baseline (DONE, commit e1d92ae)

- [x] `legacy-angular` branch created at old master (b1c3fb4)
- [x] `migrate/react-port` branch created from `backup` (90ed95b)
- [x] `.trellis/` restored from master + committed
- [x] `npm ci` + `npm run build` baseline verification — **was still running at session end; if build failed, fix before proceeding** (background task may have been killed by session end; just rerun `npm ci && npm run build`)

### Phase 1 — Infrastructure (IN PROGRESS)

- [x] **i18n merge** (committed): master 985 keys + upstream 8 new keys = **993 keys, zh/en fully synced**, written to BOTH `src/i18n/{zh,en}.json` (authoritative, imported by `src/lib/i18n.ts`) AND `public/assets/i18n/{zh,en}.json` (PWA snapshot copy).
  - 6 value conflicts resolved → **master (LCDX) values win** (all are LCDX semantics: QQ号 login wording ×2, dashboard no-profile/no-card wording ×2, signup 4-digit code + "register or reset" title ×2). Upstream values were generic RinNET wording.
  - **Upstream bug fixed en passant**: `t('Ongeki.RecentPage.UnknownArtist')` was dead (en key had trailing space `'UnknownArtist '`, zh had nothing) → added proper key both langs (未知艺术家 / Unknown artist), removed the dead trailing-space key.
- [x] **env vars** (committed with vite-env.d.ts): `.env` gains `VITE_LCDX_API_SERVER=/` + `VITE_MAI_ASSETS_HOST=https://alist.am-allnet.com/d/189/` (prod values). **TODO: create `.env.development`** with dev values `VITE_LCDX_API_SERVER=https://lcdxnet.am-allnet.com/` + `VITE_MAI_ASSETS_HOST=https://rinnet.stehp.cn/`.
- [x] `src/vite-env.d.ts`: added both new env var declarations.
- [ ] **LCDX API client** — extend `src/lib/api/client.ts`: parameterize `perform()`/`buildUrl()` with a base (default `API_SERVER='/'`); add `LCDX_API_SERVER = import.meta.env.VITE_LCDX_API_SERVER ?? '/'`; export `lcdx = { get, post, delete }` (等价旧版 ApiService.getLcdx/postLcdx/deleteLcdx). Token header/401-refresh/loading/error-mapping all inherited from shared `perform` (Angular ErrorInterceptor applied to LCDX requests too — verified in legacy behavior). LCDX responses use the same `ApiResponse` envelope (`isOk` works).
- [ ] **botPermission lib** — port `master:src/app/bot-permission.service.ts` to `src/lib/botPermission.ts`:
  - Constants: `PERMISSION_NONE=0, PERMISSION_ACTIVATED=1, PERMISSION_SECONDARY=3, MANAGE_GRANTS=4, MANAGE_PERMISSIONS=7, ADMIN_PERMISSION=10`, `NORMAL_REMOTE_COMMANDS=['game-reboot','game-switch']`
  - `createStore<LcdxPermissionState>({permission:0, qqNumber:null, hasManage:false, loaded:false})` + `useBotPermission()` hook via `useStore`
  - `load(userName)`: parallel `lcdx.get('lcdx/cabinet/permission/{userName}')` + `lcdx.get('lcdx/cabinet/manage-access/{userName}')`, merge partial results into store (keep other fields from current value), any failure keeps defaults
  - `clear()`: reset to initial
  - Pure functions: `filterCommands(permission, commands)` (P<10 → only NORMAL_REMOTE_COMMANDS), `filterLcsetKeys(permission, keys)` (P≥4 full, else []), `roleBand(permission)` → 'Normal'|'Secondary'|'Manager'|'Admin'|'SuperAdmin'
  - **Mount points** (port of master user.service.ts:56/81): `src/lib/user.ts` → in `loadUser()` success branch call `loadBotPermission(user.username)`; in `clearUser()` call `clearBotPermission()`. Careful: `clearUser` is called at module top-level when no account — make sure the import cycle is safe (botPermission imports lcdx client which imports account store; user.ts already imports those).
- [ ] **maiAssetsHost** — add `export const maiAssetsHost = import.meta.env.VITE_MAI_ASSETS_HOST ?? 'https://rinnet.stehp.cn/';` to `src/lib/utils.ts` (consumed later by mai2 songlist/kop pages).
- [ ] **laochan.svg** — `git checkout master -- src/assets/laochan.svg` then move to `public/assets/laochan.svg` (used by app shell logo, home hero, favicon; wiring happens Phase 4).
- [ ] Verify: `npm run build` green.

### Phase 2 — Cabinet pages (NOT STARTED)

Order (risk ascending): models+CabinetsPage → RemoteControlPage → LocksPage → CabmodePage. Each = route in `src/router.tsx` mai2 children + guards + menu entries in `src/lib/menu.ts` + i18n keys already present (Maimai2.* 168 keys).

- Guard design (port of `master:src/app/auth/cabinet-guards.service.ts`): React components `RequireCabinetManage` (hasManage; !loaded → pass-through, page-level empty-list fallback) and `RequireCabinetAdmin` (permission≥4), pattern-copy `RequireAdmin` in router.tsx. Deny → `notice(t('Common.NoCabinetPermission'))` + Navigate /dashboard.
- Menu gating (port of master menu.service): extend `Menu` interface with `requiredBotPermission?: number` (0=hasManage, >0=min permission); `showItem` checks it for AfterLogin items.
- Angular sources to port (read intent, re-express in React/shadcn; upstream pattern references: `AdminPage.tsx` for authed data pages, `KeychipPage` etc.):
  - `maimai2-cabinets.component.{ts,html,css}` — cabinet list cards, 4 player-count windows (incl. daily today count via `lcdx/cabinet/global-players`)
  - `maimai2-remote-control.component.{ts,html,css}` — command select (permission-filtered), reboot, cabinet select w/ locationName
  - `maimai2-locks.component.{ts,html,css}` + spec — three cards: member perms (inline note edit, P10 must-note, column sort, filter ≤ own), grants, admin perms (P≥7); pagination restyle
  - `maimai2-cabmode.component.{ts,html,css}` — mode card (CabmodeList catalog-driven), LC settings card (9 keys + restore-default, P≥4; cc CustomCameraConfig editable, note = format hint), level card (P4-6 → 2-5, P7+ full), reboot card
  - `sega/maimai2/model/CabinetModels.ts` → types into mai2 models

### Phase 3 — Setting merge block + standalone pages (NOT STARTED)

- `maimai2-setting` merge-request block: port from `master:src/app/sega/maimai2/maimai2-setting.component.{ts,html}` (state polling `lcdx/mergeRegistry/{userName}/{cardId}`, POST request w/ confirm dialog, isOnRequest/lastRequestDate/lastSuccessDate display). React target: `src/features/mai2/Maimai2SettingPage.tsx`.
- netcode-bind page (`master:src/app/netcode-bind/`), onetime-sign-in page (`master:src/app/onetime-sign-in/`), kop-ranking page (`master:src/app/sega/maimai2/maimai2-kop-ranking/`, uses `lcdx/kop/rank` + XaCDN assets).
- EULA auto-pass investigation (Q2 constraint): trace `restoreAccess()` in `src/lib/auth/access.ts` → where eulaRequired comes from; confirm LCDX accounts can't get stuck.

### Phase 4 — Shared-page replay (NOT STARTED)

Extract per-file intents from `git log -p defebab..master -- <file>` and re-apply onto React counterparts. Order: dashboard (biggest) → sign-up → home → admin → announcements/edit → cards → keychip → profile → importer → user.service deltas → maimai2-recent/profile/portrait-upload. Key known intents:
- sign-up: LCDX register flow = QQ号 + 4-digit code + "register or reset password" combined page
- home: laochan brand + ICP 备案主体 footer
- admin/announcements: LCDX backend integration (`lcdx/announcement/recent`)
- keychip: FullKeychip/辖区 display changes
- dashboard: restructured cards + daily player window (verify against React DashboardPage first)

### Phase 5 — Finalize (NOT STARTED)

- Liquefy default theme; CI check (`.github/workflows/deploy-test-server.yml` adoption?); spec/frontend rewrite for React; `master reset --hard migrate/react-port`; journal; archive.

## Notes / gotchas

- Upstream keeps TWO copies of i18n: `src/i18n/` (bundled, authoritative) and `public/assets/i18n/` (PWA static copy). **Both must be kept in sync** when adding keys.
- `npm ci` on this machine takes >5 min (background it).
- Do NOT run `dotnet` from the Bash tool (known env corruption issue — see user memory / skill `dotnet-windows-env-fix`). Frontend-only work in this task anyway.
- `py -3` works for trellis scripts; plain `python` in Bash resolves to the Windows Store stub (fails silently).
- Git branch topology: `master` (Angular, frozen) → `legacy-angular` (backup pointer, keep forever) · `backup` (upstream main mirror, do not commit to) · `migrate/react-port` (work branch, base for final master reset).
- LCDX API endpoints in use (all prefixed `lcdx/`): `cabinet/{permission,manage-access,command,global-players,grants,lcset,level,mode,permissions,reboot}` (manage-access/{user} & permission/{user} are GET probes), `mergeRegistry/{user}/{card}`, `announcement/recent`, `kop/rank`, `bind/`, `bind/user/{id}`, `addAccessCode/`, `removeAccessCode/`, `getBindAccessCode/`.
