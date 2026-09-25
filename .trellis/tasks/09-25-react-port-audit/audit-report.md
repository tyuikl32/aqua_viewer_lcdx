# React upstream merge / LCDX preservation audit

## Scope and conclusion

This is a semantic preservation audit of **46 local migration commits**,
`90ed95b..9df7a97`, on `migrate/react-port`, plus the corrective working-tree patch.
The chronological list is in `commit-inventory.txt`. Compare against:

- Upstream React baseline: `90ed95b` (`upstream/main`, refreshed during the follow-up; local `backup` baseline unchanged).
- Preserved LCDX Angular baseline: `legacy-angular` / `master` at `b1c3fb4`.
- LCDX customization delta: `defebab..legacy-angular`.
- Adjacent backend contract baseline: `LCDXNetApi` at `49f20db`, inspected read-only.

Twelve confirmed defect groups were corrected (including the two user-reported follow-up issues) and regression coverage added. The patch retains
upstream theme/game infrastructure and the original LCDX-specific flows; it does not rewrite
ported Bootstrap screens. Review covered cumulative behavior and the migration inventory;
**the 46 historical commits were not each checked out, built, and runtime-tested separately**.
During the follow-up, both remotes were fetched: `upstream/main` remains `90ed95b` and
`origin/master` remains `b1c3fb4`, matching local `master`. No branch switch, history rewrite,
Git commit, or push was performed. A later, controlled Nginx-only deployment follow-up backed up and
updated the two requested site rewrite includes; the application `dist` artifact was rebuilt locally but
not uploaded.

## Corrected findings (ranked)

Severity is relative to frontend behavior: P1 is a major retained-flow failure, P2 is a
conditional functional defect. Frontend permission state is not a replacement for server
authorization; no server privilege escalation is claimed. Paths below are repository-relative.

### F01 / P1: incomplete permission snapshots and late logout replies

- Location: `src/lib/botPermission.ts:70-107`.
- EP-01 and EP-18 previously each set `loaded=true` independently. A guard could reject an
  authorized user using only half the permission snapshot. Replies arriving after clear/logout
  could repopulate permission state.
- Fix: settle both probes, publish one snapshot, invalidate generations on clear/account change.
  Same-user refresh retains the completed snapshot to avoid guard/initialization loops.
- Evidence: both response orders, late replies after clear, and same-user refresh are covered by
  the four tests in `tests/lcdx-regression/permissions.spec.ts`. Ten tier/deep-link cases also
  exercise P0/P3/P4/P7/P10 across cabmode and locks.
- Boundary: this addresses the permission store; it does not prove all `loadUser()`/auth races
  are solved. A broader late `/api/user/me` response is a separate, unconfirmed inherited risk.

### F02 / P1: retained binding/merge UI depended on game-profile success

- Location: `src/features/mai2/Maimai2SettingPage.tsx:71-113,338-417`.
- The spliced React initialization waited for upstream profile/photo configuration before
  reading binding state, and placed LCDX cards inside the profile condition. Either unrelated
  game request failing hid retained account tools; the regression fixture observed zero binding
  reads before the fix. Legacy loaded these independently.
- Fix: independent requests with `Promise.allSettled`; binding/merge UI follows loaded account
  card identity, while profile-only cards retain their original condition and ordering.
- Evidence: settings regression with both game requests failing still reads/displays binding.
  Multi-card test exercises merge request/cancel using the default card.

### F03 / P2: failed binding lookup was treated as an unbound account

- Location: `Maimai2SettingPage.tsx:90-101,169-170,347-365`.
- A failed envelope with null data could enable binding input as though a successful empty code
  had been returned. This loses the distinction between unknown and genuinely unbound state.
- Fix: require an OK envelope with string data; mutation handler and button require loaded state.
- Evidence: failed lookup keeps the input disabled; successful empty response permits binding.
  Contract test verifies `cards[0].luid` for binding vs `defaultCard.luid` for merge.

### F04 / P2: editing audit-log filter drafts reinitialized the whole locks page

- Location: `src/features/mai2/Maimai2LocksPage.tsx:120-180`.
- `loadLocks` depended on draft fields and was also an initialization-effect dependency. Typing
  therefore refreshed user, logs, grants and members before Apply and reset the log page.
- Fix: mirror the current loader in a ref; initialization no longer depends on draft identity.
- Evidence: typing does not reload the tables; applying filters still sends the expected query.

### F05 / P2: cold cabmode deep links constructed an empty-username catalog URL

