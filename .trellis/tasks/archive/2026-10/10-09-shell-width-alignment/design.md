# Design — Shell width alignment (Liquefy panels vs content column & toast)

Parent PRD: `prd.md` (root cause already verified there — two unrelated width systems + viewport-pinned toast).

## Fix strategy

All geometry fixes are **Liquefy-scoped** (`[data-theme='liquefy']`, the file's established convention —
"Every rule is rooted at the Liquefy family so the legacy presentation remains byte-for-byte
independent"), **except** the grid hardening which is theme-neutral by design.

### F1 — Content column adopts the panel geometry (R1)

Target: the shell grid container — the **only** element carrying `d-lg-grid container-xxl`
(`AppShell.tsx:369`; verified: `d-lg-grid` appears nowhere else in `src/`). The navbar's inner
`container-xxl` (`AppShell.tsx:327`) and the footer's (`AppShell.tsx:206`) do **not** carry `d-lg-grid`
and are untouched. `accessLayout` routes render the grid **without** `container-xxl`, so login pages
are unaffected by construction.

```css
/* 与 .app-navbar/.footer 面板同一几何：宽 = min(100% - 1.2rem, 1320px)，水平居中。
   bootstrap container-xxl 本身已 margin-inline:auto，只需接管宽度。 */
[data-theme='liquefy'] .d-lg-grid.container-xxl {
  width: min(calc(100% - 1.2rem), 1320px);
}
```

Why this expression: the panels compute to `min(100vw − 1.2rem, 1320px)` centered
(`left/right: 0.6rem` + `width:auto` + `max-width:1320px` + `margin-inline:auto`). The static
container cannot use `left/right` (it is in flow), but `width: min(calc(100% − 1.2rem), 1320px)` +
bootstrap's existing `margin-inline: auto` yields the **same number at every viewport width** —
≥1400px unchanged (1320px, already aligned today), 992–1400px now inset to the panel edges
(closing the 0.6rem/side defect), <992px aligned with the mobile panels (which are also inset 0.6rem).
Specificity (0,3,0) beats bootstrap's `.container-xxl` (0,1,0) inside its media queries; no
`!important` needed (no utility fights `width` here — the panel rules need it only against
`.navbar`'s own width rules).

### F2 — Grid track hardening (R2, theme-neutral)

`AppShell.tsx:372`: the sidebar branch `'auto 1fr'` → `'auto minmax(0, 1fr)'` — identical to the
sidebar-less branch one line below (which already uses `minmax(0, 1fr)`). Removes the implicit
`minmax(auto, 1fr)` minimum so unbreakable page content (wide tables) can no longer stretch the grid
past the container.

### F3 — Toast overlay anchored to the panel edge (R3)

`Toasts.tsx`: add the (verified unoccupied) stable class `app-toasts` to the overlay container, and
**drop the `end-0` utility for the liquefy family only** (conditional className — the established
pattern in this file, cf. the per-family `marginTop`). Then a plain rule in liquefy.css:

```css
/* 面板右缘 = 视口右缘内缩 max(0.6rem, (100vw - 1320px)/2)；toast 容器贴齐同一位置。
   容器自带 p-3，toast 视觉体再内让 12px，与面板自身内边距一致。 */
[data-theme='liquefy'] .app-toasts {
  right: max(0.6rem, calc((100vw - 1320px) / 2));
}
```

**Why the conditional `end-0` removal is required** (learned through two failed CSS-only attempts,
both caught by the new regression spec):

1. The bundle emits `end-0` **twice**: a dependency stylesheet outputs a physical
   `.end-0{right:0!important}` **inside a `@layer`**, alongside Tailwind's regular logical
   `inset-inline-end` utility.
2. Attempt 1 (unlayered `inset-inline-end` normal) lost to it. Attempt 2 (unlayered `!important` on
   both physical+logical) **also lost**: per CSS cascade-layers, `!important` priority is inverted —
   a *layered* `!important` beats an *unlayered* `!important` regardless of specificity.
3. Removing `end-0` from the element for liquefy sidesteps the battle entirely — the rule applies
   at normal priority with nothing to fight. Other families keep `end-0` (viewport edge) exactly as
   today. Mobile: at <992px the expression floors at 0.6rem, consistent with the liquefy toast width
   `w-[min(34rem,calc(100vw-1.2rem))]` already assuming a 1.2rem total horizontal inset.

## Verification design — new regression spec (deterministic geometry assertions)

New file `tests/lcdx-regression/shell-alignment.spec.ts` using the existing offline fixture
(`setup(page, 4)` → login → `/mai2/cabmode`, exactly the guards spec's navigation):

For each viewport width **1920 / 1366 / 1280 / 992**:

1. `navbar.right ≈ grid.right` and `navbar.left ≈ grid.left` (±1px) — the R1 contract.
2. `footer.right ≈ grid.right` (±1px).
3. `app-toasts.right ≈ navbar.right` (±1px) — the R3 contract (the overlay container is rendered even
   with zero toasts; its border-box right edge is `viewport − inset-inline-end`).
4. Panels never narrower than content: `grid.width ≥ navbar.width` is implied by (1)+(2) edge equality.

R2 (grid overflow) cannot be reproduced offline — the fixture has no wide-table data; it is carried by
code parity with the sidebar-less branch (same `minmax(0, 1fr)` the app already uses there).

## Files touched

| File | Change |
|---|---|
| `src/components/shell/AppShell.tsx` | one token: `'auto 1fr'` → `'auto minmax(0, 1fr)'` |
| `src/components/shell/Toasts.tsx` | add `app-toasts` class |
| `src/styles/theme/liquefy.css` | two rules after the `.footer` panel rule |
| `tests/lcdx-regression/shell-alignment.spec.ts` | new spec |

No i18n, no router, no page components — shell-only (chuni/ongeki frozen pages untouched per PRD).
