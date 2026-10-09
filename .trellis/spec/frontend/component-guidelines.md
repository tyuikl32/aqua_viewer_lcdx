# Component Guidelines

> How components are built in this project.

---

## Overview

React 19, **function components only** — no class components, no legacy lifecycle methods. Every
component is a named export (`export function Pagination(...)`); only `src/app.tsx` and
`src/main.tsx` default-export.

There are three kinds of components, and they follow different rules:

| Kind | Location | Rule |
|---|---|---|
| Ported LCDX screen | `src/pages/**`, `src/features/**` | **Bootstrap parity first** — keep the legacy markup and class names |
| Theme-aware shared widget | `src/components/shared/**`, `src/components/shell/**` | Branch on the theme family, render one implementation per family |
| shadcn/ui primitive | `src/components/ui/**` | Vendored; extend by composition, do not edit in place |

---

## The Bootstrap parity rule (the one that matters most)

Upstream deliberately kept Bootstrap 5.3.3 as a dependency and rebuilt the `--bs-*` custom
properties as theme tokens in `src/styles/globals.css`. Consequence: **legacy Angular templates
translate almost 1:1 into JSX.**

- Keep `card`, `row`/`col-*`, `form-select`, `form-control`, `btn btn-*`, `badge text-bg-*`,
  `page-heading`, `table`, `text-body-secondary`, … exactly as they appear in the legacy template.
- Do **not** rewrite a ported LCDX page into shadcn/Tailwind. A Tailwind rewrite of `Maimai2LocksPage`
  would silently drop the `--bs-*` styling and break visual parity with the legacy build.
- Only the framework mechanics change:

| Angular | React |
|---|---|
| `@if (cond) { … }` | `{cond && …}` / ternary |
| `@for (x of xs; track x.id)` | `{xs.map((x) => <… key={x.id} />)}` |
| `[(ngModel)]="value"` | `value={value} onChange={(e) => setValue(e.target.value)}` |
| `(click)="doIt()"` | `onClick={() => doIt()}` |
| `{{ x \| date:'yyyy-MM-dd HH:mm' }}` | a formatter from `src/features/mai2/cabinet-models.ts` |
| `[class.foo]="cond"` | `className={'foo' + (cond ? ' active' : '')}` |

Class-name strings are frequently assembled with `+` concatenation rather than a `classnames`
helper — that is the established style in the ported pages; stay consistent within a file.

---

## Component Structure

Ported pages follow this shape (see `src/features/mai2/Maimai2CabinetsPage.tsx`):

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lcdx } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { isOk } from '@/lib/models';
import type { CabinetInfo } from './cabinet-models';

/** 等价旧版 maimai2-cabinets（页① 机台管理，设计 §8） */
export function Maimai2CabinetsPage() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<CabinetInfo | null>(null);

  const loadInfo = useCallback(async (nick: string) => { /* … */ }, []);

  useEffect(() => {
    void loadInfo(nick);
  }, [nick, loadInfo]);

  return ( /* Bootstrap markup */ );
}
```

Notes:

- The `等价旧版 <component>` JSDoc line is the house style for ported screens — keep writing it.
- Local `useState` per data slice, one `loadX` callback per endpoint. No reducer/context unless the
  page genuinely shares state across a subtree.
- Stale-closure guard: when an interval or event listener reads a state value, mirror it into a ref
  updated on every render (`selectedNickRef.current = selectedNick`) — see `Maimai2CabinetsPage`.
- Async effects that set state after unmount guard with an `active` flag (`if (active) notice(...)`)
  — see `Maimai2CirclePage`.

---

## Props Conventions

Props are typed **inline in the destructuring parameter**, not via a separate `Props` interface:

```tsx
export function Pagination({
  current,
  pageSize,
  totalItems,
  onPageChange,
  size = 'sm',
}: {
  current: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  size?: 'sm' | 'md';
}) { … }
```

- Optional props get defaults in the destructuring list.
- Callbacks are named `onXxx` (`onPageChange`, `onClose`).
- Children are typed `ReactNode` (or `ReactElement` when a single element is required).
- `BModal` accepts `open`, `onClose`, `title`, `children`, `scrollable`, `wide` — reuse it instead of
  hand-rolling a modal.

---

## Theme-Aware Components

Theme is a first-class input, not a global stylesheet. A shared widget reads
`const { family } = useTheme()` (or `useTheme()` for the full snapshot) and returns a different
implementation per family, falling back to the Bootstrap/shadcn markup:

```tsx
const { family } = useTheme();