- Location: `src/features/mai2/Maimai2CabmodePage.tsx:141-153`.
- Mode catalog loading could run before an uncached user had loaded.
- Fix: await user initialization before constructing the username-scoped request.
- Evidence: cold-entry fixture verifies the authenticated catalog path.
- Attribution: an integration/cold-start defect; the legacy also started catalog loading early,
  so this report does not assert that the entire race was newly invented by the React port.

### F06 / P2: a late selected-cabinet response could replace another cabinet's data

- Location: `Maimai2CabmodePage.tsx:105-109,156-168,194-202`.
- Select A, then B, while A is slow: A's result could overwrite the displayed B state.
- Fix: selected-nick plus generation guards, clear info on selection, invalidate on cleanup;
  reboot/level actions stay disabled while the new cabinet info is absent.
- Evidence: delayed A cannot replace B in the browser regression. This async race also existed
  in the legacy implementation; it is fixed without treating it as a new upstream regression.

### F07 / P2: overview had the same stale-selection race and an unhandled rejection

- Location: `src/features/mai2/Maimai2CabinetsPage.tsx:53-113,142-154`.
- Four card loaders could write outdated cabinet data, and a rejected member of the fire-and-
  forget `Promise.all` produced an unhandled rejection.
- Fix: guard every loader by nick/generation, clear cards on selection, settle independently,
  show a localized failure notice for the still-current refresh.
- Evidence: slow A then B plus one failed card leaves B's successful state intact without an
  unhandled page error. Stale selection is an inherited async risk, not solely a migration loss.

### F08 / P2: the last successful remote poll was overwritten as a timeout

- Location: `src/features/mai2/Maimai2RemoteControlPage.tsx:119-145`.
- Attempt 30 could set a successful terminal result and then unconditionally overwrite it with
  timeout in the same iteration.
- Fix: timeout only changes an entry still pending; terminal results are monotonic.
- Evidence: both success-on-final-attempt and pending-on-final-attempt cases pass.

### F09 / P2: remote result requests overlapped for the same session

- Location: `Maimai2RemoteControlPage.tsx:71,105-134`.
- With a deliberately blocked response, advancing ten seconds caused five concurrent requests.
  Overlapping replies could consume attempts and race terminal updates.
- Fix: one in-flight request per session, current-pending checks, cleanup in `finally`.
- Evidence: the blocked-response regression stays at one request until the response is released.
  Thirty attempts remain an attempt limit, not a strict 60-second wall-clock deadline.

### F10 / P2: development StrictMode consumed a one-time login token twice

- Location: `src/pages/auth/OnetimeSignInPage.tsx:18-24`.
- StrictMode effect replay issued two token-login requests; the second single-use response
  could fail after the first succeeded. The regression observed two requests before the fix.
- Fix: guard this irreversible one-shot operation with a ref. Localize loading text in all four
  resources and use current-language translation for async notices.
- Evidence: one request and the intended no-card redirect under the actual development render.
- Attribution: this reproduction is development StrictMode-specific; it is not evidence of
  production double invocation.

### F11 / P1: LCDX announcement null bodies crashed list and dashboard details

- `Announcement.fromJSON` replaced its empty-string default with `null`/`undefined`; both
  details then called `marked.parse` without a string. Reproduced with isolated browser fixtures.
- Backend `AnnouncementService.ReadAnnouncementContentAsync` returns null when `{id}.html` is
  missing. Read-only unauthenticated test-site requests returned status 92001 with null content
  for `/lcdx/announcement/item/47`, `/item/15` and `/recent?index=0`; `/item/1` returned a
  30-character string. These live observations are separate from offline regression tests.
- Normalize body/title/translations at the DTO boundary. Share `AnnouncementContent` between
  list and dashboard; blank bodies show a localized unavailable message without parsing.
  Preserve Markdown, sanitized HTML and original-text fallback for blank translations.
- Adapt LCDX `OTHERS` to upstream `OTHER` on reads and reverse the list-filter request value.
- Twelve content/category cases cover both entry points, null/omitted/empty/whitespace bodies,
  translation fallback, sanitized rendering and the category filter.
- Remaining server task: restore the actual deployed announcement files or fix
  `AnnouncementContentPath` (default `announcement`, relative to the application base directory).
  No server files or configuration were changed; this frontend fix cannot reconstruct bodies.

### F12 / P2: upstream Ongeki global CSS distorted the preserved KOP ranking

- KOP was added locally in `d4b0ab9`; upstream has no KOP page. Current KOP markup, scores,
  dates and medals match the LCDX legacy port. Missing KOP styles were not the cause.
