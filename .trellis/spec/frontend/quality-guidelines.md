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

- **Hardcoded Chinese copy outside `notice()`**. The notice sweep covered toasts; page copy in
  several upstream-ported screens is still literal Chinese, so English users see Chinese:
  `src/pages/AdminPage.tsx` (admin labels + confirm prompts), `src/components/shell/ConfirmDialog.tsx`
  (确认/取消/确定 defaults), `src/pages/AnnouncementEditPage.tsx`, `src/pages/BannedPage.tsx`,
  `src/pages/PlaceholderPage.tsx`, `src/pages/KeychipPage.tsx`, `src/main.tsx` (impersonation
  bootstrap failure), `src/features/mai2/Maimai2PointExchangesPage.tsx`,
  `Maimai2FestaPage.tsx`, `Maimai2ServerMissionsPage.tsx`, `Maimai2PhotosPage.tsx`,
  `Maimai2DxPassPage.tsx`, `src/lib/auth/access.ts` (QQ group notice).
  Not to be fixed piecemeal — do it as one sweep with keys added to all four i18n files.
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
