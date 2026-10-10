# Implementation plan (final) — EXECUTED

> **Status: implemented 2026-10-10, committed locally, not pushed.** Backend `LCDXNetApi` `bcd0ac8`,
> frontend `aqua_viewer_lcdx` `6800b49`. The step lists below are kept as the executed plan; see
> "Verification results" at the end of this file.

## Agreed direction (design.md → Revisions 2 and 3)

| item | decision |
| --- | --- |
| table bound | the pool's weakest **positive** counted rating (B35 → 299, B15 → 164) |
| table upper bound | none — keep only `> base`; `getRatingGrowth` retired |
| pool split | two tables behind a toggle: "BEST35 推分建议" / "BEST15 推分建议" |
| pool threshold | dynamic: `floor500(maxCatalogRomVersion < 90000) - 500` (today 26500) |
| AP bonus | computed in a **new `LCDXNetApi` endpoint** `GET lcdx/rating?aimeId=…` |
| data path | forward through the **main-site domain** (`TitleOptions.RinnetHost`), one `export` call (α1) + globally cached `musicList`; never a DB connection |
| payload | single endpoint returning both pools, each record carrying the final `singleRate` |
| frontend fallback | none — fail with `Common.OperationFailed` |
| catalog gap (RC2) | deferred; the UI must show it rather than hide it |

## S1 — `LCDXNetApi`: `GET lcdx/rating?aimeId={extId}`

- [ ] New controller under an existing `[Route("lcdx")]`-style route (follow `LCDXNetKOP.cs` /
      `LCDXNetUserApi.cs` for controller conventions, envelope, and `[Authorize]` posture).
- [ ] Forward the caller's `Authorization` **through the main-site domain** using
      `Helper/CustomHttpClient.cs`'s header overloads
      (`GetAsync<T>(url, HttpRequestHeaders?)` against `TitleOptions.RinnetHost`, default
      `https://portal.naominet.live`) — the pattern used by `EulaService` and
      `RinnetAdminTokenService`. **No** game-DB connection: `CllnetDbContext` has no game tables and
      the `aqua_beta@…` URL is a local-copy artefact, not production (`design.md` §R3.2).
- [ ] Upstream calls, per request:
      1. `{host}/api/game/maimai2/export?aimeId=` → `userData` (carries `musicRating`,
         `playerOldRating`, `playerNewRating`) and `userMusicDetailList` (per-song
         `achievement` + `comboStatus`);
      2. `{host}/api/game/maimai2/data/musicList` → chart constants (`details[level].levelDecimal`),
         **cached globally** (static game data; there is existing distributed-cache infrastructure in
         `DistributedRinnetTokenCache` to model on).
- [ ] Compute, per record: `scoreRate = details[level].levelDecimal`; `offset` from the mirrored
      23-row `RatingTableIDEnum` table; `singleRate = floor(scoreRate * min(ach,1005000) * offset /
      100000000) + (comboStatus ∈ {3,4} ? 1 : 0)`; `scored = levelDecimal != null`.
- [ ] Build both pools with the dynamic threshold (`floor500` of the catalog's max romVersion below
      `90000`, minus 500) — this also removes RC4's ±1 tie-break difference.
- [ ] Response (design.md §R3.3):
      `{ status, data: { poolThreshold, gameMusicRating, b35: [...], b15: [...] } }`, each record
      `{ musicId, level, romVersion, achievement, scoreRate, comboStatus, singleRate, scored }`.
- [ ] Do **not** touch `GetUserRatingHandler` or the `recent_rating*` `UserGeneralData` values — that
      path feeds the arcade client.
- [x] Acceptance: aimeId `13297476` → `Σ b35.singleRate = 11046` (= `playerOldRating`),
      `Σ b15.singleRate = 3224`, three `scored:false` records (`110364`, `111358`, `12024`),
      `gameMusicRating = 14604`. Verified offline from the captured `export` before implementing
      (`design.md` §A10); the residual 334 is the deferred catalog gap.

## S2 — Frontend: consume `lcdx/rating`

- [ ] `src/features/mai2/Maimai2RatingPage.tsx`: replace the two `api.get('api/game/maimai2/rating'|
  'new_rating')` calls with `lcdx.get('lcdx/rating', { aimeId })`; delete `calcRate` from this page
  (the backend owns the formula) and render `singleRate` directly.
- [ ] No fallback path: on failure `notice(t('Common.OperationFailed'))` (D7).
- [ ] Header card: `gameMusicRating` as the authoritative number; keep the `b35+b15=` presentation
      from the returned sums (D8 / §R3.5).
