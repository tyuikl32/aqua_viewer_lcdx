# Add CiRCLE+ and MAGiCAL to the maimai2 songlist version filter

## Goal

`src/features/mai2/Maimai2SongListPage.tsx` renders the "version" checkbox list from the hardcoded
`VERSIONS` array (lines 25–52). It currently ends at `CiRCLE` (index 25), so the two newest
maimai DX versions have no filter entry: songs whose `addVersion` is 26 / 27 appear in the list but
can never be selected by version. Append the two missing entries.

## Context

- The array index **is** the `addVersion` value — line 114 `VERSIONS.map((_, index) => index)`,
  line 119 `versionIds.includes(song.addVersion)`. Appending at the tail therefore maps to 26 and 27
  with no renumbering and no edit anywhere else.
- `addVersion` comes from the game catalog data (RinNET main site, preloaded into IndexedDB
  `maimai2Music`), not from any repo in this workspace. This change only restores the ability to
  *filter* by those versions; it does not create any catalog data.
- This file is fork-local: upstream `backup` stops at `PRiSM` (23); the fork already appended
  `PRiSM+` (24) and `CiRCLE` (25), so this is a continuation of an established pattern.

## Requirements

- R1 Append `'CiRCLE+'` and `'MAGiCAL'` to the end of the `VERSIONS` array, after `'CiRCLE'`, so they
  take indices 26 and 27.
- R2 Change nothing else: no reordering/renaming of existing entries, no edit to the filter logic,
  the JSX, i18n, or any other file.
- R3 Label form follows the array's existing short style (`Splash+`, `PRiSM+`) → `'CiRCLE+'`;
  `'MAGiCAL'` is used verbatim. (Decision confirmed by the user, 2026-10-10.)

## Acceptance Criteria

- [ ] `VERSIONS.length === 28`; `VERSIONS[26] === 'CiRCLE+'`; `VERSIONS[27] === 'MAGiCAL'`.
- [ ] `git diff` touches only the `VERSIONS` array (2 inserted lines, 0 deletions).
- [ ] Every entry stays unique (the JSX uses `key={version}`, so a duplicate would be a React warning).
- [ ] `npm run build` (`tsc -b && vite build`) exits 0.

## Out of scope

- i18n: the version labels in this array are game-native proper nouns and are intentionally literal
  (see `.trellis/spec/frontend/quality-guidelines.md` → Known Debt, "Intentionally NOT i18n
  candidates"). No new keys, no JSON edits.
- The ChuniV2 / Ongeki songlist pages — frozen, must stay aligned with upstream.
- The catalog data source / RinNET main site, and the `addVersion` numbering itself.

## Outcome (2026-10-10)

Appended `'CiRCLE+'` and `'MAGiCAL'` to `VERSIONS` in `src/features/mai2/Maimai2SongListPage.tsx`
(directly after `'CiRCLE'`), giving indices 26 and 27. Diff is exactly +2 / -0, one file.

Verified: `VERSIONS.length === 28`; `VERSIONS[26] === 'CiRCLE+'`; `VERSIONS[27] === 'MAGiCAL'`; all
28 entries unique; `npm run build` (`tsc -b && vite build`) exit 0 → `✓ built in 5.42s`.

Spec: added "Game-data option lists are index-mapped — append, never reorder" to
`.trellis/spec/frontend/quality-guidelines.md`.
