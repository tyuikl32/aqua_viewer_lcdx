# implement.md — Progress Tracker

## Result: COMPLETE — all R1–R4 landed, spec-verified; commit on master (not pushed)

### Changes (4 files)

| File | Change |
|---|---|
| `src/components/shell/AppShell.tsx` | grid track `'auto 1fr'` → `'auto minmax(0, 1fr)'` (R2; the sidebar-less branch already used `minmax(0, 1fr)`) |
| `src/components/shell/Toasts.tsx` | + `app-toasts` stable class; `end-0` dropped **for liquefy only** (conditional className) |
| `src/styles/theme/liquefy.css` | + `.d-lg-grid.container-xxl` panel-geometry width rule (R1); + `.app-toasts` panel-aligned right offset (R3) |
| `tests/lcdx-regression/shell-alignment.spec.ts` | **new** spec: 4 viewports × (navbar↔content, footer↔content, toast↔navbar) ±1px edge assertions |

### Debug arc (F3, honestly recorded)

| Attempt | Result |
|---|---|
| 1. unlayered `inset-inline-end` (normal) | spec FAIL — toast still viewport-pinned (off by exactly the panel inset at every width) |
| 2. `!important` on both physical `right` + logical `inset-inline-end` | spec FAIL, **identical values** — cascade-layers invert `!important` priority: the dependency's *layered* `.end-0{right:0!important}` beats unlayered `!important` regardless of specificity |
| 3. drop `end-0` for liquefy + plain `right` rule | **spec PASS** — nothing left to fight |

Attempt 2's failure with byte-identical numbers is also what ruled out the "stale orphan webServer"
theory (port 5187 verified free between runs; each run started a fresh server).

### Verification (all green)

| Check | Result |
|---|---|
| `npm run build` | ✅ green (×3, after each iteration) |
| **New spec** `shell-alignment.spec.ts` (1920/1366/1280/992) | ✅ **4/4 pass** — navbar/footer/toast edges all ±1px with the content column (run 1–2 failed ONLY on the toast line, pinpointing F3; run 3 clean, zero failure output, zero error-context artifacts) |
| `themes.spec.ts` (6 mobile tests: legacy/liquefy/animal-island × light/dark at 390px) | ✅ **6/6 pass** — R4 mobile, all three families, no layout/runtime regressions |
| `guards.spec.ts` (11) | ✅ ran clean earlier the same evening (11/11, pre-fix); the fix touches only container width/grid track/toast offset — no route/permission surface |
| accessLayout (login etc.) | unaffected by construction: the grid renders **without** `container-xxl` there, and `end-0` is only dropped for liquefy |
| i18n | untouched (no new keys, no copy) |

### Environment notes (the recurring teardown hang)

Every Playwright run tonight prints all test results and then hangs in **process teardown** (the
webServer child outlives the killed npm/npx wrapper on Windows). Workaround used for every run:
redirect output to a file and read it back — the test results are always complete in the file, SIGTERM
only costs the summary line. Port 5187 was verified free between runs (no orphan server reuse).

## Commits (master, local only — not pushed)

See the git log. One LCDX-style commit covering the fix + spec, then task archive bookkeeping.
