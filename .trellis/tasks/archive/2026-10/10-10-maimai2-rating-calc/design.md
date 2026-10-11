# maimai2 rating page — current design (authoritative)

> Scope: `src/features/mai2/Maimai2RatingPage.tsx` + `LCDXNetApi` `lcdx/rating`.
> Status: **implemented 2026-10-10** (LCDXNetApi `bcd0ac8`, aqua_viewer_lcdx `6800b49`, not pushed).
>
> The full forensic record — the live probe recipe, the reproduction, the original RC1–RC4 write-up
> and the three earlier design revisions — is archived in `root-cause.md` next to this file. This
> document is the design that was actually built; `root-cause.md` is the evidence trail.

## 1. The problem in one paragraph

The page summed the two rating lists itself with `floor(ScoreRate × achievement × offset / 1e8)` and
showed `11030 + 3216 = 14246`, while the game's own stored value for that account is `14604`. It also
rendered a single-row elevation table (`15 | 337`). Both are fixed. Three independent causes:

| id | cause | status |
| --- | --- | --- |
| RC1 | `calcRate` omitted the game's All-Perfect bonus (`+1` per AllPerfect/AllPerfectPlus chart) | fixed (backend) |
| RC2 | the RinNET catalog has empty `details` for `12023` / `12024` and no `16066` entry, so those records score 0 | **deferred** (data, out of scope) |
| RC3 | the elevation table was seeded from the account's **best** song, so only a 15.0 SSS+ survived | fixed (frontend) |
| RC4 | the server's B35 list differed from a faithful recomputation by ±1 (tie-break) | fixed (backend sorts like the game) |

## 2. Game-side truth (what the implementation mirrors)

`E:\ALL.Net\Re_SDGB\Assembly-CSharp_LC_170_org`:

```csharp
// Manager/UserDatas/UserRate.cs
int num2 = Achievement >= RatingTableID.Rate_22.GetAchive()
             ? RatingTableID.Rate_22.GetAchive() : (int)Achievement;   // cap at 100.5000%
for (int num3 = 22; num3 >= 0; num3--)
    if (((RatingTableID)num3).GetAchive() <= num2) { num = ((RatingTableID)num3).GetOffset(); break; }
if (notes != null)                       // note: num4 is INSIDE this block
{
    uint num4 = UserRating.ApBonusTable.ContainsKey(comboflagID)
                  ? UserRating.ApBonusTable[comboflagID] : 0u;          // AllPerfect(+Plus) = 1
    ScoreRate  = notes.level * 10 + notes.levelDecimal;                 // == the catalog's levelDecimal
    SingleRate = (uint)(int)((long)ScoreRate * (long)num2 * num / 100000000) + num4;
    OldFlag    = romVersion < 26500;                                    // pool split
}
// Manager/UserData.cs UpdateUserRate(): MusicRating = OldRating + NewRating
```

`DB/RatingTableIDEnum.cs` is the 23-row `(achievement, offset)` table; the frontend and the backend
both mirror it verbatim. `UserRating`: `RatingListMax = 35`, `RatingNewListMax = 15`,
`ApBonusTable = { None:0, Silver:0, Gold:0, AllPerfect:1, AllPerfectPlus:1 }`,
and `UserRate.CompareTo` orders by `SingleRate` then `Achievement`.

## 3. Data path (do not change)

`LCDXNetApi` exposes **no game tables** (`CllnetDbContext`: only cabinets / announcements / KOP /
permissions / admin tokens), and its database (`cll.net` @ `ip.am-allnet.com`) is not the game-data
store. Game data is therefore reached **through the main-site domain**
(`TitleOptions.RinnetHost`, default `https://portal.naominet.live`; `lcdxnet.am-allnet.com/api/*` is
reverse-proxied to it). Reuse `Helper/CustomHttpClient.cs`'s header overloads, as `EulaService` and
`RinnetAdminTokenService` already do. The token from `POST /lcdx/login` is accepted by the main site,
so the caller's `Authorization` is forwarded as-is.

