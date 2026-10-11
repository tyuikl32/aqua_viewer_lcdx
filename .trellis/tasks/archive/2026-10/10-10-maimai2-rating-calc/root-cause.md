# Root-cause report — maimai2 rating page

All numbers below were produced on 2026-10-10 against the production deployment
`https://lcdxnet.am-allnet.com`, using the test account the user supplied
(`2320812015`, aimeId `13297476`), and against the local 1.70 client decompilation.

---

## 1. Reproduction

### 1.1 How the page's data is obtained

| Purpose | Call | Notes |
| --- | --- | --- |
| Session | `POST /lcdx/login` `{usernameOrEmail, password}` | **Not** `/api/auth/signin` — that endpoint belongs to the RinNET main site and returns `34011 Login failed` for this LCDX account. |
| Account | `GET /api/user/me` | `cards[].extId` = `13297476`. |
| Catalog | `GET /api/game/maimai2/data/musicList` | 1708 entries; `details` is an **object** keyed `"0".."4"`. |
| B35 | `GET /api/game/maimai2/rating?aimeId=` | `musicId:level:romVersion:achievement` comma-joined. |
| B15 | `GET /api/game/maimai2/new_rating?aimeId=` | same shape. |
| Authoritative totals | `GET /api/game/maimai2/profile?aimeId=` | `musicRating`, `playerOldRating`, `playerNewRating`, `highestRating`. |
| Full user data | `GET /api/game/maimai2/export?aimeId=` | 1.0 MB JSON; contains `userMusicDetailList` (4230 rows, **with `comboStatus`**). `userRateList` is `null` in the export. |

### 1.2 Ground truth from the game (authoritative)

```
musicRating    = 14604
playerOldRating = 11046     (B35)
playerNewRating =  3558     (B15)
highestRating   = 15004
lastRomVersion  = 1.70.00 / lastDataVersion 1.70.01
```

### 1.3 What the page renders (reproduced offline, bit-for-bit)

Re-implementing the page's `calcRate` + `recommendation` verbatim over the live responses yields:

```
B35 = 11030   B15 = 3216   TOTAL = 14246
highest (max B35 single rating) = 335
maximum = 335 + 20 = 355
rows sizes (S+/SS/SS+/SSS/SSS+) = 0, 0, 0, 0, 1
ratingBases (SSS+ row) = [150]   → headers = [0,0,0,0,150] → displayed [ , , , ,15]
table:
  lv   - |     .     .     .     .
  lv   - |     .     .     .     .
  lv   - |     .     .     .     .
  lv   - |     .     .     .     .
  lv 15.0 |                         337
```

This is exactly the screenshot the user supplied (`11030+3216=14246`, single row `15 | 337`).
**Reproduction confirmed.**

---

## 2. The page's arithmetic is the game's arithmetic (minus one term)

### 2.1 The game

`E:\ALL.Net\Re_SDGB\Assembly-CSharp_LC_170_org\Manager\UserDatas\UserRate.cs`

```csharp
// L50-58  cap achievement at Rate_22, then find the coefficient
int num2 = Achievement >= RatingTableID.Rate_22.GetAchive()
             ? RatingTableID.Rate_22.GetAchive() : (int)Achievement;
for (int num3 = 22; num3 >= 0; num3--)
    if (((RatingTableID)num3).GetAchive() <= num2) { num = ((RatingTableID)num3).GetOffset(); break; }

// L59-69
if (notes != null)
{
    uint num4 = 0u;
    if (UserRating.ApBonusTable.ContainsKey(comboflagID))     // ← ALL-PERFECT BONUS
        num4 = UserRating.ApBonusTable[comboflagID];
    ScoreRate  = notes.level * 10 + notes.levelDecimal;
    SingleRate = (uint)(int)((long)ScoreRate * (long)num2 * num / 100000000) + num4;
    OldFlag    = romVersion < 26500;
}
```

`Manager\UserDatas\UserRating.cs`

```csharp
// L8-30
ApBonusTable = { None:0, Silver:0, Gold:0, AllPerfect:1, AllPerfectPlus:1 };
// L32-34
RatingListMax = 35; RatingNewListMax = 15;   // L67-78: OldFlag ? RatingList(35) : NewRatingList(15)
```

`Manager\UserData.cs` `UpdateUserRate()`: `MusicRating = OldRating + NewRating`, where
`OldRating = Σ RatingList.SingleRate` (≤35) and `NewRating = Σ NewRatingList.SingleRate` (≤15).

`DB\RatingTableIDEnum.cs`: 23 rows, `(index, name, rank, achievement, offset)`. Identical to the
page's `records` array.

### 2.2 The page

`src/features/mai2/Maimai2RatingPage.tsx` L26-43:

