# Shell width alignment: content container and toast overlay do not follow the Liquefy navbar/footer panel geometry

## Goal

The top navbar, the bottom footer and the main content column must share one width rule, and the
toast overlay must align with the navbar's right edge, so that at any window size the three zones
line up instead of flipping their width relationship between maximized and windowed states.

## Symptoms (reported 2026-10-09)

1. **Width relationship flips with window state**
   - Browser maximized: the navbar/footer panels are wider than the visible content column.
   - Browser windowed: the content column becomes wider than the navbar/footer panels.
   - Expectation: at minimum the panel edges must align with the content column edges (the panels
     may never be narrower than the content's outer margin).
2. **Login toast is aligned to the viewport, not to the shell**
   - After signing in, the toast appears pinned to the right edge of the *browser window*, clearly
     outside the navbar/footer panel edges (no alignment with either bar).

## Root cause (verified by code reading)

The React port switched the **default theme family** from the legacy full-width shell to
**Liquefy** (`src/lib/theme.ts`: `DEFAULT_FAMILY = 'liquefy'`). Liquefy reshapes the shell into
floating rounded panels, but two shell surfaces were ported verbatim from the legacy geometry and
were never re-anchored:

### 1. Content container vs panel width — two unrelated width systems

- **Navbar / footer (Liquefy)** — `src/styles/theme/liquefy.css`:
  - `.app-navbar`: `position: fixed; left/right: 0.6rem; width: auto; max-width: 1320px; margin-inline: auto`
  - `.footer`: `position: fixed; left/right: 0.6rem; max-width: 1320px; margin: 0 auto`
  - Result: panel width = `min(100vw − 1.2rem, 1320px)`, centered.
- **Content column** — `src/components/shell/AppShell.tsx` (~line 369): the page grid is a plain
  Bootstrap `.container-xxl` (bootstrap 5.3.3: `width: 100%` below 1400px, `max-width: 1320px`
  centered at ≥1400px). It has **no 0.6rem inset**.
- Consequences per window state (viewport width `W`, with sidebar mounted):
  - `W ≥ 1400px` (maximized): panel = content = 1320px centered — outer edges align, but the page
    content inside `<main>` is further indented by the sidebar (min 15rem + margins) plus
    `ms-lg-3/me-lg-2`, so the panels *look* wider than the content. (Accepted by the user.)
  - `992px ≤ W < 1400px` (windowed): content = `100%` edge-to-edge while the panels stay inset by
    0.6rem on both sides → **content is 1.2rem wider than the panels, permanently misaligned by
    0.6rem per side**. This is the defect — no breakpoint below 1400px aligns them.
- Contributing defect (same grid): with the sidebar mounted the grid columns are
  `gridTemplateColumns: 'auto 1fr'`. A `1fr` track has an implicit `minmax(auto, 1fr)` minimum, and
  `<main>` has no `min-width: 0`, so any page content with an unbreakable min width (tables, card
  rows) stretches the grid track beyond the container and overflows horizontally, which makes the
  content visually poke out past the panels. The sidebar-less branch already uses
  `minmax(0, 1fr)`; the sidebar branch does not.

### 2. Toast overlay anchored to the viewport, not to the panel

- `src/components/shell/Toasts.tsx` (~line 86): container class
  `pointer-events-none fixed end-0 top-0 z-[1200] flex flex-col gap-2 p-3` — a faithful port of
  the legacy Angular host (`position-fixed top-0 end-0 p-3`, `toasts-container.component.ts`).
- In the legacy shell the navbar was full-width (`w-100`, edge-to-edge), so a viewport-pinned
  toast visually sat next to the navbar's right edge — no visible misalignment.
- In Liquefy the navbar is a centered `min(W − 1.2rem, 1320px)` panel: at 1920px its right edge is
  ~300px away from the viewport edge, while the toast stays 12px (`p-3`) from the viewport edge →
  the toast floats far outside the panel edge. Windowed (1280px) the gap narrows to ~2.4px but
  still never matches.
- The vertical offsets in `Toasts.tsx` (3.6/4.35/4.75rem) were already theme-adjusted, which
  confirms the horizontal anchor is simply the one axis that was missed.

## Requirements

- R1 One width contract: the content column's outer edges must coincide with the navbar/footer
  panel edges at every desktop width (≥992px), for the Liquefy default theme. The legacy and
  animal-island families must keep their current behavior (full-width / their own geometry).
- R2 Grid hardening: with the sidebar mounted, page content must never stretch the grid beyond
  the container (switch the `1fr` track to `minmax(0, 1fr)` or equivalent).
- R3 The toast overlay's right edge must align with the navbar panel's right edge (Liquefy);
  other families keep their current anchoring.
- R4 No regressions for `accessLayout` routes (login/registration render without navbar/footer)
  and for the mobile (<992px) shell, including the liquid footer compact/expanded states.

## Out of scope

- Changing the default theme family or the Liquefy panel design itself (inset, radius, max-width
  values are design decisions, not defects).
- Chuni/Ongeki pages (frozen per 2026-09-29 directive); the fix lands in the shared shell only.

## Verification plan (draft — to be finalized with the user)

- Run `npm run dev`, sign in, and compare the left/right edges of navbar, footer, content column
  and toast at viewport widths 1920, 1366, 1280, 992 (browser devtools responsive mode).
- Check a wide-table page (e.g. a song list) for horizontal overflow at 1280px with the sidebar
  mounted.
- Re-run the existing `test:lcdx-regression` suite after implementation.
