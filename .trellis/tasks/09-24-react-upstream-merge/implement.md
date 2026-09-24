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

### Phase 2 — Cabinet pages (IN PROGRESS — 3 of 4 done: cabinets ✅ remote-control ✅ locks ✅; **NEXT: cabmode**)

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

### Phase 2 (final item) — cabmode page — **START HERE NEXT**

Source: `master:src/app/sega/maimai2/maimai2-cabmode/` (`.ts` + `.html` + `.css`) — the largest of the four. Read the ts/html fully, then port.

Known intent from master history + `cabinet-models.ts` (all i18n keys & constants already ported and present):

- **4 cards**: mode card (options driven by the **CabmodeList catalog** — `lcdx/cabinet/modes` GET returns `{modes: [{id, name, level}]}` with `level` = minimum cabinet level), LC settings card, level card, reboot card.
- **LC settings card** — `LCSET_KEYS` (9 entries, already in `cabinet-models.ts`): P≥4 only (`filterLcsetKeys`), each key can carry `default` (used by the **restore-defaults** button) and `note` = **format hint only, still editable/submittable** (the `cc`/`CustomCameraConfig` case — explicitly fixed in master commit b1c3fb4: do NOT make it readonly); submit disabled only for note-only semantics that must not be sent.
- **Level card** — `CABINET_LEVELS` (8 levels, already ported, with `Maimai2.CabinetControl.Level*` desc keys): options **2–5 for P4-6, full range for P7+** (D13 tier gating); "level write" warns via `CabinetLevelResult.warning`.
- **Mode card** — options from catalog; LC mode labels `LC_MODES` (0/4/5/10 → `Maimai2.Cabinets.Mode*`) when the catalog is unavailable; keep version suffix together when wrapping; responsive for mobile+desktop (master had several layout fixes: half-width 2-col cards, centered LC mode buttons, no label overflow).
- **APIs**: `lcdx/cabinet/modes` (GET catalog), `lcdx/cabinet/mode` (POST), `lcdx/cabinet/lcset` (POST), `lcdx/cabinet/level` (POST), `lcdx/cabinet/reboot` (POST) — all with `{userName, nickName, ...}` bodies; verify exact payloads from the Angular `.ts`.
- **Cabinet selector**: same `controllable/{user}` dropdown pattern **including `locationName` display** (master 2c38fee / 09-17-cabmode-cabinet-location-name) and the `.cabinet-select` CSS fix (copy from locks/remote-control CSS).
- **Permission**: page + menu gated by `RequireCabinetManage` (`requiredBotPermission: 0`); LC/level sub-cards further gated by P≥4 per D13.
- i18n groups: `Maimai2.CabinetControl.*` + `Maimai2.Cabinets.*` (already merged, verify with a key-existence script before build).

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