```ts
function calcRate(level: number, achievement: number): number {
  const records = [ /* same 23 rows, same values */ ] as const;
  const capped = Math.min(achievement, records[22][0]);      // 1005000
  let offset = 0;
  for (let index = records.length - 1; index >= 0; index -= 1)
    if (records[index][0] <= capped) { offset = records[index][1]; break; }
  return Math.floor((level * capped * offset) / 100_000_000);   // ← NO AP BONUS
}
```

`level` is `detail.levelDecimal`, which the catalog stores as `notes.level * 10 + notes.levelDecimal`
(verified: catalog song 8 Basic/Advanced/Expert/Master = 50/79/102/…; the page renders
`levelDecimal / 10` → "5.0 / 7.9 / 10.2"). So `level` **is** the game's `ScoreRate`.

**Difference: the page omits `+ num4` (the All-Perfect / All-Perfect-Plus bonus of +1 per chart).**
The omission is old, not a 1.70 regression — `ApBonusTable` is already present in
`Assembly-CSharp_LC_162_org` and `Assembly-CSharp_LC_165_org`.

---

## 3. Root causes

Let `R0(song) = floor(ScoreRate × ach × offset / 10^8)` (AP bonus excluded) and
`R(song) = R0(song) + (comboStatus ∈ {3,4} ? 1 : 0)`.

### RC1 — the page drops the All-Perfect bonus (`+1` per AP chart)

Recomputing both pools from the **server's own per-song records** (4230 rows of
`userMusicDetailList`, which carry `comboStatus`) and the **server's own catalog**:

| pool | Σ R0 | Σ R | game truth |
| --- | --- | --- | --- |
| B35 (top 35, `romVersion < 26500`) | 11031 | **11046** | **11046** ✔ |
| B15 (top 15, `romVersion ≥ 26500`) | 3216 | 3227 | 3558 |

B35 closes **exactly** once `+1` is added for every All-Perfect chart (16 AP charts inside the
top 35). Contribution to the page's error: **+16**.

### RC2 — the RinNET catalog has no chart constants for a song the account has a record on

`GET /api/game/maimai2/data/music?id=12024`:

```json
{"musicId":12024,"name":"OV3RCLOCK","artistName":"Alicemetix","romVersion":27002,"addVersion":27,"details":{}}
```

Exactly **two** catalog entries have empty `details`: `12023 (Dear Player 2)` and `12024 (OV3RCLOCK)`.
Song `16066` has a rating record on the server but **is absent from the catalog entirely**.

The page does `ratingBase: detail?.levelDecimal ?? 0` (L76), so `12024` is scored as **0** instead of
its real value. The account has on `12024`: Master, `achievement = 1005000` (SSS+),
`comboStatus = 3` (AllPerfect), `playCount = 3`.

Solving `3558 − 3227 = 331` gives `R(12024) = 331` → `R0 = 330` → `ScoreRate = 147` → **12024 is a
14.7 chart**. Substituting it closes B15 exactly:

```
3227 (Σ R over the 14 resolvable B15 entries) + 331 (12024) = 3558 = playerNewRating  ✔
```

Contribution to the page's error: **+331**. Note this cause is not repairable inside this repository
— `details` for `12023`/`12024` and the missing `16066` come from the RinNET main site catalog
(`portal.naominet.live` behind the same host, see the project topology notes).

### RC3 — the elevation table is seeded from the account's **best** song, not its weakest counted one

`Maimai2RatingPage.tsx` L172-197:

```ts
let highest = 0;
for (const item of best35) if (item.rating > highest) highest = item.rating;   // L176-179
const maximum = highest + ratingGrowth(highest);                                // L180
const rows = [980000, 990000, 995000, 1000000, 1005000].map((rank) => targetDs(highest, maximum, rank));
// targetDs: keeps d ∈ [10,150] with computed > rating && computed <= maximum   (L52-59)
```

`targetDs` therefore only keeps chart constants whose resulting rating **exceeds the account's best
single-song rating**. For this account:

- best single song = 335 (14.9 SSS+, three charts) — 336 if the AP bonus were counted;
- the absolute ceiling of the formula is 337 at ScoreRate 150 (15.0) + 1 AP = 338;
- so the only qualifying cell in the entire 5×5 grid is `15.0 / SSS+ → 337`.

The table answers the wrong question. A rating only rises when a new score beats **the weakest song
that currently occupies a counting slot** (the 35th-old / 15th-new), i.e. the account's
`min` — here **299** (and the B15 slot is currently occupied by 0-value entries). A table seeded at
299 would span roughly level 13.3 → 15.0, which is what the user expects to see.

Evidence that the *minimum* was the original intent: the archived Angular implementation
(`git show legacy-angular:src/app/sega/maimai2/maimai2-rating/maimai2-rating.component.ts`) names
the variable **`minRating`** yet computes a maximum:

