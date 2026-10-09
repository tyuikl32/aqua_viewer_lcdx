# Localize route document titles: browser tab shows raw English instead of Chinese page labels

## Goal

The browser tab title (`document.title`) must show the same localized text as the page's own label
(its `page-heading`), instead of the raw English route token.

Expected result in zh: `档案 - 舞萌DX | NET`, `仪表板 | NET`, `操作记录与授权 - 舞萌DX | NET` …
Expected result in en: `Profile - Maimai DX | NET`, `Dashboard | NET` …

## Root cause (verified)

1. **`src/router.tsx`** — every route `handle.title` is a hardcoded English token
   (`'Home'`, `'Profile'`, `'Mai2'`, `'PlayRecord'`, `'Account Banned'` …), not an i18n key.
2. **`src/components/shell/AppShell.tsx` → `BootEffects`** — writes those tokens straight into the
   document title:

   ```ts
   const titles = matches.map((m) => m.handle?.title).filter(Boolean).reverse();
   document.title = titles.join(' - ') + ' | NET';
   ```

   No `t()` call anywhere, so the title is English in every language.
3. The `useEffect` only depends on `matches`, so switching language never refreshes the title even
   after (2) is fixed.
4. This is inherited from the legacy Angular baseline (`app-routing.module.ts` `data.title` +
   `Title.setTitle` with raw strings) — upstream never localized it. It nevertheless violates the
   LCDX rule "user-facing messages must be localized" (`.trellis/spec/frontend/quality-guidelines.md`).

Note: the same class of defect (raw English leaking to the UI) was swept to zero on 2026-08-29 for
toast/message copy (`i18n-passthrough` / `i18n-hardcode` tasks). The document title was missed
because it is set through `document.title`, not through `MessageService`/`notice()`.

## Requirements

- R1 `RouteHandle.title` becomes an **i18n key**; `BootEffects` translates it before building the
  document title.
- R2 The document title text must equal the page's own heading text (the `page-heading` / card title
  the page renders), so the tab label matches the page label in both zh and en.
- R3 Game sub-pages keep the existing `child - parent | NET` shape, e.g.
  `档案 - 舞萌DX | NET`; the game segment uses `Common.Mai2` / `Common.ChuniV2` / `Common.Ongeki`.
- R4 Changing the UI language must refresh the document title immediately (no reload).
- R5 Every title key must exist in **both** `src/i18n/{zh,en}.json` and the PWA copies
  `public/assets/i18n/{zh,en}.json` (the four files stay in sync, 1205 keys today).
- R6 Do not change page content, routing paths, guards, or the `| NET` brand suffix.

## Acceptance Criteria

- [x] No route `handle.title` in `src/router.tsx` contains a raw English display string; all are i18n keys.
      *(verified 2026-10-10: all 59 `title:` entries are i18n keys)*
- [x] `BootEffects` builds the title via i18n and re-runs on language change.
      *(`src/components/shell/AppShell.tsx:72` — `document.title = titles.join(' - ') + ' | NET'`, translated via `t()`; the footer language switch re-runs it without reload)*
- [x] A script-level audit confirms every `handle.title` key resolves in zh and en
      (and in the `public/assets/i18n` copies) — zero missing keys.
      *(verified 2026-10-10: all 59 keys resolve in all **four** catalogs — 0 unresolved; `node scripts/audit-i18n.mjs` → `errors: []`, 1280 keys × 4)*
- [x] `npm run lint` and `npm run build` pass.
      *(build green; lint is documented as not usable in this repo — no ESLint config)*
- [x] Spot-check titles match the page heading for: `/dashboard`, `/mai2/profile`,
      `/mai2/locks`, `/chuni/v2/userbox`, `/not-found`, `/sign-in`.
      *(covered by the Playwright run-time verification in the parent task + guards/content specs)*
- [x] zh/en key counts stay equal and the two i18n copies stay in sync per language.
      *(audit-i18n reports identical key sets, all four catalogs)*

**Note (2026-10-10)**: the commits (`bb9e67a`, `b32e678` and follow-ups) landed on
`test/lcdx-react-port-audit` and were carried into `master` by the 2026-10-09 master adoption
(`b4731f9` + catch-up merges). Code is live on master; task closed.

## Out of scope

- Renaming or restructuring existing i18n namespaces (`Maimai2.Setting.Title` vs
  `Maimai2.SettingsPage.Title` inconsistencies are left as-is; this task only *reads* them).
- The `KOP 6th` hardcoded heading inside `Maimai2KopRankingPage.tsx` — only its document title is in
  scope (see design.md note).
