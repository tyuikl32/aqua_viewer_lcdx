# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Standards distilled from the mai2 cabinet management work (2026-08) and the React port of the LCDX
frontend (2026-09). Scope: `aqua_viewer_lcdx` and its integration with `LCDXNetApi`.

---

## Forbidden Patterns

### HTTP DELETE with a request body (non-standard transport)

- `lcdx.delete(path, params, body)` can carry a body. ASP.NET Core accepts `[FromBody]` on DELETE, but
  some proxies/gateways strip DELETE bodies.
- For **new** endpoints, prefer path/query parameters. The body-carrying variant is kept for
  already-settled cabinet endpoints — do not add new body-carrying DELETE calls.

### Unscoped global selectors in a page stylesheet

- Vite CSS is global — there is no Angular view encapsulation. A bare `th { … }` / `td { … }` /
  `.card { … }` rule in `XxxPage.css` restyles every table and card in the app.
- The legacy `public.ranking.scss` did exactly this; the KOP port had to scope its rules under
  `.kop-ranking-page`. **Every new rule must be scoped by a page-specific class or an ancestor.**
- Before inventing a class name, grep for it: `cabinet-select*` is intentionally shared verbatim by
  cabmode / remotecontrol / locks (three copies of the same rules), while `cab-mode-*` is
  cabmode-only. Verified-unique names are what keeps the global stylesheet safe.

- Review imported upstream page CSS too: scoping only new LCDX styles is insufficient.
  Upstream Ongeki bare `.name`/`.rank` rules broke the otherwise correctly ported KOP table.
  Scope the source rules under their owning page and verify both pages with populated data,
  including desktop/mobile table geometry and locally served assets.

### Nullable announcement bodies and LCDX category adaptation

- LCDX announcement list rows may omit `content`; detail/recent can return null when the
  deployed `{id}.html` body is absent. Normalize optional text and translations in
  `Announcement.fromJSON` before rendering; never pass null/undefined to `marked`.
- Use the shared `AnnouncementContent` in list and dashboard. Blank content has localized
  unavailable copy; real content retains DOMPurify sanitization and translation fallback.
- Missing content is a server-data issue too: record affected IDs and the configured
  `AnnouncementContentPath`; do not fabricate body text or fall back to an unrelated API.
- Adapt LCDX `OTHERS` to the UI's upstream `OTHER` on reads and reverse that value only for
  LCDX list-filter requests. Keep upstream admin writes on their existing contract.

### Rewriting a ported LCDX page into shadcn/Tailwind

- Ported pages keep Bootstrap class names because `globals.css` rebuilds the `--bs-*` tokens for
  them. A Tailwind rewrite silently drops that styling and breaks parity with the legacy build. See
  [component-guidelines.md](./component-guidelines.md).

### Raw backend strings in a toast

- `notice(String(error))` and any pass-through of the backend `status.message` render **English**
  backend copy on a Chinese-facing site. Never do this in new or touched code.
- Use `notice(t('Key'))` in render-scope code and `notice(translate('Key'))` in async callbacks, with
  the key present in both `src/i18n/{zh,en}.json` and `public/assets/i18n/{zh,en}.json`.

---

## Required Patterns

### User-facing messages must be localized

- Every success/failure toast, dialog title, button label, placeholder and empty-state string shown
  after a user action resolves through i18next.
- The repo-wide notice sweep (2026-09, commit `75838b9`) brought `notice(...)` call sites to zero
  hardcoded strings. Keep it at zero — a new literal string in a `notice()` call is a regression.
- Both i18n copies must stay in sync: `src/i18n/` (bundled, authoritative) **and**
  `public/assets/i18n/` (static PWA copy). zh/en key sets must match exactly. Adding a key means
  editing four files in one change.
- Async callbacks must use the imperative `translate()` from `@/lib/i18n`, not a captured `t` — the
  language can change while a request is in flight.

### Async snapshots, initialization and request ownership