```ts
let minRating = 0;
for (const best35RatingItem of this.best35Rating) {
  ...
  if (best35RatingItem.rating > minRating) { minRating = best35RatingItem.rating; }   // MAX under a MIN name
  const maxRating = minRating + this.getRatingGrowth(minRating);
  this.recommendTripleSPlus = this.get_TargetDs(minRating, maxRating, 1005000);
  ...
}
```

The React port renamed it to `highest` and preserved the behaviour, so the naming evidence is still
readable in the fork's history.

Note also that this legacy loop recomputed the whole recommendation table **inside** the per-item
loop, so the legacy page's table depended on which item happened to be last. The React version is
already better here (it computes once over the real maximum) — but it is still the wrong quantity.

### RC4 (minor) — B35 membership differs from the server's list by one slot

`GET /api/game/maimai2/rating` contains `388:2` (Expert, 299); a full independent recomputation of the
best 35 from the per-song records yields `11230:3` instead. Δ = 1 point. Cause: tie-breaking — the
game orders equal ratings by achievement (`UserRate.LessThanRateAndAchievement`), and the server's
list uses a different comparison. Impact: ±1, not material.

---

## 4. Residual ledger

| item | page | game | delta | cause |
| --- | --- | --- | --- | --- |
| B35 | 11030 | 11046 | −16 | RC1 (AP bonus) + RC4 (−1 tie-break) |
| B15 | 3216 | 3558 | −342 | RC1 (`+11` AP) + RC2 (12024 = 331 missing constant) |
| total | 14246 | 14604 | **−358** | |

All three residuals close to 0 once RC1 and RC2 are applied, so no unexplained term remains.

---

## 5. What a fix would require (not implemented)

| cause | fixable in `aqua_viewer_lcdx`? | what it takes |
| --- | --- | --- |
| RC1 AP bonus | **No, not from the current data** | `api/game/maimai2/rating` / `new_rating` return only `musicId:level:romVersion:achievement` — **no `comboStatus`**, so the bonus is underivable client-side. Options: (a) extend the two RinNET endpoints to emit `comboStatus` (server-side, outside this repo); (b) stop recomputing and display `profile.musicRating` for the header (the per-song badges would still be 1 low); (c) fetch `export` and read `userMusicDetailList` (1 MB payload, 4230 rows — heavy). |
| RC2 missing constants | No | Catalog data owned by the RinNET main site. Client-side mitigation would be a hardcoded override table, which the project's conventions discourage. |
| RC3 table baseline | **Yes** | Decide the intended semantics (see §6), then change `highest`/`targetDs` accordingly — and respect the pool split (old songs compete only in B35, new songs only in B15, threshold `romVersion < 26500`). |
| RC4 tie-break | Only by changing the server list | Client-side, resolve the pools itself instead of trusting `rating`/`new_rating`; low value. |

A sensible minimal fix that is fully inside this repo: use `profile.musicRating` (already fetched by
`Maimai2ProfilePage`) for the header total, fix RC3 for the recommendation table, and file the RC1/RC2
data problems against the RinNET catalog.

## 6. Open questions (blocking the fix)

1. **RC3 semantics.** Should the recommendation table be seeded with the *weakest counted* song
   (the slot a new score would displace — the reading the legacy `minRating` name suggests), or is
   the current "beat your best" framing intended and only the degeneracy for near-ceiling players is
   a bug? The answer changes the table from ~1 row to ~5 rows of levels.
2. **Pool awareness.** Should the table be split into two blocks (old-song pool / new-song pool),
   given a song's pool membership is fixed by its `romVersion` and the two pools do not compete?
3. **RC1 data source.** Is extending `api/game/maimai2/rating|new_rating` with `comboStatus`
   acceptable, or should the page fall back to `profile.musicRating` for the headline number only?
4. **RC2 ownership.** Who owns the RinNET catalog? `12023`/`12024` need their `details` filled and
   `16066` needs to be added before the page can be correct for any account with records on them.

## 7. Evidence artefacts

- Live responses captured to `%TEMP%\lcdx-export.json` (full `userData` + 4230 `userMusicDetailList`
  rows) and `%TEMP%\lcdx-musiclist.json` (1708-entry catalog).
- The probe scripts themselves were deleted after use because they embedded the test account's
  password in plain text; `design.md` §1.1 lists every call needed to rebuild them.
- Nothing in this task touched the repository working tree; `git status` shows only the untracked
  task directory.

---

# Revision 2 — agreed direction (2026-10-10, after the user's answers)

## R2.1 Decisions taken by the user