- The unchanged upstream `OngekiProfilePage.css` exported bare `.name` and `.rank` rules.
  Angular master isolated component styles; React/Vite imports make them global. The rules
  turned KOP names into large flex boxes and rank cells into absolutely positioned artwork.
- Before the fix, a populated ranking fixture produced a 432px first row and score/date
  columns around 14/13px wide. Scope the 34 bare selectors to `.ongeki-profile-page` at source;
  do not overwrite KOP markup/data or disable the upstream Ongeki presentation.
- Six populated KOP cases cover three theme families at 1280px and 390px, verifying medals
  load, score/date/order, normal row geometry and no viewport overflow. Envelope/empty-list
  compatibility and Ongeki's own layout add two more cases. KOP dark mode is not parameterized;
  screenshots are diagnostics, not an Angular-vs-React pixel-parity baseline.

## Preservation coverage matrix

| Area | Comparison/check | Result and evidence boundary |
| --- | --- | --- |
| Shared API/auth | LCDX wrapper vs legacy and React refresh/auth transport | Shared auth pipeline retained. QQ login/register, TOTP, refresh/logout and one-time contracts checked. Login/register/one-time/NET binding have browser fixtures; real TOTP/refresh not exercised. |
| Routing/menu | React baseline vs HEAD, legacy LCDX visibility | Only EULA route intentionally removed; NET bind, one-time login and five LCDX mai2 routes added. Chuni/Ongeki route implementations remain; sidebar groups intentionally hidden for this deployment. |
| Guards | Permission constants, route tiers, backend permission/manage-access contracts | Ten P0/3/4/7/10 cabmode/locks deep-link cases plus four store race cases pass. No change to backend enforcement. |
| Cabinets/cabmode | Legacy pages and backend EP-01/04-12/18/19 | Selection, info, modes, players, delivery, download progress, reboot, LC settings and level contract reviewed. Nine LC keys and existing level-warning semantics retained. Read/selection fixtures run; no real cabinet command. |
| Remote control | Legacy command catalog and backend EP-13 | Seventeen protocol command IDs and ordinary-user subset retained. Polling defects fixed; last-attempt and overlap fixtures pass. No live command execution. |
| Locks/grants/permissions | Legacy plus EP-14-17/20/20L/20D | Page1/size20, filters, grant tiers and P10 note requirement retained. Draft-input and guard behavior tested; full backend authorization matrix reviewed statically only. |
| Settings | Original independent loads, account/card contracts | Binding/merge restored independent of profile requests. First-vs-default card distinction tested, including request/cancel. Portrait upload remains deliberately disabled. No production binding/merge/export. |
| Dashboard/announcements | Legacy quick-nav, global players, unbind, announcement sources | Quick-nav, 30-second refresh, unbind and indexed announcements retained. LCDX reads and `/api/admin/announcement` editor writes match legacy. Nullable bodies/category adaptation covered by 12 cases; read-only test-site null bodies confirmed. No live mutations. |
| Game deltas | `defebab..legacy-angular` vs React equivalents | `7633613` already restored vsRank1 icon, rival transform, CiRCLE PLUS version and Chuni name placeholder. Rival transform `60001233 - id` list/add/delete roundtrip tested. Other game pages primarily localization/asset changes. |
| KOP/models | Legacy non-cabinet maimai model delta, KOP page | KOP rank model/page preserved; global Ongeki CSS leakage fixed. Six desktop/mobile geometry cases plus envelope/empty response and Ongeki-isolation checks pass. Fixtures are not the full production dataset. |
| Upstream UI/themes | Upstream engine/catalog and ported Bootstrap structure | Theme engine preserved; legacy/liquefy/animal-island, each light/dark, pass mobile width/runtime checks. Not a full image or authenticated pixel-parity verdict. |
| i18n | Four resource copies, literal AST references and current dynamic domains | 1,205 keys per resource; 1,361 literal calls; no missing keys/copy/interpolation drift. Eleven reviewed domains cover 101 suffix keys. Unknown future backend-driven strings remain outside that proof. |
| Assets/branding | Environment hosts, CDN call sites, PWA/shell | LCDX branding retained; maimai assets separate from general assets. No live CDN availability test. |
| CI/deployment | React dist layout and fork deployment workflow | Node22/npm-ci/build and fork deployment customizations retained; Docker uses `/root/dist`. Static review and local build only, no deployment. |
| Trellis/docs | Migration inventory, parent/child task, frontend specs | Audit artifacts and reusable async/isolation rules updated; stale hardcoded-copy backlog corrected. Commit/archive awaits user confirmation. |

## Intentional differences, not omissions