- [ ] Records with `scored === false` rendered distinctly (not as a plain `0`) plus a count of
      unscored records in the header card, so the 334-point gap is visible.
- [ ] Keep the per-song card layout and the `Maimai2SongDetail` drawer behaviour unchanged.

## S3 — Frontend: two tables behind a toggle

- [ ] One table host with a Bootstrap `btn-group` + `btn-check` toggle switching B35 ↔ B15. **Keep
      Bootstrap class names** — this React port must not be restyled to shadcn/Tailwind.
- [ ] Both the mobile (`d-block d-md-none`) and desktop (`d-none d-md-block`) tables follow the
      toggle.
- [ ] Table maths (per pool, in this page — it needs the 23-row table anyway for the `d`-grid):
      `base` = weakest positive `singleRate` in that pool; `rows[rank] = { d ∈ [10,150] :
      floor(d * ach(rank) * offset(rank) / 1e8) > base }`; `headers` = the existing
      20/40/60/80/100-percentile pick over the SSS+ row's `d` set; header cell `header / 10`, body
      cell the computed rating. No upper bound.
- [ ] i18n: split `Maimai2.RatingPage.ElevateRecommend` into two keys (B35 / B15) in **both**
      `src/i18n/{zh,en}.json` and `public/assets/i18n/{zh,en}.json`; zh/en and both copies in sync.

## S4 — Deferred (do not do in this task)

- [ ] Catalog repair for `12023` / `12024` / `16066` — explicitly out of scope (user decision);
      reopening it is a separate task with the RinNET data owner.
- [ ] No client-side hardcoded constant table as a workaround.

## Verification gates (when implementation starts)

- [ ] `LCDXNetApi`: build green; `lcdx/rating` returns the envelope for a real account; upstream
      fan-out bounded (1 per-user call + cached catalog).
- [ ] `aqua_viewer_lcdx`: `npm run build` (`tsc -b && vite build`) exits 0; `npm run
      test:lcdx-regression` unchanged.
- [ ] Live check vs aimeId `13297476`: header B35 = 11046; B35 table rows 13.7 → 15.0 (not a single
      row); B15 table rows 8.9 → 15.0 and visibly different; three unscored records; headline total
      14604.
- [ ] No edits to ChuniV2 / Ongeki rating pages (frozen, upstream-aligned).

## Reuse note

Live probe recipe (which login endpoint works, which endpoints exist, response shapes) is in
`design.md` §1.1 and §R2.3; the data-path constraint is in §R3.2. Captured responses:
`%TEMP%\lcdx-export.json`, `%TEMP%\lcdx-musiclist.json`.

## Verification results (2026-10-10)

| gate | result |
| --- | --- |
| `LCDXNetApi` build | **0 errors**; 123 warnings, the same count as the pre-change build, so no new warnings were introduced. Run through the PowerShell tool, never Bash. |
| `aqua_viewer_lcdx` build (`npm run build` = `tsc -b && vite build`) | **exit 0**, `✓ built in 6.36s` |
| i18n parity | all four files parse; `src/i18n/{zh,en}` and `public/assets/i18n/{zh,en}` are identical for the `Maimai2.RatingPage` block, and the zh/en key sets match |
| algorithm vs the game's own numbers (account `13297476`) | `Σ b35 = 11046` == `playerOldRating`; `Σ b15 = 3224`; headline `14604` == `musicRating`; residual 334 = the deferred `12024` catalog gap |
| elevation table | B35 rows 13.7 / 14.0 / 14.4 / 14.7 / 15.0, B15 rows 8.9 / 10.4 / 12.0 / 13.5 / 15.0 — both non-degenerate |
| `npm run test:lcdx-regression` | **`shell-alignment.spec.ts` passed 4/4** (1920/1366/1280/992 px) — the spec this repo's frontend guidelines actually guard. The full 60-test suite was started but not completed: at one worker it needs roughly an hour (4 shell tests alone took 4.9 min because each boots a server and a browser), and it does not cover the rating page. |
| frozen surfaces | `src/features/chuni/**` and `src/features/ongeki/**` untouched |

### Notes / follow-ups

- Two pre-existing debts were deliberately left alone as out of scope: the hard-coded `Rating:` label
  in the header card, and the elevation table's row grid being a synthetic 10..150 step-1 range
  rather than the chart constants that actually exist (`design.md` §A8).
