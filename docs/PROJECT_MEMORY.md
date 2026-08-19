# Project Memory

Last verified: 2026-08-19

This document records durable context for future work on `aqua_viewer_lcdx`. It is a snapshot of observed repository state, not a replacement for checking the code when a contract changes.

## 1. Repository role and comparison baseline

`aqua_viewer_lcdx` is the LCDX-oriented, responsive fork of RinNET's AquaViewer frontend. Git remotes are:

- `origin`: `https://github.com/tyuikl32/aqua_viewer_lcdx.git`
- `upstream`: `https://github.com/RinNET-OpenSource/RinNET_frontend.git`

The comparison in this document uses:

- Fork HEAD: `9c798dc5cac47ade493056a83712b83c843e4da3` (2026-05-24)
- Upstream `master`: `defebabe1907aa6ea3e4ca6abe7a0562406f7c77` (2026-08-10, fetched 2026-08-13)
- Merge base: `b867c3b62a413e4f71c9ff293e93a085dab096b4` (2025-10-14)
- Divergence at verification: fork has 33 unique commits; upstream has 91 unique commits.

Two comparisons answer different questions:

1. `git diff $(git merge-base HEAD upstream/master)..HEAD` shows what this fork introduced after divergence: 75 files, about 3,201 insertions and 889 deletions at the recorded baseline.
2. `git diff upstream/master HEAD` shows the current net difference, but it is noisy because upstream later upgraded Angular and refactored much of the application.

Always refresh `upstream` and record new commit IDs before making synchronization claims.

## 2. Technology and application shape

The synchronized fork remains an NgModule application on the current upstream framework baseline:

- Angular/CLI: 22.0.8; CDK: 22.0.6
- TypeScript: 6.0.3
- RxJS: 7.8
- Bootstrap: 5.2.3
- ng-bootstrap: 21
- Icons: `@ng-icons/bootstrap-icons` 34
- Localization: `@ngx-translate` 18
- Client storage/preload: `ngx-indexed-db` 22
- PWA: Angular service worker in production

The application deliberately kept NgModule ownership during the Angular 22 migration. `AppModule` uses the provider-style HTTP and translation setup introduced upstream, while NgModule-declared components explicitly use `standalone: false`. It imports the dashboard, database, importer, Chunithm V2, Ongeki, and maimai DX modules. Only maimai DX is exposed through a top-level game route. `AppRoutingModule` lazy-loads `/mai2`; the Chunithm and Ongeki modules remain available for inherited/shared code and preload tasks, but `/chuni/v2` and `/ongeki` are absent from root routing.

The main shell in `app.component.*` uses a fixed Bootstrap navbar, a `container-xxl` two-column desktop layout, and the same sidebar as an `offcanvas-lg` drawer on smaller screens. Theme state is expressed through Bootstrap's `data-bs-theme`; global and component styles use `--bs-*` variables. The existing UI is compact and application-like: headings, cards, tables, forms, alerts, modals, pagination, placeholders, and responsive grid utilities.

The project is bilingual. Most inherited user-facing strings are under `src/assets/i18n/en.json` and `zh.json`, although some fork additions still contain hard-coded Chinese or English. New work should use translation keys unless the surrounding feature is deliberately single-language.

## 3. Request routing and service ownership

The frontend does not route by inspecting a URL prefix. The caller chooses the backend method explicitly.

| Frontend call | Base URL | Path family | Owning backend |
| --- | --- | --- | --- |
| `ApiService.get/post/put/delete` | `environment.apiServer` | `api/**` | `D:\ALL.NET\RinNET_backend` |
| `ApiService.getLcdx/postLcdx` | `environment.lcdxApiServer` | `lcdx/**` | `D:\ALL.NET\LCDXNetApi` |
| Direct methods in `AuthenticationService` | selected per method | both | inspect each method |

Environment behavior:

| Mode | RinNET base | LCDX base | Consequence |
| --- | --- | --- | --- |
| Development | `https://portal.naominet.live/` | `https://lcdxnet.am-allnet.com/` | Browser calls two origins; LCDX backend CORS permits known portal origins. |
| Production | `/` | `/` | The deployed reverse proxy must dispatch `/api/**` to RinNET and `/lcdx/**` to LCDXNetApi. |

`proxy.conf.json` is currently empty, so local `ng serve` is not doing path-based proxying. The development environment values call deployed services directly.

### Current LCDX frontend surface

Observed LCDX calls include:

- Authentication: `lcdx/login`, `lcdx/onetime-v2/{token}`, `lcdx/register_start/{qqNumber}`, `lcdx/register_confirm/{qqNumber}`
- Binding/settings: `lcdx/bind/{userName}/{netCode}`, `lcdx/getBindAccessCode/{currentAccessCode}`, `lcdx/addAccessCode/{userName}`, `lcdx/removeAccessCode/{userName}`
- Announcements: `lcdx/announcement/recent`, `list`, and `item/{id}`
- Event ranking: `lcdx/kop/rank`

These routes were verified against controllers in `D:\ALL.NET\LCDXNetApi\LCDXNetApi\Controllers`.