- EULA was deliberately removed according to LCDX history; this is not a missing accidental port.
- OAuth/passkey entrypoints and Chuni/Ongeki sidebar groups are deliberately hidden; related
  implementations were not indiscriminately deleted.
- Disabled portrait upload, LCDX homepage/footer/branding and cabinet permission tiers preserve
  local behavior rather than blindly restoring upstream defaults.
- Existing body-carrying DELETE endpoints and GET-based NET binding match settled backend
  contracts; this audit did not redesign their transport.
- Server-authored cabinet level warnings and game-native text are not replaced by generic
  translations; protocol command/key identifiers are not localized.

## Validation

- `npm run test:lcdx-regression`: **56 passed (1.2m)** on the final source and fixtures, including the known-protected deep-link and unknown-route cases.
- `npm run build`: passed on final application code (TypeScript + Vite + PWA generation).
- `node scripts/audit-i18n.mjs`: passed; four times 1,205 keys, 1,361 static calls, zero errors.
- Current dynamic domain cross-check: 101 keys across 11 domains, zero missing; see
  `i18n-dynamic-review.json`. This is an explicit finite review, not arbitrary dynamic evaluation.
- `git diff --check`: passed for tracked changes; new audit/test files are also checked before handoff.
- `npm run lint`: unavailable, exit1 (`eslint` not recognized); project has neither its declared
  dependency nor usable config. **No lint pass is claimed.**
- Existing CSS `@charset` and >500 kB bundle warnings remain; they also occurred before these fixes.

Offline suite breakdown: permissions4, guards10, cabinets7, account4, settings3, rival1, themes6, content20.
The fixtures use fake identities/tokens, block external origins, disable service workers and do
not configure a live API proxy. Chrome and free local port5187 are required. See
`tests/lcdx-regression/README.md` for repeatable commands.

## Limits / remaining risks

1. Backend code was read for contracts, not modified, built or runtime-tested. Separate
   unauthenticated read-only test-site announcement requests confirmed missing content. No
   authenticated integration, live permissions, application artifact deployment or CDN-health validation was run.
   The later Nginx-only SPA fallback update was verified independently on both live hosts.
2. The existing legacy-vs-React parity suite was not run: its separate HTTPS/hosts/legacy-server
   prerequisites were not exercised. The six theme tests are automated mobile layout/runtime
   checks, not manual screenshot approval or all-pages desktop/visual parity.
3. No claim is made that every async race, request failure, dynamic i18n value or every upstream
   feature path is exhaustively proven correct. The general late user-load/logout race deserves
   a dedicated auth-lifecycle audit if pursued; it was not established as a migration defect here.
4. Real destructive actions (reboot, grants, merges, unbind, admin edits) were not sent. Mock
   success is contract/UI evidence only. Language-switch notices in touched pages follow the
   imperative translation convention; no global unrelated callback rewrite was performed.
5. Historical commits and local branch pointers remain unchanged; remote-tracking refs were refreshed. Corrective changes are uncommitted in
   the worktree. Trellis Phase3.3 is recorded; Phase3.4 requires confirmation of `commit-plan.md`
   before commits, then Phase3.5 archive/journal. The task is intentionally not marked archived.

## Follow-up build artifact

Production output was rebuilt in `E:/ALL.Net/Project_LCDX_NET/aqua_viewer_lcdx/dist`.
`index.html` references `assets/index-lUIX_dDw.js` and `assets/index-B6maVScG.css`;
PWA output includes `sw.js` and `workbox-9c191d2f.js`. The artifact was not uploaded; only the two site-specific
Nginx rewrite includes were updated after backup and reload validation.


## F13 / P1 (deployment): missing SPA fallback on the test vhost

- **Symptom:** Direct `GET /mai2/photos` on `test-lcdxnet.am-allnet.com` returned Nginx 404, so the React `RequireAuth` guard never ran. The production vhost already had the fallback; the test rewrite include was empty.
- **Fix:** Backed up both site configurations to `/root/backups/lcdx-spa-20260925-123607`; ensured both separate rewrite files contain `location / { try_files $uri $uri/ /index.html; }`; `nginx -t` passed; reloaded with `systemctl reload nginx`.
- **Verification:** Browser checks on September 25, 2026 confirmed both hosts resolve `/mai2/photos` to `/` for an unauthenticated user and `/not-a-real-route` to `/not-found`. Nginx returned the SPA document with HTTP 200 for both deep links.
- **Boundary:** This fixes entry-point delivery only. React owns auth redirection and 404 semantics; API proxy locations were not changed. The rebuilt local `dist` was not uploaded.
