# Merge upstream React rewrite: port LCDX features onto new baseline

## Goal

Adopt the upstream React 19 rewrite (local `backup` branch, synced from `RinNET-OpenSource/RinNET_frontend` main) as the new production frontend baseline, while preserving **every LCDX-specific feature** currently living on `master` (Angular 16). End state: `master` serves the React app with full LCDX functionality; the Angular version is preserved on a `legacy-angular` branch.

## Background

- Fork point `defebab` (2026-08-10). Since then:
  - `master` = 152 commits of LCDX customization (Angular): cabinet management, permission tiers, merge-request importer flow, full zh/en i18n (982 keys), deployment tweaks.
  - `backup` = 41 upstream commits that **rewrote the whole frontend**: Angular 16 + Bootstrap + ngx-translate → React 19 + Vite 8 + TypeScript 7 + Tailwind v4 + shadcn/ui + i18next + react-router 7 + @liquefy-ui themes + Playwright UI-parity suite. 690 files changed, +56,775 / −43,250.
- The upstream rewrite keeps storage layouts, i18n key structure and API paths compatible with the old Angular app ("user-imperceptible switch", see upstream README), which makes feature porting tractable: each old service/component has an explicit React counterpart annotated `等价旧版 xxx`.

## Requirements

### R1 — LCDX infrastructure (must exist on the React baseline)

- Dual-backend API client: RinNET game API (`/api`, existing `client.ts`) **plus** LCDXNetApi (`lcdx/*` endpoints). Prod is same-origin `/`; dev points to `https://lcdxnet.am-allnet.com/`. Token interceptor behavior (auth header, 401 single-flight refresh) applies to both.
- `botPermission` module mirroring the five-tier model (0 / 1-3 / 4-6 / 7-9 / 10; functional thresholds at 0/1/4/7/10) — port of `bot-permission.service.ts`, including `cabinet-guards` route-guard equivalents.
- Full zh/en i18n: master's 982 keys merged with upstream's new keys (theme system, chuni version filters, etc.). Key structure and `{{}}` interpolation stay as-is (i18next reads the same JSON).
- Production asset hosts: `maiAssetsHost = https:// alist.am-allnet.com/d/189/` via env config; `laochan.svg` brand asset; ICP/branding footer content from master.

### R2 — LCDX pages ported to React (currently absent upstream)

- **mai2/cabinets** — cabinet list, player-count windows incl. daily count (`lcdx/cabinet/global-players`).
- **mai2/cabmode** — LC mode catalog-driven options, LC settings card (9 keys + restore-defaults, P≥4 tier gating, cc CustomCameraConfig editable), level card (options 2-5 for P4-6, full range P7+), reboot.
- **mai2/locks** — member permission table: five-tier model, inline note edit, P10 mandatory note, column sorting, pagination, display-layer permission filter.
- **mai2/remote-control** — command/reboot dispatch, permission-filtered card list, locationName display.
- **mai2/kop-ranking** — `lcdx/kop/rank` + XaCDN assets.
- **netcode-bind** — access-code binding (`lcdx/bind`, `addAccessCode`, `removeAccessCode`, `getBindAccessCode`).
- **onetime-sign-in** — one-time sign-in flow (API ownership to be confirmed in research).
- Menu entries, routes and route guards for all of the above.

### R3 — LCDX modifications to shared pages replayed on React versions

Every LCDX change to upstream-shared pages must be re-applied to their React counterparts by **intent, not by diff**: admin, announcements (+edit), cards, dashboard, home, sign-up (LCDX register flow messages), keychip, profile, importer, user service, maimai2-setting (merge-request block + other changes), maimai2-recent, maimai2-profile, portrait upload. Each change is extracted from `defebab..master` history, understood, then re-expressed with React/shadcn idioms.

### R4 — Merge-request (国服数据引继) flow

`maimai2-setting` merge block: status polling (`GET lcdx/mergeRegistry/{user}/{card}`), request submission with confirm dialog, `isOnRequest` / `lastRequestDate` / `lastSuccessDate` display, i18n wording (subtitle direction: CN data syncs FROM linked CN account INTO this account).

## Constraints

- No regression in upstream parity: `npm run build` green; upstream `tests/ui-parity` suite still passing where applicable.
- Storage compatibility preserved (localStorage keys, IndexedDB `Aqua` v6) — LCDX pages must use the same account/user stores.
- User-visible strings must be localized (existing i18n rule; zh/en in sync) — no hardcoded copy in ported React code.
- `master` history must not be destroyed: keep a `legacy-angular` branch pointing at current master before fast-forwarding/resetting master to the ported result.
- `.trellis/` must survive the baseline switch (not tracked upstream) and `spec/frontend` must be rewritten for the React stack by the end of the task.

## Acceptance Criteria

- [ ] `legacy-angular` branch exists, pointing at pre-merge Angular master.
- [ ] New branch (from `backup`) contains `.trellis/` and builds: `npm ci && npm run build` exits 0.
- [ ] All R1 infrastructure present and type-checked (LCDX API client, botPermission, guards, merged i18n with ≥982 master keys + upstream keys, asset hosts).
- [ ] All R2 pages reachable in the React app with permission gating correct per the five-tier model; APIs hit the same `lcdx/*` endpoints as Angular master.
- [ ] R3/R4 modifications replayed; each replayed change cross-checked against its Angular counterpart behavior.
- [ ] zh/en i18n complete for all ported pages; no passthrough of backend English messages.
- [ ] `master` moved to the React baseline (reset or merge per chosen strategy) and deploys to production config (same-origin API topology).
- [ ] `.trellis/spec/frontend/*` updated for React/Vite/shadcn conventions.
- [ ] Journal updated; task archived.

## Out of scope

- Any backend (LCDXNetApi) changes.
- Upstream features explicitly rejected by the user (open question: EULA page restore vs. keep removed).
- Porting Angular unit tests (karma specs) — superseded by the Playwright parity approach.