- Publish EP-01 permission and EP-18 manage-access as one complete snapshot after both settle.
  Invalidate outstanding generations on logout/account changes; a late response must not restore
  another account's permissions. Same-user refreshes retain the last completed snapshot until the
  new one is ready, avoiding guard/initialization loops.
- Await user initialization before constructing username-scoped URLs on cold deep links.
- Guard cabinet reads by both selected cabinet and request generation. Clear old-cabinet cards
  on selection changes; a late result must not relabel the newly selected cabinet.
- Independent LCDX account tools (binding/merge) must not depend on upstream game-profile or
  photo-config success. Only enable binding mutations after a valid binding-state response.
  Preserve the legacy distinction: binding uses `cards[0].luid`, merge uses `defaultCard.luid`.
- Draft filter edits must not retrigger initialization; apply filters explicitly.
- Allow at most one in-flight poll per remote session. Terminal results are monotonic: timeout
  may only change a still-pending entry. Thirty attempts are not a strict wall-clock 60-second
  guarantee when requests are slow. Always release the in-flight marker in `finally`.
- One-time authentication tokens must not be consumed again during React StrictMode effect
  replay. Guard that irreversible operation, not every effect indiscriminately.
- Existing cabinet-level `result.warning` is a deliberate server-authored compatibility message,
  not a generic exception/status passthrough. Preserve its meaning until the protocol supplies a
  localizable warning identifier; continue localizing ordinary success/failure notices.

### Pagination: use the shared controls

- Client and server paging both go through `Maimai2Pagination` (ngx-pagination-compatible compact
  control, `src/features/mai2/Maimai2Pagination.tsx`) or the theme-aware `Pagination`
  (`src/components/shared/Pagination.tsx`). Do not hand-roll a page list.
- The React controls take `totalItems` **explicitly**. That is deliberate: the legacy
  `<pagination-controls>` had no `totalItems` input and computed its pages from a `paginate` pipe
  registered under a matching `id`, so a bare `<pagination-controls>` rendered **nothing at all** —
  silently, with no compile error. Two legacy tables shipped broken this way. The React API makes the
  total a required argument so the failure mode cannot recur.
- Server-side paging passes the server-reported total, not the slice length.

### Cabinet selects: show alias (locationName) and never stretch the box

- Cabinet dropdowns on cabmode / remotecontrol / locks must match the cabinets page option text:
  `nickName || fullKeychip`, with `(locationName)` appended when present.
- The selected value stays `nickName ?? fullKeychip` — the backend locate contract (exact NickName →
  `FullKeychip.Contains`) must not change for display reasons.
- Long option text must **not** widen the closed select or the Bootstrap grid column. Use the shared
  classes on the select and its wrapping column:
  - column: `cabinet-select-col` → `min-width: 0`
  - select: `form-select cabinet-select` → `width/max-width/min-width: 100%|0` + `text-overflow:
    ellipsis`
- Do not widen `col-md-*` to fit longer names; truncation in the closed control is expected.

### Route guards

- Guards live in `src/router.tsx` (`RequireAuth`, `RequireCabinetManage`, `RequireCabinetAdmin`).
  Confirm the tier matches the page: `hasManage` (EP-18 probe) for pages ①②③, `P≥4` for locks, and
  Admin-only surfaces at `MANAGE_PERMISSIONS` (7) / `ADMIN_PERMISSION` (10) as the backend defines.
- `botPermission` loads asynchronously. A guard must pass through while `!loaded` rather than assume
  "no permission" — otherwise a deep link flashes a denial before the probes return. The locks page
  waits for `permission.loaded` before judging `noPermission` for the same reason.

---

## Testing Requirements

- **Type/build gate**: `npm run build` (`tsc -b && vite build`) must be green before every commit.
  This is the only automated check that reliably runs in this environment.
- **`npm run lint` is not usable** — there is no ESLint config in the repo and `eslint` is not a
  declared dependency. Do not claim lint coverage.