All remaining game profile, play log, rating, cards, keychip, mission, exchange, circle, festa, DX Pass, rival, and database-version calls use RinNET's `api/**` controllers.

## 4. Authentication coupling

The user-facing sign-in and QQ-number registration flows call LCDXNetApi, but LCDX is an integration layer rather than an independent frontend identity domain:

- LCDX login forwards/authenticates against RinNET and returns the RinNET-style account response.
- LCDX registration verifies the LCDX/QQ flow, then creates the corresponding RinNET user through RinNET admin APIs.
- One-time sign-in also ends in the normal frontend account response.
- `AccountService` stores `{ tokenType, accessToken, refreshToken }` in `localStorage.currentAccount` for the normal application session.
- `AuthenticationService.procLoginResp` writes that response into `AccountService`, after which normal `/api` calls use it.
- Successful login/registration/one-time login runs the upstream account-access restoration first. Banned accounts go to `/banned`; otherwise the user record is loaded and an account with no bound cards goes to `/netcode-bind` once for that login flow. Bound users continue to Dashboard through the calling sign-in flow.
- The frontend intentionally has no EULA page or administrative EULA UI. It does not inspect EULA status, redirect for EULA, fetch EULA content, call an acceptance endpoint, or include an EULA version in the inherited RinNET sign-up request. LCDXNetApi handles the mismatch internally: its shared successful sign-in path reads the current RinNET EULA and idempotently records acceptance before returning the session. This covers QQ login, one-time login, and registration/password-reset login without exposing an `/lcdx/eula/**` frontend API.
- The token interceptor proactively refreshes short-lived access tokens and retries a single failed `/api` or protected `/lcdx` request after refresh.
- LCDX binding and AccessCode controllers validate the presented bearer token against RinNET and may call RinNET admin endpoints to mutate card ownership.
- After `UserService.load()` refreshes `/api/user/me`, it must trigger `BotPermissionService.load(username)`; the four maimai DX cabinet pages and their menu/route guards depend on this LCDX permission bootstrap.

The token interceptor attaches the stored token when a request URL starts with either `environment.apiServer` or `environment.lcdxApiServer`. This keeps protected LCDX requests authenticated when development uses separate absolute origins and when production uses the shared `/` base. A 401 from either backend enters the same single-refresh-and-retry path through RinNET's refresh endpoint.

## 5. Product differences from current upstream

The durable product-level differences are more useful than a raw tree diff:

### LCDX-specific additions

- Separate LCDX API base and explicit HTTP helpers.
- LCDX common login, QQ-number verification/registration, and one-time token sign-in.
- NetCode binding for an authenticated RinNET account with no card/profile. A successful login redirects an unbound user to `/netcode-bind` once for that login flow. The binding page offers an explicit continue-without-binding action, and subsequent Dashboard visits stay on `/dashboard` for `NOT_FOUND` so announcements remain available. Dashboard keeps a binding entry for unbound users and an unbind action for the current card.
- LCDX-backed AccessCode lookup/add/remove in maimai DX settings.
- LCDX-backed announcement list/recent/detail reads.
- LCDX KOP 6th ranking page.
- Custom maimai DX rival ID display/input transform. The symmetric conversion is `60001233 - id` in both directions before display/API mutation.

### Scope and navigation

- The root router exposes home, dashboard, announcements, maimai DX, one-time sign-in, NetCode binding, QQ sign-in/sign-up, banned, and not-found.
- Profile, cards, keychip, importer, contributors, admin, OAuth callback, ordinary RinNET password reset, EULA, Ongeki, and Chunithm are intentionally absent from root navigation even though some inherited source code remains. Banned is the only upstream account-access page enabled.
- The root shell contains Dashboard, announcements, and maimai DX navigation only. The user popover contains sign-out only. Admin impersonation sources may exist from upstream, but there is no root route, menu, declaration, or bootstrap call enabling that workflow.
- `MenuService` contains only the maimai DX menu. It includes profile, rating, records, KOP, photos, DX Pass, circle, festa, server missions, rival, song list, and settings. The point-exchange route exists but currently has no menu item.

### Branding and content

- Browser/PWA branding is `NET` / `LCDX - RinNet` with `laochan.svg` and a local ICP footer.
- Asset hosts are customized; production maimai assets use `https://sdgb-dist.sys-all.com.cn/d/189/`, while general assets remain on `rinnet.stehp.cn`.
- The home, dashboard, sign-in, and sign-up experiences are simplified and LCDX-specific.

### Shared or independently converged features

Server missions and point exchange were added in this fork, but upstream later implemented and further refined similar features. They are not purely LCDX-owned. When porting upstream improvements, compare models and response contracts rather than assuming the implementations are interchangeable.

## 6. Upstream synchronization guidance

The 2026-08 synchronization merged the Angular 22/TypeScript 6 framework baseline and selected shared improvements from upstream commit `defebabe1907aa6ea3e4ca6abe7a0562406f7c77` into the fork based on `9c798dc5cac47ade493056a83712b83c843e4da3`. The product remains an LCDX/maimai-focused fork; framework synchronization does not authorize enabling every upstream route or account workflow.