if (family === 'liquefy')      return <LiquidPagination … />;
if (family === 'animal-island') return <AnimalPagination … />;
return <ul className="pagination pagination-sm …">…</ul>;   // default
```

Exemplars: `src/components/shared/Pagination.tsx`, `src/components/shared/BModal.tsx`,
`src/components/shell/ConfirmDialog.tsx`.

Rules:

- `liquefy` is the default family (`src/lib/theme.ts` → `DEFAULT_FAMILY`). Verify new shared widgets
  under Liquefy first; it is what most users see.
- Never branch on the family to change *behaviour*, only presentation. Data fetching, permissions
  and API calls must be identical across themes.
- Imperative helpers that mount outside the React tree (the `confirm()` in `ConfirmDialog.tsx`)
  must re-wrap their output in `<LiquefyProvider>` themselves — they do not inherit `app.tsx`'s
  provider because they render into a detached container.

---

## Styling Patterns

- **Global CSS, not CSS modules.** Vite injects `XxxPage.css` into the document, so there is no
  Angular-style view encapsulation. Every new rule must be scoped by a page-specific class or
  ancestor, or it will leak into unrelated pages.
- Import page CSS from the page module: `import './Maimai2LocksPage.css';`
- Shared page styles live in `src/pages/pages-common.css`; theme tokens in `src/styles/theme/*`.
- Tailwind v4 is available and used by `src/components/ui/**`; ported LCDX pages stay on Bootstrap
  classes. Do not mix the two in one ported page.
- Bootstrap class names are also used as behaviour hooks by tests and by `bootstrap-compat.css` —
  renaming one is a breaking change.

---

## Accessibility

- Dialogs/overlays go through `BModal` / `ConfirmDialog` / `src/components/ui/dialog.tsx` so focus
  trapping and `Esc` handling come for free. Do not hand-roll a fixed-position overlay.
- Interactive non-button elements keep an accessible name: icon-only buttons get `aria-label`
  (see the `btn-close` in `BModal`).
- Form inputs that are not label-wrapped carry `aria-label` in addition to any `placeholder`.
- Keep the legacy `aria-expanded` markers on shell dropdowns — `useMobileLiquidFooter` reads
  `[aria-expanded="true"]` to detect an open menu.

---

## i18n

- Render-time text: `const { t } = useTranslation();` then `{t('Maimai2.KopPage.Title')}`.
- Async callbacks (`.then`, event handlers defined outside render) must **not** capture `t` from a
  stale render when the language can change — use the imperative `translate()` from `@/lib/i18n`
  (`notice(translate('Common.OperationFailed'))`).
- Adding copy means adding the key to **both** `src/i18n/{zh,en}.json` **and**
  `public/assets/i18n/{zh,en}.json`, with zh/en key sets matching exactly.
- Never render a backend `status.message` or `String(error)` to the user — see
  [quality-guidelines.md](./quality-guidelines.md).

---

## Common Mistakes

- Rewriting a ported LCDX page in Tailwind/shadcn "because it's cleaner" — destroys visual parity.
- Adding a global `th { … }` / `td { … }` rule in a page stylesheet — with no view encapsulation this
  restyles every table in the app (the legacy `public.ranking.scss` did exactly this; the KOP port
  scopes those rules under `.kop-ranking-page`).
- Capturing `t` inside a long-lived interval or event listener instead of using `translate()`.
- Mounting a theme-aware widget outside the React tree without re-wrapping it in
  `<LiquefyProvider>`.
- Reading state inside a `setInterval` closure without the ref mirror → the timer keeps the value
  from the render that created it.