- **Offline LCDX regression suite**: `npm run test:lcdx-regression` starts an isolated HTTP Vite
  server at `127.0.0.1:5187` with no live proxy. Requires installed dependencies and Chrome
  (`channel: 'chrome'`). `tests/lcdx-regression/fixture.ts` intercepts all API/LCDX traffic and
  blocks other origins; use fake credentials only. This verifies browser behavior and fixture
  contracts, not live backend integration or pixel parity.
- **i18n audit**: `node scripts/audit-i18n.mjs` checks all four resources, interpolation variables,
  literal translation calls and full-key declarations. `--dynamic` lists unresolved expressions
  for review. The parser comes from the locked Vite React plugin dependency tree; reinstall with
  `npm ci` if needed. This does not prove every backend-driven dynamic key.
- **UI-parity suite**: `tests/ui-parity/` (26 specs) runs via `npm run test:ui-parity` against
  `playwright.parity.config.ts`. It starts two servers — the React dev server and the legacy Angular
  baseline — both on `https://portal.naominet.live` (ports 5173 / 4201). Prerequisites:
  - `npm run gen:cert` (certs already present under `ssl/`), and
  - a hosts entry mapping `portal.naominet.live` → `127.0.0.1` (`scripts/add-hosts.ps1`, needs
    Administrator).
  Without the hosts entry the suite cannot start. The Angular unit tests (`ng test`, 54 known-failing
  legacy specs) were lost with the Angular source — the parity specs are the replacement.
- **Backend counterpart**: `dotnet test LCDXNetApi.sln` (cwd = `LCDXNetApi`), expected 95/95 green;
  use `--filter` for scoped runs. Do **not** run `dotnet` from the Bash tool (known environment
  corruption — see the `dotnet-windows-env-fix` skill).

---

## Known Debt

Tracked, deliberate, do not extend:

- **Localization review boundary**: the page-copy backlog formerly listed here was addressed by
  `8e07df2..97dfa10`; do not keep reporting those screens as wholly unlocalized. Static key,
  interpolation and resource-copy checks are available via `node scripts/audit-i18n.mjs`.
  Dynamic key domains, server-supplied labels and runtime copy still need semantic review.
- **Intentionally NOT i18n candidates**: game-native data — maimai dan ranks
  (`src/features/mai2/models.ts`), music genre names (`Maimai2SongListPage`, `OngekiSongListPage`,
  `ChuniV2SongListPage`), mission reward category names (`server-mission-models.ts`), the maimai
  brand string in `cabinet-models.ts`. These mirror in-game wording; leave them.
- `shot1.png` in the repo root is an upstream stray artifact, tracked in git.

---

## Code Review Checklist

- **IDE auto-revert hazard**: this workspace's IDE occasionally restores old buffer contents over
  just-edited files (hit ~10× during the cabinet work and again during the React port). After each
  edit batch, re-verify the critical file state before building; if a change vanished, re-apply it via
  a one-shot script instead of repeating single edits.
- New user-facing strings: i18n keys in all four JSON files, or they do not ship.
- Route-guard changes: guard tier matches the page's permission tier.
- Store writes: never mutate the current value in place — `createStore` compares by identity, so an
  in-place mutation will not re-render. Always `set()` a new object/array.
- Polling/interval code: state read inside the callback goes through a ref mirror, and the effect
  clears its timer on unmount.
- Ported page: Bootstrap classes preserved, no Tailwind rewrite, new CSS scoped under a page class.
- `catch` blocks with an unused binding fail the build (`noUnusedParameters`) — write `catch { … }`.

### Numeric inputs

- Convert DOM input values explicitly in the change handler
  (`onChange={(e) => setValue(Number(e.target.value))}`); a `type="number"` input still hands you a
  string, and an empty field yields `''`, not `NaN` or `null` — handle the empty state deliberately.
- Do not put a conversion inside a JSX prop expression that only runs on one branch; a mistyped
  handler fails at runtime, not at compile time.