For future conflicts:

1. Show the relevant code comparison for every substantive conflict before asking for a product decision.
2. Preserve the LCDX-specific behaviors and navigation boundaries in sections 3-5 unless the user explicitly changes them.
3. Prefer upstream Angular 22 syntax and shared implementation improvements when business behavior is equivalent.
4. For conflicts whose code is identical and differs only by line endings, whitespace, or missing EOF newline, normalize formatting and resolve them without another product question. Apply the same policy to future equivalent conflicts.
5. Do not enable upstream OAuth, Passkey, admin/impersonation, profile/cards/keychip/import/contributors, Ongeki, Chunithm, or ordinary RinNET registration/reset merely because their source files are present.

## 7. Design and implementation rules for future work

- Start from the nearest existing component and Bootstrap pattern.
- Use Bootstrap responsive grid/utilities before writing custom media queries.
- Use ng-bootstrap for modal, dropdown, collapse, tooltip, popover, and related Bootstrap interactions where already established.
- Use registered Bootstrap icons through `@ng-icons`; add icons to the nearest module's icon registry.
- Preserve light and dark theme compatibility by using Bootstrap semantic variables instead of fixed foreground/background colors.
- Keep information density similar to the current dashboard and game pages. Avoid marketing layouts, oversized headings, decorative card nesting, and unrelated visual systems.
- Add routes inside the owning feature routing file. Update `MenuService` only when the feature should be discoverable in navigation.
- Keep API response handling compatible with `ApiResponse<T>` and status code `92001` (`StatusCode.OK`). Some endpoints, notably KOP ranking, currently return a raw collection instead; confirm the controller contract before normalizing anything.
- For changes involving `/api`, inspect `RinNET_backend`. For changes involving `/lcdx`, inspect `LCDXNetApi`. For login, registration, card binding, or bearer validation, inspect both.

### Trellis commit discipline (user-mandated 2026-08-17)

- Work in small Trellis loops: implement ONE functional unit → run the check/audit step (`trellis-check`) on it → commit only that unit's files → move to the next unit.
- Never accumulate several finished features into one large commit; commit boundaries follow the layered `implement.md` checklists (each layer or functional unit is its own check + commit).
- Work commits first; Trellis bookkeeping (task checkbox updates, archive, journal) commits after — per `.trellis/workflow.md` Phase 3.4.

## 8. Verification baseline and known rough edges

CI on `master` uses Node 22, runs `npm install`, and then `npm run build-prod`. Dependencies were installed and `npm run build-prod` completed successfully on 2026-08-17 after resolving the synchronization conflicts.

The successful build still reports non-fatal warnings: the Browserslist includes browsers outside Angular 22 support, Bootstrap 5.2 SCSS uses deprecated Sass APIs, the initial bundle is about 167 KB above the configured 2 MB warning budget, and the inherited hidden profile component uses CommonJS `qrcode`.

Known facts worth rechecking during related tasks:

- `proxy.conf.json` is empty despite the README mentioning it.
- The root module eagerly imports game modules while the root router also lazy-loads maimai DX; preserve behavior unless performing a deliberate module-graph cleanup.
- Some imports/routes/components remain declared but unreachable from the fork UI.
- The PWA manifest name/icon branding is partly LCDX-specific and partly inherited (`turtle-*` icon files).
- Cabinet API consumers use the shared `isOk()` response helper so a successful LCDX `92001` status remains readable if a proxy serializes the code as a string.
- The maimai DX cabinet pages explicitly re-enter `NgZone` in LCDX response callbacks. In the deployed Angular 22 setup, cabinet data could be present in the Network response but remain visually absent until an unrelated language change triggered another change-detection pass.
- Angular template event expressions are evaluated against the component context; using `Number($event)` in a binding caused a runtime `this.Number is not a function` failure in the cabinet authorization form. Numeric native inputs now use `[(ngModel)]`, and future form regressions should dispatch real DOM events in component tests.
- The service-worker data group lists only `/api/**`, not `/lcdx/**`; its current cache settings effectively avoid persistent API caching, but any PWA policy change must consider both prefixes.
- Angular 22 control-flow syntax (`@if`, `@for`, `@switch`) is established in synchronized templates. Preserve stable tracking expressions and keep NgModule declarations explicit.

## 9. Useful inspection commands

```powershell
git fetch --prune upstream
$forkBase = git merge-base HEAD upstream/master
git rev-list --left-right --count HEAD...upstream/master
git diff --stat $forkBase HEAD
git diff --name-status upstream/master HEAD
rg -n 'getLcdx|postLcdx|lcdxApiServer|apiServer' src -g '*.ts'
rg -n 'api\.(get|post|put|delete)\(' src/app -g '*.ts'
```

Backend route checks:

```powershell
rg -n '\[Route|Http(Get|Post|Put|Delete)' D:\ALL.NET\LCDXNetApi\LCDXNetApi\Controllers -g '*.cs'
rg -n '@(RequestMapping|GetMapping|PostMapping|PutMapping|DeleteMapping)' D:\ALL.NET\RinNET_backend\src\main\java -g '*.java'
```
