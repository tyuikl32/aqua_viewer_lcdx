# Localize the hardcoded KOP 6th page heading (use the existing Maimai2.KopPage.Title key)

## Goal

`src/features/mai2/Maimai2KopRankingPage.tsx:53` renders
`<h1 className="page-heading">KOP 6th</h1>` — a hardcoded display literal that violates
"User-facing messages must be localized" (`.trellis/spec/frontend/quality-guidelines.md`).
Switch it to the i18n key that already exists.

## Context

- Leftover follow-up of `09-28-document-title-i18n`, which added `Maimai2.KopPage.Title`
  (= `KOP 6th` in both zh and en) and pointed the route `handle.title` at it.
- The page already calls `t('Maimai2.KopPage.NoRanking')` in the same render, so `useTranslation`
  is wired up — this is a one-token change, no new imports and no new keys.
- Why it matters beyond style: the document title and the page heading must stay one source of
  truth. Today the tab says `t('Maimai2.KopPage.Title')` while the heading says a literal; if the
  label is ever corrected, the two will silently drift.

## Requirements

- R1 Replace the literal `KOP 6th` in the `page-heading` `h1` with `{t('Maimai2.KopPage.Title')}`.
- R2 No other changes to the page (data fetching, ranking table, layout, classes stay identical).
- R3 No new i18n keys — `Maimai2.KopPage.Title` already exists in all four resources.

## Acceptance Criteria

- [ ] `grep -n "KOP 6th" src/features/mai2/Maimai2KopRankingPage.tsx` returns no hardcoded heading.
- [ ] The rendered heading text is still `KOP 6th` in both zh and en (key value unchanged).
- [ ] `node scripts/audit-i18n.mjs` still reports `"errors": []`.
- [ ] `npm run build` (tsc -b && vite build) exits 0.

## Out of scope

- `src/features/chuni/ChuniV2SongScoreRanking.tsx:196` hardcoded `<h2>User Score</h2>` — separate
  debt item, and ChuniV2 is currently hidden/unused in this deployment (mai2-only, see
  `src/lib/menu.ts`). Not worth touching here.
- Renaming the `Maimai2.KopPage` namespace.