| # | Question (rev 1 §6) | User's answer |
| --- | --- | --- |
| 1 | Table semantics | The table should be **bounded by the minimum**, i.e. "at minimum, which difficulty for how many points" — not by the account's best song. (RC3 stands as diagnosed.) |
| 2 | Pool split | **Yes, split into two tables** behind a toggle: "BEST35 推分建议" and "BEST15 推分建议". |
| 3 | Pool threshold | Must be **computed dynamically**, not hardcoded at 26500: the rule is "current minor + previous minor". Today 27000 + 26500 → threshold 26500; after an update 27500 + 27000 → threshold 27000. |
| 4 | AP bonus | **Compute it on the backend** (add the calculation server-side). |
| 5 | Catalog gaps (RC2) | Explicitly **out of scope for now** — "not the issue we should handle now". |

## R2.2 Target design — frontend

### (a) Dynamic pool threshold

The arcade client hardcodes `OldFlag = romVersion < 26500` (`UserRate.cs` L68); SEGA moves that
constant on every version bump. Reproduce the rule instead of the constant:

```
romOfVersion(minor)  = 20000 + minor * 100          // 1.70 → 27000, 1.65 → 26500
minorOf(romVersion)  = (romVersion - 20000) / 100
newPoolThreshold     = floorTo500(maxCatalogRomVersion) - 500      // today 27000 - 500 = 26500
```

- Source of `maxCatalogRomVersion`: the preloaded `maimai2Music` catalog, taking
  `max(song.romVersion)` over entries with `romVersion < 90000` (the sentinel value `99900` does
  occur — it appears in the **rating records**, and must never be used as a version).
- Sanity check against today's data: catalog max = `27003` → `27000` → threshold `26500`; the
  account's new-pool membership reconstructed with this threshold reproduces the server's
  `new_rating` list exactly (13 resolvable + `12024` + `16066`).
- Fallback: if the catalog is empty (not yet preloaded) fall back to parsing
  `profile.lastRomVersion` (`"1.70.00"` → minor 70 → 27000 → threshold 26500).

### (b) Pool membership

Split by the **catalog's** `romVersion`, never by the record's: the record's `romVersion` carries
the `99900` sentinel for at least `11956` and `16066`, whereas the catalog has the real value
(`11956` → new pool). If a song is absent from the catalog (e.g. `16066`), fall back to the record's
`romVersion` with the sentinel treated as "new".

### (c) Two tables behind a toggle

- One table host, a Bootstrap `btn-group`/`btn-check` toggle (project convention: keep Bootstrap
  class names; no shadcn/Tailwind) switching between the B35 table and the B15 table.
- Titles: reuse/duplicate the existing i18n key — `Maimai2.RatingPage.ElevateRecommend` becomes two
  keys (e.g. `ElevateRecommendB35` / `ElevateRecommendB15`), added to **both**
  `src/i18n/{zh,en}.json` and `public/assets/i18n/{zh,en}.json`.
- Both the mobile and the desktop table variants must follow the toggle (the page currently renders
  both).

### (d) Table construction (per pool)

```
base(pool)   = rating of the last (weakest) entry that currently occupies a counting slot
rows[rank]   = { d ∈ [10,150] : calcRate(d, rank) > base(pool) }
headers      = the existing 20/40/60/80/100-percentile pick over the SSS+ row's `d` set
cell(d,rank) = rows[rank][d]
```

The seed becomes `base(B35)` / `base(B15)` respectively — replacing `highest` in
`Maimai2RatingPage.tsx` L176-180. Whether the `≤ base + ratingGrowth(base)` upper bound is kept or
dropped is the remaining open question (rev 2 §R2.5 Q2).

## R2.3 Target design — backend (AP bonus)

Chain of facts established from the code, which constrains where the computation can live:

1. The game uploads `Net.VO.Mai2.UserRate` = `{musicId, level, romVersion, achievement}` **only** —
   no `singleRate`, no `comboStatus` (`Re_SDGB/.../Net/VO/Mai2/UserRate.cs`).
2. `icu.samnyan.aqua.sega.maimai2.handler.impl.UpsertUserAllHandler` (L265-268) stores that string
   verbatim into `UserGeneralData(propertyKey = recent_rating | recent_rating_new | …_next)`.
3. `ApiMaimai2PlayerDataController` L722-745 serves those strings as-is to the web
   (`GET api/game/maimai2/rating|new_rating`).
4. `comboStatus` (the AP flag) lives in a different table — `UserMusicDetail` (exposed by
   `UserMaimai2MusicDetail`, and already reachable: `GET api/game/maimai2/song/{musicId}` returns it).
5. The chart constant lives in `Maimai2MusicDetail.levelDecimal`.
6. The game's own pool builder `GetUserRatingHandler` feeds the **arcade client**, so its wire format
   must not change.

Therefore the computation belongs at **web read time** (option α below), never in
`GetUserRatingHandler`:

