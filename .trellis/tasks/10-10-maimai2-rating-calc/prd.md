# maimai2 rating page: understated total rating and degenerate elevation recommendation

Status: **diagnosis complete, implementation NOT started** (`planning`)
Priority: P2 · Assignee: Xavior · Base branch: `master`
Reported: 2026-10-10 by the user, from <https://lcdxnet.am-allnet.com/mai2/rating>

## Goal

Establish the root cause(s) of two defects the user observed on the maimai2 rating page, with
evidence that closes arithmetically against the game's own numbers. **No code change is in scope for
this task yet** — the user explicitly asked for diagnosis only.

Symptom A — the displayed total does not match the game.

- The page shows `11030+3216=14246`.
- The game's own stored rating for the same account is `musicRating = 14604`
  (`playerOldRating = 11046`, `playerNewRating = 3558`).
- Delta = **-358**.

Symptom B — the "推分建议" (elevation recommendation) table degenerates to a single row.

- The table renders exactly one row: `15 | (blank) (blank) (blank) (blank) 337`.
- The user's reading: "怎么可能 15 打满才加分" — only a level-15.0 chart at SSS+ is shown as able to
  raise the rating, which contradicts the account's actual score distribution.

Note: the user's separate ground-truth statement — "14.4 at SSS+ is 324" — **matches** this code
(`calcRate(144, 1005000) = 324`), so the per-song arithmetic is *not* what is broken.

## Context

- Page: `src/features/mai2/Maimai2RatingPage.tsx` (route `/mai2/rating`).
- The per-song formula in the page is a faithful copy of the arcade client's
  `Manager.UserDatas.UserRate` — see `design.md` for the line-by-line comparison. Both the
  achievement-coefficient table (`DB/RatingTableIDEnum.cs`, 23 rows) and the
  `floor(ScoreRate × achievement × offset / 10^8)` shape are identical.
- The page's inputs are two RinNET main-site endpoints, `api/game/maimai2/rating` (B35) and
  `api/game/maimai2/new_rating` (B15), plus the local IndexedDB catalog `maimai2Music` (preloaded
  from `api/game/maimai2/data/musicList`) for each chart's constant.
- The page is fork-local in content but upstream in origin: `git diff backup -- <page>` shows only
  the `maiAssetsHost` rename and one i18n error string; the algorithm is upstream's.
- The recommendation algorithm is inherited verbatim from the archived Angular page
  (`git show legacy-angular:src/app/sega/maimai2/maimai2-rating/maimai2-rating.component.ts`),
  where the variable that seeds the table is named `minRating` but is computed as a **maximum**.

## Requirements

- R1 Identify, with reproducible evidence, every reason the page's total diverges from the game's
  stored rating, and quantify each contribution exactly.
- R2 Identify the reason the elevation table renders a single degenerate row for this account.
- R3 For each root cause, record what a fix would require — including whether it is even fixable in
  this repository — **without applying it**.
- R4 Record the open decisions that the fix depends on (semantics of the recommendation table;
  who owns the catalog data).

### Revision 2 (2026-10-10, after the user's answers)

- R5 The elevation table must be bounded by the pool's **weakest** counted rating (the slot a new
  score would displace), not by the account's best song.
- R6 The page must show **two** tables behind a toggle: "BEST35 推分建议" and "BEST15 推分建议".
- R7 The old/new pool threshold must be **computed dynamically** from "current minor + previous
  minor" (today 27000 + 26500 → 26500; after an update 27500 + 27000 → 27000), never hardcoded.
- R8 The All-Perfect bonus must be **computed on the backend** and delivered with the rating lists.
- R9 The missing chart data for `12023` / `12024` / `16066` remains **out of scope** (user decision);
  the design must state the residual error this leaves and how the page degrades.

### Revision 3 (2026-10-10, second answer round)

- R10 The backend computation lands in a **new `LCDXNetApi` endpoint** (`lcdx/rating`). `LCDXNetApi`
  holds no game data (its `CllnetDbContext` has no game tables), so the endpoint **forwards through
  the main-site domain** (`TitleSettings.RinnetHost` = `portal.naominet.live`) and enriches the
  response locally; it must not connect to any game database (`design.md` §R3.2).
