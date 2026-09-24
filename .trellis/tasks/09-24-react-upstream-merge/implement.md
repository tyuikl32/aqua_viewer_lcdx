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

**Phase 0 ✅ complete · Phase 1 ✅ complete · Phase 2 🔄 starting (cabinets first)**

Commits so far on `migrate/react-port`:
- `e1d92ae` — restore .trellis onto React baseline
- `221ebb6` — i18n merge (993 keys) + env scaffolding + task docs
- `0968738` — LCDX API client + botPermission + mai asset host + laochan.svg + .env.development

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

### Phase 2 — Cabinet pages (IN PROGRESS — cabinets first)

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