- **α (recommended)** — enrich `ApiMaimai2PlayerDataController.downloadUserRating` /
  `downloadUserNewRating`: parse the stored `musicId:level:romVersion:achievement` string, look up
  `levelDecimal` from `Maimai2MusicDetail` and `comboStatus` from `UserMusicDetail`, and append the
  resulting single-song rating as a 5th field:
  `musicId:level:romVersion:achievement:singleRate`. Old consumers ignore the extra field.
- **β** — same but expose `comboStatus` (5th field) and keep the formula in the frontend. Rejected by
  the user's answer ("compute it on the backend"), and it splits the formula across two repos.
- **γ** — a new `lcdx/*` endpoint on `LCDXNetApi` that proxies the main site and enriches it. More
  moving parts, and LCDXNetApi has no game data.

The formula to implement is exactly `UserRate.cs` L50-69:

```
offset      = RatingTableIDEnum[ sorted achievement thresholds ][ best ≤ min(achievement, 1005000) ]
singleRate  = floor(scoreRate * min(achievement,1005000) * offset / 100000000)
            + (comboStatus == AllPerfect || comboStatus == AllPerfectPlus ? 1 : 0)
scoreRate   = levelDecimal            // == notes.level*10 + notes.levelDecimal
```

### ⚠ Residual after the backend fix — the `12024` gap does NOT close by itself

The main site's music table has **no `Maimai2MusicDetail` row for `12023` / `12024`** (the web
catalog returns `details: {}` for exactly those two), and no `Music` row at all for `16066`.
A backend-side computation reads the same table, so it will still emit `12024 → 0`.

Quantified effect for the test account after the AP fix alone:

| term | value |
| --- | --- |
| backend B35 (AP included) | 11046 ✔ (= `playerOldRating`) |
| backend B15 (AP included) | 3227 (vs `playerNewRating` 3558) |
| remaining error | **331** = `12024`'s true single-song rating (14.7 / SSS+ / AP → 330 + 1) |

So the backend fix closes 27 of the 358 (16 + 11 AP points) and leaves 331, which is exactly the
catalog gap the user deferred. The frontend must therefore not claim to be authoritative until the
music data is complete — see §R2.5 Q4.

## R2.4 Files that the implementation will touch (when it starts)

| file | change |
| --- | --- |
| `RinNET_backend` `ApiMaimai2PlayerDataController.java` (L722-745) | append the computed `singleRate` (option α) |
| `aqua_viewer_lcdx` `src/features/mai2/Maimai2RatingPage.tsx` | dynamic threshold, pool split, two tables + toggle, consume the backend rating |
| `aqua_viewer_lcdx` `src/i18n/{zh,en}.json` + `public/assets/i18n/{zh,en}.json` | two new headings for the split tables (both copies, must stay in sync) |
| `aqua_viewer_lcdx` `src/features/mai2/Maimai2RatingPage.css` | only if the toggle needs a class; otherwise untouched |

Note `RinNET_backend` is **outside this workspace** (`E:\ALL.Net\RinNET_backend`); the frontend change
must therefore degrade gracefully when the 5th field is absent.

## R2.5 Remaining open questions

1. **Baseline when a pool's weakest slot is 0.** For this account the B15 table's weakest counted
   entry is `0` (four near-zero slots), so `base = 0` makes the table span every level. Choose:
   (A) keep it literal (`base` = the weakest counted entry, `0` included), or
   (B) ignore zero-valued slots (`base` = the weakest **positive** counted entry → B35 `299`,
   B15 `164`), which yields a much tighter, more actionable table.
2. **Upper bound.** (A) keep only `> base` so the table spans up to the 15.0 ceiling (the percentile
   header still compresses it to 5 rows), or (B) keep the legacy `≤ base + ratingGrowth(base)` band.
3. **Where the backend change lands.** `RinNET_backend` (recommended — the endpoint and both data
   tables live there) vs a new `LCDXNetApi` proxy endpoint.
4. **What the page shows while the `12024` gap remains.** Options: (A) show the computed total as-is
   and surface the gap in the UI (e.g. a warning that N records could not be scored); (B) show the
   game's own `profile.musicRating` as the headline number and the computed per-song values only as
   badges; (C) do nothing extra.

---

# Revision 3 — backend placement resolved (2026-10-10, second answer round)

## R3.1 User answers

| # | Question | Answer |
| --- | --- | --- |
| D1 | baseline when the weakest slot is 0 | **weakest _positive_ counted entry** (B35 → 299, B15 → 164) |
| D2 | upper bound | **only `> base`** — table spans to the 15.0 ceiling, the percentile pick compresses it to 5 rows; `ratingGrowth` is retired |
| D3 | where the backend change lands | **a new `LCDXNetApi` endpoint** |
| D4 | payload | the backend returns the **final per-song rating** (frontend no longer computes it) |