- Deferred: catalog repair for `12023` / `12024` / `16066`. Until that lands the page shows the
  game's own `musicRating` as the headline and reports the unscored records explicitly, so the
  remaining 334-point gap is visible rather than hidden.

## Local end-to-end run (2026-10-10, second pass)

Backend started locally (`http://localhost:5104`) and driven with the real account through a browser.
This pass caught a defect the offline recomputation could not: **the catalog endpoint requires
authentication** and the cache sent no token (401) — so the first implementation failed on every
call. Fixed, plus two smaller weaknesses; see `design.md` §8 for the full list and the local-run
recipe. Commits: `LCDXNetApi` `0bc7e96` (fixes) on top of `bcd0ac8`.

| check | result |
| --- | --- |
| `GET lcdx/rating` with the account's token | `92001`; `Σ b35 = 11046` (identical to the game's `playerOldRating`), `Σ b15 = 3224`, `gameMusicRating = 14604`, threshold `26500` from `lastRomVersion 1.70.00`, 3 unscored records |
| without `Authorization` | `94001 Authorization is required` |
| while authenticated as aimeId `1` (not the account's) | `95001 ... (HTTP 404)` — the main site's rejection is propagated |
| catalog cache | second call 2.0 s vs 3.8 s first call (catalog cached; the rest is the ~1 MB export) |
| page `/mai2/rating` in a browser | header `11046+3224=14604` + the unscored warning; BEST35 table rows 13.7 / 14.0 / 14.4 / 14.7 / 15.0; toggle → BEST15 rows 8.9 / 10.4 / 12.0 / 13.5 / 15.0; 50 cards, 3 unscored markers; **no console errors, no failed requests** |
| screenshots | `.artifacts/rating-b35.png`, `.artifacts/rating-b15.png` (gitignored) |

## Production smoke test (2026-10-10, backend deployed / frontend not yet)

The backend (`0bc7e96`) was deployed to `https://lcdxnet.am-allnet.com` while the frontend was still
the previous build. Two passes, both green.

**Pass 1 — the deployed endpoint directly** (21/21 assertions):

| area | result |
| --- | --- |
| endpoint present | `GET /lcdx/rating` → 200 with `94001 Authorization is required` (not 404) |
| auth | no header → `94001`; foreign `aimeId` → `95001 ... (HTTP 404)`; the account's token → `92001` |
| values | `Σ b35 = 11046` == the game's `playerOldRating`; `Σ b15 = 3224` (residual 334); `gameMusicRating = 14604`; `poolThreshold = 26500` from `lastRomVersion 1.70.00`; 3 unscored records including `12024`; 16 AP-flagged records inside B35; no record crosses the pool boundary |
| shape | `b35`/`b15` = 35/15 entries with all 8 fields the page reads |
| stability | three identical responses (2.7 s / 2.1 s / 2.1 s) |
| no regression | `/api/user/me`, `/lcdx/kop/rank`, `/api/game/maimai2/profile` (still `musicRating = 14604`) all fine |

**Pass 2 — the new frontend against the deployed backend** (the post-deploy pairing): the local `dist/`
served with `/api/*` → the real main site and `/lcdx/*` → `https://lcdxnet.am-allnet.com`. Login →
`/mai2/rating` shows the same numbers as the local run, BEST35 table 13.7 → 15.0, toggle → BEST15
8.9 → 15.0, 50 cards, 3 unscored, **no console errors and no failed requests**.

Deployment notes confirmed by the smoke:

- the edge already routes `/lcdx/*` to `LCDXNetApi` (the new endpoint answers on the production
  domain), so shipping the frontend needs no proxy change — it is an artifact swap;
- the endpoint adds no EF entity and touches no table, so it needs no `CLL.Net` migration;
- the frontend bundles everything it needs (the prod `.env` keeps `LCDX_API_SERVER = '/'`), so no new
  runtime configuration is required;
- the PWA updates through `sw.js` (`registerType: 'autoUpdate'`), so returning users pick the new
  bundle up on their next load.

**One diagnostics defect found in the deployed build (not fixed here):** with an invalid token the
catalog fetch (which runs before the account check) fails first, so the caller sees
`95001 Failed to load the game catalog` instead of an authentication error. It is rejected correctly
either way, and the page only surfaces a generic message, but the wording misleads during debugging.
A one-line change (include the upstream HTTP status in that message, or map a 401 to `94001`) would
fix it — it needs a redeploy, so it was left for the user to schedule.