- R11 The endpoint returns the **final per-song rating** (AP bonus included); the frontend stops
  computing the formula.
- R12 The elevation table has **no upper bound**: it keeps only `> base`; `getRatingGrowth` is
  retired. `base` = the pool's weakest **positive** counted rating.

### Revision 4 (2026-10-10, design frozen)

- R13 The `LCDXNetApi` endpoint returns **both pools from one call** (`GET lcdx/rating?aimeId=…`),
  each record carrying its final `singleRate`; the frontend no longer computes the formula.
- R14 The endpoint fetches upstream with **one `export` call** (α1) plus a globally cached
  `musicList`, and builds the pool split itself (this also removes the ±1 tie-break discrepancy,
  RC4).
- R15 The frontend has **no fallback** to the main site's `rating`/`new_rating`: failure surfaces
  `Common.OperationFailed`.
- R16 Display during the deferred catalog gap: headline = the game's own `musicRating`; per-song
  badges and both tables = computed `singleRate`; unscored records are marked and counted.

## Acceptance Criteria

- [x] The frontend's own output is reproduced exactly offline from live data:
      B35 = 11030, B15 = 3216, total = 14246, table = one row `15 → 337`.
- [x] Every root cause is backed by a game-side source citation (file + line) and/or a live API
      response, and the residuals close to 0.
- [x] The fix plan states, per cause, whether it is doable inside `aqua_viewer_lcdx` alone.
- [x] User decision on the intended semantics of the elevation table → **answered 2026-10-10**:
      bounded by the minimum (R5), two tables behind a toggle (R6).
- [x] All implementation-level decisions (baseline, upper bound, backend placement, payload, fetch
      strategy, endpoint shape, fallback, gap display) → **resolved 2026-10-10**, frozen in
      `design.md` §R3.6 and `implement.md`.

## Out of scope

- Applying any fix (this task stops at diagnosis; the fix becomes a follow-up task once the open
  questions are answered).
- ChuniV2 / Ongeki rating pages (frozen — must stay aligned with upstream).
- Backend/RinNET catalog repair for songs `12023` / `12024` / `16066` — that data lives outside this
  repository (see `design.md` → RC2).

## References

- `src/features/mai2/Maimai2RatingPage.tsx`
- `E:\ALL.Net\Re_SDGB\Assembly-CSharp_LC_170_org\Manager\UserDatas\UserRate.cs`
- `E:\ALL.Net\Re_SDGB\Assembly-CSharp_LC_170_org\Manager\UserDatas\UserRating.cs`
- `E:\ALL.Net\Re_SDGB\Assembly-CSharp_LC_170_org\DB\RatingTableIDEnum.cs`
- `E:\ALL.Net\Re_SDGB\Assembly-CSharp_LC_170_org\Manager\UserData.cs` (`UpdateUserRate`)
- `.trellis/tasks/10-10-maimai2-rating-calc/design.md` (root-cause report)

## Outcome (2026-10-10)

Implemented and committed on local branches; **nothing pushed** (user instruction).

- `LCDXNetApi` `main` → `bcd0ac8` `feat(lcdx): add GET lcdx/rating with the maimai2 BEST35/BEST15
  pools` — new controller + `Maimai2RatingService` + `Maimai2CatalogCache` + DTOs, registered in
  `Program.cs`. `dotnet build` → 0 errors (123 pre-existing warnings, unchanged).
- `aqua_viewer_lcdx` `master` → `6800b49` `fix(mai2): drive the rating page from lcdx/rating and
  bound the elevation table by the pool minimum` — page rewrite + `models.ts` + the four i18n copies.
  `npm run build` (`tsc -b && vite build`) exits 0.

Verified offline against account `13297476`: `Σ b35 = 11046` (exactly the game's
`playerOldRating`), `Σ b15 = 3224`, headline `14604` (the game's own `musicRating`), three unscored
records, and the elevation table is no longer degenerate (B35 13.7 → 15.0, B15 8.9 → 15.0).

Deferred as agreed: catalog repair for `12023` / `12024` / `16066` (the residual 334 points).