## R3.2 Data locality — the new endpoint must forward through the main-site domain

Two facts, one of which was corrected by the user after the first draft of this section:

1. **Certain** — `LCDXNetApi` cannot compute the rating from its own database.
   `LCDXNetApi/Database/CllnetDbContext.cs` exposes **no game tables**: only `Cabinet*`,
   `OptionRecord`, `Error*Record`, `PlayRecords`, `PlaylogRecords`, `LCDXUser*`,
   `LCDXAnnouncement*`, `KOPRankings`, `RinnetAdminTokens`, `LCDXMemberPermissions`,
   `LCDXCabinetGrants`, `CabManage*`, `CabmodeLists`. There is no `Maimai2Music(Detail)`, no
   `UserMusicDetail`, no `UserGeneralData`.
2. **Corrected (user, 2026-10-10)** — the production main site's database is *not*
   `aqua_beta@38.147.172.133`. That JDBC URL appears in the local `E:\ALL.Net\RinNET_backend`
   working copy's `application.properties`, i.e. it is that copy's own local/staging datasource and
   must **not** be used as evidence about production. The game data is reached **through the main
   site's domain** (`portal.naominet.live`) — which is also the path the browser already uses
   (`lcdxnet.am-allnet.com/api/*` is reverse-proxied to it).

Consequence: the new endpoint is a **forwarding/enriching proxy over the main-site domain**, never a
DB connection. `LCDXNetApi` already has the machinery for exactly this:

- `LCDXNetApi/Configures/TitleOptions.cs` → `RinnetHost` (default
  `https://portal.naominet.live`; overridden by `appsettings.json` → `TitleSettings.RinnetHost`);
- `LCDXNetApi/Helper/CustomHttpClient.cs` →
  `GetAsync<T>(string url, HttpRequestHeaders? additionalHeaders = null)` and
  `PostWithOptionsAsync<T>(string url, string jsonContent, HttpRequestHeaders? additionalHeaders = null)`
  — the header overload is what carries the caller's `Authorization` through;
- precedent for both: `Services/EulaService.cs` (L32/L47), `Services/RinnetAdminTokenService.cs`
  (L298/L332, with headers), `Services/LoginRegisterService.cs` (L163 `{RinnetHost}{path}`).

The token issued by `POST /lcdx/login` is accepted by the main site (verified live, §1.1), so the
incoming `Authorization` header can simply be forwarded.


## R3.3 Proposed endpoint contract

`GET lcdx/rating?aimeId={extId}` on `LCDXNetApi` (route alongside the other `lcdx/*` controllers),
returning both pools in one round trip:

```jsonc
{
  "status": { "code": 92001, "message": "..." },
  "data": {
    "poolThreshold": 26500,        // dynamic: floor500(maxCatalogRomVersion < 90000) - 500
    "gameMusicRating": 14604,      // from export.userData.musicRating (the game's own number)
    "b35": [ { "musicId": 11394, "level": 3, "romVersion": 22513, "achievement": 1010000,
               "scoreRate": 149, "comboStatus": 4, "singleRate": 336, "scored": true }, … ],
    "b15": [ … ]
  }
}
```

Field notes:

- `singleRate` = `floor(scoreRate * min(achievement,1005000) * offset / 100000000) + (AP ? 1 : 0)`,
  i.e. the game's formula verbatim (`design.md` §R2.3).
- `scored: false` marks records whose chart constant could not be resolved (today exactly
  `12024` / `16023`… i.e. the deferred catalog gap) — it lets the UI distinguish "0 points" from
  "cannot be computed".
- `poolThreshold` is returned so the frontend does not need its own copy of the rule; the frontend
  simply renders `b35` / `b15`.
- The response is an `ApiResponse` envelope like the other `lcdx/*` endpoints.

## R3.4 Two ways to fill it (recommendation: α1)

| | α1 — one export + cached catalog (recommended) | α2 — lists + per-song probes |
| --- | --- | --- |
| upstream calls per page load | 2: `export?aimeId=` (≈1.0 MB, has `userData` **and** all 4230 `userMusicDetailList` rows incl. `comboStatus`), plus `data/musicList` (≈1.5 MB, global cache — static game data) | 52: `rating` + `new_rating` (tiny) + one `song/{id}` per pooled song (~50, tiny) + cached `musicList` |
| pool membership built by | LCDXNetApi itself → also fixes RC4 (the ±1 tie-break difference) | the main site → RC4's ±1 remains |
| total payload | ≈1 MB/user | ≈10 KB/user |
| notes | `userData.musicRating` arrives for free → usable as the headline number (resolves D4(B)) and as a self-check | a `song/{id}` fan-out on a shared remote host; needs a short-TTL cache to be polite |