`LCDXNetApi` has **no** authentication scheme (`Program.cs` has no `AddAuthentication`), so the
endpoint must not invent one: the main site runs `CheckUser(currentUser, aimeId)` on `export`, and
its error envelope is propagated unchanged.

## 4. Endpoint contract (implemented)

`GET lcdx/rating?aimeId={extId}` → `ApiResponse<Maimai2RatingPoolDto>`:

```jsonc
{
  "status": { "code": 92001, "message": "OK" },
  "data": {
    "poolThreshold": 26500,          // dynamic, see §5
    "currentRomVersion": 27000,
    "lastRomVersion": "1.70.00",
    "catalogMaxRomVersion": 27000,
    "gameMusicRating": 14604,        // the game's own total, for the headline
    "gameOldRating": 11046,
    "gameNewRating": 3558,
    "b35": [ { "musicId": 11394, "level": 3, "romVersion": 22513, "achievement": 1010000,
               "scoreRate": 149, "comboStatus": 4, "singleRate": 336, "scored": true }, … ],
    "b15": [ … ]
  }
}
```

Upstream calls per request: **one** `export?aimeId=` (≈1 MB; carries `userData` **and** all
`userMusicDetailList` rows with `comboStatus`), plus `data/musicList` from a process-wide cache
(static game data, 1 h TTL, stale-on-failure). `export` is the only bulk source — the main site
exposes per-song data only via `export`, `song/{id}` and `song/{id}/{level}`.

## 5. Algorithm (implemented)

```
rating(record) = floor(scoreRate * min(achievement, 1005000) * offset / 100000000)
                 + (comboStatus is AllPerfect or AllPerfectPlus ? 1 : 0)   -- only when the constant resolves
scoreRate      = catalog details[level].levelDecimal      (unresolvable -> scored=false, rating 0)

currentRom     = parseRom(userData.lastRomVersion)        -- "1.70.00" -> 20000 + 70*100 = 27000
                 ?? floor500(max catalog romVersion < 90000)
poolThreshold  = currentRom - 500                         -- current minor + previous minor
isNew(record)  = catalog romVersion >= poolThreshold      -- unknown romVersion => old pool
b35            = top 35 of the old pool,  ordered by (singleRate desc, achievement desc)
b15            = top 15 of the new pool,  same ordering
```

Elevation table, computed per pool **in the page** (it needs the 23-row grid anyway):

```
base        = the pool's weakest POSITIVE singleRate (0 if none)
rows[rank]  = { d in [10,150] : floor(d * rankThreshold * offset / 1e8) > base }   -- no upper bound
headers     = 20/40/60/80/100-percentile pick over the SSS+ row's d set
cell(d,r)   = rows[r][d], blank when absent
rendered as two tables behind a BEST35/BEST15 toggle
```

`getRatingGrowth` and the `base + growth` upper band are retired: that band was what collapsed the
table.

### Binding corrections found by the pre-implementation audit (`root-cause.md` §Revision 4)

- **A1** An unresolvable record belongs to the **old** pool (`UserRate` leaves `OldFlag = true` when
  `notes == null`), not the new one.
- **A2** Order by `singleRate` **then `achievement`** — this is what also removes RC4's ±1.
- **A3** The threshold's version source is the **account's** `lastRomVersion`, not the catalog
  maximum: a catalog ahead of the running client would otherwise reclassify the previous minor's
  songs as old. The catalog maximum is only a fallback.
- **A5** Rows with `achievement == 0` must be **kept** (the recomputation only closes exactly with
  them), and Utage rows (difficulty index ≥ 5) need no special filtering.
- **A6** The page keeps its `maimai2Music` catalog usage for names / jackets / the detail drawer; only
  the *rating* moved to the backend, and the level badge uses the backend's `scoreRate`.
- **A10** An unresolvable record scores **0 without** the All-Perfect bonus (`num4` lives inside
  `if (notes != null)`). Adding it unconditionally turns such rows into 1-point rows, which then
  become the pool's "weakest positive" value and destroy the table's lower bound. Caught by the
  offline recomputation before it reached a commit.