Both must keep `rating` / `new_rating` on the main site untouched, and must not disturb
`GetUserRatingHandler` (arcade protocol).

## R3.5 D4 resolution proposed by this design

With α1 the endpoint already receives the game's own `musicRating`, so:

- headline `Rating:` renders `gameMusicRating` (authoritative — this is the number the game shows),
  keeping the existing `b35+b15=total` presentation as `Σ singleRate` for transparency;
- per-song badges and both elevation tables use the computed `singleRate`;
- records with `scored: false` render the existing "No Record"-adjacent treatment plus a count in the
  header card, so the 331-point deficit is visible rather than hidden.

## R3.6 All design decisions resolved (2026-10-10)

| id | question | answer |
| --- | --- | --- |
| D1 | baseline when the weakest slot is 0 | weakest **positive** counted entry (B35 → 299, B15 → 164) |
| D2 | upper bound | none — keep only `> base`; `ratingGrowth` retired |
| D3 | backend placement | new `LCDXNetApi` endpoint |
| D4 | payload | backend returns the final per-song rating |
| D5 | fetch strategy | **α1** — one `export` (≈1 MB) + globally cached `musicList`; LCDXNetApi builds both pools itself (this also fixes RC4) |
| D6 | endpoint shape | **single endpoint returning both pools** — `GET lcdx/rating?aimeId={extId}` |
| D7 | fallback | **no** client-side fallback to the main site's `rating`/`new_rating`; fail with `Common.OperationFailed` |
| D8 | display during the catalog gap | as in §R3.5 — headline = the game's `musicRating`, badges/tables = computed `singleRate`, unscored records marked and counted |

### Final section header (frozen)

```
poolThreshold  = floor500(max(catalog romVersion where romVersion < 90000)) - 500   // today 26500
rating(song)   = floor(scoreRate * min(ach,1005000) * offset / 1e8) + (comboStatus∈{3,4} ? 1 : 0)
                 where scoreRate = catalog details[level].levelDecimal
b35            = top 35 by rating(song) among songs with catalog romVersion <  poolThreshold
b15            = top 15 by rating(song) among songs with catalog romVersion >= poolThreshold
base(pool)     = the weakest POSITIVE rating(song) among that pool's counting slots (0 if none)
table rows     = { d ∈ [10,150] : rating_of(d, rank) > base }        // rating_of uses the same
                                                                     // formula with scoreRate = d
table headers  = 20/40/60/80/100-percentile pick over the SSS+ row's d set
cell(d, rank)  = rating_of(d, rank)
```

Everything upstream of the frontend comes from the main-site domain (`TitleOptions.RinnetHost`); the
`LCDXNetApi` endpoint forwards `export?aimeId=` and `data/musicList` (the latter cached globally) and
does all of the above server-side.

### Residual (accepted, deferred)

`12024` (`OV3RCLOCK`, SSS+ / AP) and `12023` have no chart data in the catalog, and `16066` is absent
from it, so those records resolve to "unscored". Expected numbers for aimeId `13297476` after the fix
(the recomputation in §A10 supersedes the first estimate here): `Σ b35 = 11046` (exact),
`Σ b15 = 3224`, headline `gameMusicRating = 14604`, gap **334** = `12024` (`ScoreRate 148` = 14.8 at
SSS+ with the AP bonus). Catalog repair is explicitly out of scope (user decision).

---

# Revision 4 — pre-implementation audit (2026-10-10)

Eight findings from a second pass over revisions 1-3 and the two source trees. **A1, A2 and A3 are
corrections to the frozen design**; the rest are confirmations or notes.

**A1 (correction) — the fallback pool for a song the catalog cannot resolve is the OLD pool, not the
new one.** `UserRate`'s second constructor initialises `ScoreRate = 0; SingleRate = 0; OldFlag = true`
and only overwrites them inside `if (notes != null)`. A record whose chart data is unknown therefore
lands in `RatingList` (the 35-slot old pool) with 0 points. §R2.2(b) said the opposite ("sentinel
treated as new"). Numerically irrelevant (a 0 never reaches the old top-35), but it must be faithful
because a *short* pool keeps its 0-valued members.

**A2 (correction) — ordering must mirror the game's comparator.** `UserRate.CompareTo` orders by
`SingleRate`, then by `Achievement`. Implementing `(singleRate desc, achievement desc)` matters twice:
it removes RC4's ±1 (the server's `388:2` vs the recomputed `11230:3`), and it makes an unresolved but
high-achievement record (`12024`, 100.5%) sort above the other 0-valued slots so it actually appears
in the B15 list where the UI can flag it.

**A3 (correction) — the dynamic threshold's version source is the account's `lastRomVersion`, with the
catalog max only as a fallback.** §R3.6 derived the current version from the catalog's maximum
`romVersion`. That is wrong when the server's catalog is *ahead* of the machine: the threshold would
move up and the previous minor's songs (still "new" to the running client) would be misclassified as
old. The stored rating lists were produced by the client the account last played on, so
`userData.lastRomVersion` (`"1.70.00"` → minor 70 → `20000 + 70*100` = 27000 → threshold 26500)
describes exactly the data being rendered. Final rule:

```
currentRom   = parseRom(userData.lastRomVersion)        // 20000 + minor*100
               ?? floor500(max(catalog romVersion < 90000))
poolThreshold = currentRom - 500                        // 27000 - 500 = 26500 today
```

Both inputs and the resulting threshold are returned in the payload (`lastRomVersion`,
`catalogMaxRom`, `poolThreshold`) so the classification is auditable.

**A4 (confirmation) — `export` is the only bulk source.** `ApiMaimai2PlayerDataController` exposes
per-song data only via `export` (L472), `song/{id}` (L381) and `song/{id}/{level}` (L388). α1 (one
`export` call) is therefore the only bulk fetch, as decided.

**A5 (note) — unresolved and Utage rows need no special filtering.** Utage charts (`musicId >
100000`, difficulty index ≥ 5) and songs absent from the catalog both resolve to rating 0 /
`scored: false`, which is what the game does too (`notes == null` → 0). Rows with
`achievement == 0` must be **kept**, not filtered: the offline recomputation only closes exactly at
`11046` / `3227` when they are included.

**A6 (note) — the frontend keeps its catalog usage.** Only the *rating* moves to the backend. The page
still needs `maimai2Music` for song names, the jacket id path, and the `Maimai2SongDetail` drawer, so
the `maimai2Music` preload gate and the `dbGetByKey` lookup stay. The badge level should come from the
backend's `scoreRate` (authoritative) rather than the catalog, so a stale catalog cannot mislabel a
row.

**A7 (note) — blank cells are intended.** The row set is derived from the SSS+ column, so at a lower
rank the same level can fall at or below `base`; the existing `recommendationValue` renders those as
blank, which reads as "this rank at this level is not enough".

**A8 (note, non-blocking) — the `d` grid is 10..150 step 1**, so a row label need not correspond to a
real chart constant. Optional follow-up: restrict `d` to constants present in the catalog. Not part of
this task.

**A9 (note) — no authorization scheme in `LCDXNetApi`.** `Program.cs` calls neither
`AddAuthentication` nor `AddAuthorization`, so `[Authorize]` is not usable and the existing `lcdx/*`
controllers are anonymous. The new endpoint must **not** invent an auth scheme; access control is
delegated to the main site, which runs `CheckUser(currentUser, aimeId)` on `export` and returns
`USER_NOT_FOUND` / an error envelope. That envelope (and the HTTP status) is propagated to the caller.

**A10 (correction) — an unresolvable record scores 0, and does NOT get the All-Perfect bonus.**
`UserRate.cs` declares `num4` *inside* `if (notes != null)`, so when the chart data is missing the
whole block is skipped and `SingleRate` stays at its 0 initialiser — the +1 is not applied. An
implementation that adds the bonus unconditionally turns every such row into a 1-point row, which
then becomes the pool's "weakest positive" value and destroys the elevation table's lower bound
(observed: the B15 table spanned 3.8 → 15.0 instead of 8.9 → 15.0). Fixed in
`Maimai2RatingService`: `singleRate = scored ? CalcSingleRate(...) : 0`.

With that fix the recomputation closes as follows for aimeId `13297476`:

| pool | computed | game | note |
| --- | --- | --- | --- |
| B35 | **11046** | 11046 | exact |
| B15 | 3224 | 3558 | gap **334** |
| headline | 14270 | 14604 | gap 334 |

The 334 gap is `12024` alone: under the game-faithful rule it must be `ScoreRate 148` (14.8) at
SSS+ + 1 AP → 334. (The earlier "14.7 → 331" figure came from the buggy variant that also added the
AP bonus to the two unresolvable Utage rows: 3227 + 331 also reached 3558. Both arithmetics close;
the game's own code selects the 14.8 reading.) Either way the gap is entirely inside the deferred
catalog issue, and the UI is required to surface it rather than hide it.

Elevation-table bounds with the corrected rule (`base` = weakest **positive** `singleRate` in the
pool, no upper bound):

- B35: `base` = 300 → rows 13.7 / 14.0 / 14.4 / 14.7 / 15.0
- B15: `base` = 164 → rows 8.9 / 10.4 / 12.0 / 13.5 / 15.0

Both are non-degenerate, which is the whole point of RC3.