## 6. Expected numbers and the accepted residual

Account `13297476`, after the fix:

| pool | value | game | note |
| --- | --- | --- | --- |
| B35 | **11046** | `playerOldRating` 11046 | exact — the AP term is what makes it exact |
| B15 | 3224 | `playerNewRating` 3558 | gap **334** |
| headline | 14604 | `musicRating` 14604 | the game's own number is what the page displays |

The 334 gap is entirely `12024` (`OV3RCLOCK`): under the game-faithful rule it must be
`ScoreRate 148` (14.8) at SSS+ plus the AP bonus. Its catalog entry has `details: {}`, so the backend
cannot score it and marks it `scored: false`. Three such records exist (`110364`, `111358`, `12024`).
The UI reports the count and the point gap in the header card instead of silently rendering `0`.

Elevation table for the same account: **B35** rows 13.7 / 14.0 / 14.4 / 14.7 / 15.0 (`base` 300),
**B15** rows 8.9 / 10.4 / 12.0 / 13.5 / 15.0 (`base` 164). Both non-degenerate — which is the point.

**Deferred (user decision):** catalog repair for `12023` / `12024` / `16066`. No client-side
hardcoded constant table as a workaround.

## 7. Known small debts (left alone on purpose)

- The `Rating:` label in the header card is still hard-coded (pre-existing, upstream parity).
- The elevation table's row grid is a synthetic `d` in 10..150 step 1, so a row label need not be a
  chart constant that actually exists. Filtering `d` by the catalog's real constants is an optional
  follow-up.
- Row labels render as `15` rather than `15.0` (the `header / 10` arithmetic is inherited from the
  original page). Cosmetic.

## 8. What the local run found (2026-10-10, after the first commit)

Running the endpoint against the live account on a local machine — rather than against the captured
JSON — caught a defect that no offline recomputation could have: **the main site requires
authentication on `api/game/maimai2/data/musicList`** (401 without a token), and the catalog cache,
being a global singleton, sent no `Authorization` header. Every request failed with
`95001 Failed to load the game catalog`. Fixed by threading the caller's token into the cache fetch
(the catalog itself is user-independent, so the result stays globally cached).

Two further weaknesses found in the same pass and fixed:

- `ParseRomVersion` accepted any minor in 0..99, so a malformed `"1.7.00"` would have parsed as
  `20700` and pushed every song into the new pool. It now requires a multiple of 5, and when neither
  the account version nor the catalog yields a plausible value the request **fails** instead of
  splitting pools on a bogus threshold.
- A non-2xx `export` response discarded its body, so the caller lost the main site's error. The body
  is now parsed for error responses too, with the HTTP status in the fallback message.

### Local-run recipe (for the next session)

`npm run dev` alone does **not** work for this fork: its `/api` proxy targets
`http://aqua.naominet.live`, which rejects a token minted by `/lcdx/login` (HTTP 401 →
`restoreAccess` clears the session → the app bounces back to `/sign-in`). To exercise the page
locally, run the **production same-origin shape** instead:

1. `npm run build` (or reuse `dist/`);
2. serve `dist/` from a throwaway static server that proxies `/api/*` → `https://portal.naominet.live`
   and `/lcdx/*` → the local `LCDXNetApi` (this also sidesteps CORS, self-signed certs and mixed
   content); the server used for the verification lives in `.artifacts/local-server.mjs`
   (`.artifacts/` is gitignored);
3. start `LCDXNetApi` with `dotnet run --no-build --urls http://localhost:5104` (PowerShell, never
   Bash) — `.env.development.local` (gitignored) points the dev `lcdx` client at that port.

Verified end to end with account `13297476`: login → `/mai2/rating` shows `11046+3224=14604`, the
unscored warning, the BEST35 table (13.7 → 15.0), and after the toggle the BEST15 table
(8.9 → 15.0); 50 score cards, 3 unscored markers, no console errors and no failed requests.
