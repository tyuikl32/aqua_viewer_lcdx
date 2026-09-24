# Directory Structure

> How the React frontend in `aqua_viewer_lcdx` is organized.

---

## Overview

The app is a **semantic port** of the legacy Angular portal: routes, screens and API contracts are
kept 1:1, only the framework mechanics changed. When you need to add or move something, mirror the
placement of the existing equivalent rather than inventing a new layer.

Two orthogonal axes decide where a file goes:

1. **Who owns the route** — app-level screens live in `src/pages/`, game-scoped screens in
   `src/features/<game>/`.
2. **Is it framework-free logic or UI** — reusable non-UI logic lives in `src/lib/`, components in
   `src/components/`.

---

## Directory Layout

```
aqua_viewer_lcdx/
├── index.html                     # document shell (title, favicon, theme-color)
├── vite.config.ts                 # vite + react + tailwind + PWA manifest/workbox
├── tsconfig.json                  # project references → app / node
├── playwright.parity.config.ts    # UI-parity suite config
├── .env / .env.development        # VITE_LCDX_API_SERVER, VITE_MAI_ASSETS_HOST
├── scripts/                       # gen-cert.mjs, add-hosts.ps1, serve-legacy-baseline.mjs
├── src/
│   ├── main.tsx                   # createRoot, installTheme(), impersonation bootstrap
│   ├── app.tsx                    # providers + one-shot startup (restoreAccess/loadUser)
│   ├── router.tsx                 # createBrowserRouter table + guards
│   ├── pages/                     # app-level screens
│   │   ├── auth/                  # SignIn / SignUp / PasswordReset / OauthCallback / OnetimeSignIn
│   │   ├── DashboardPage.tsx, AdminPage.tsx, AnnouncementsPage.tsx, …
│   │   └── pages-common.css       # shared page styles imported by several pages
│   ├── features/                  # game-scoped screens, one folder per game
│   │   ├── mai2/                  # 13+ pages, DTO modules, per-page CSS
│   │   ├── chuni/
│   │   └── ongeki/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui primitives (Radix-based; treat as generated)
│   │   ├── shared/                # cross-feature widgets (Pagination, BModal)
│   │   ├── shell/                 # AppShell, Toasts, LoadingBar, ConfirmDialog + shell hooks
│   │   └── theme/                 # ThemeMenu
│   ├── lib/                       # framework-free logic — the old Angular services
│   │   ├── api/client.ts          # `api` + `lcdx` fetch clients
│   │   ├── auth/                  # account, access, auth, oauth, webauthn, impersonation
│   │   ├── db/                    # IndexedDB (Aqua v6) access + preload
│   │   ├── store.ts               # createStore / useStore
│   │   ├── i18n.ts, message.ts, menu.ts, nav.ts, theme.ts, theme-catalog.ts,
│   │   │   user.ts, utils.ts, format.ts, models.ts, botPermission.ts, supportedBrowsers.ts
│   ├── i18n/{zh,en}.json          # bundled i18n resources (authoritative)
│   └── styles/
│       ├── globals.css            # entry; rebuilds the --bs-* tokens
│       ├── bootstrap-compat.css
│       └── theme/                 # contract.css, liquefy.css, animal-island.css, adapters
├── public/
│   ├── assets/i18n/{zh,en}.json   # static copy of the same resources (PWA)
│   └── assets/…                   # laochan.svg, icons/, …
├── tests/ui-parity/               # Playwright screenshot/behaviour parity specs
└── .trellis/                      # task + spec docs (not shipped)
```

---

## Module Organization

### `src/pages/` — app-level screens

Owned by the shell/router. Anything reachable from the top-level navigation and not tied to a single
game belongs here. Files are `XxxPage.tsx` with an optional sibling `XxxPage.css`.

### `src/features/<game>/` — game-scoped screens

`mai2`, `chuni`, `ongeki`. A feature folder is self-contained: pages, its DTO/type modules, and its
CSS all live together. Cross-feature imports are a smell — promote the shared piece to
`src/components/shared/` or `src/lib/` instead.

Within a feature folder the naming convention is:

| Kind | Pattern | Example |
|---|---|---|
| Page component | `<Game>XxxPage.tsx` | `Maimai2LocksPage.tsx`, `ChuniV2RecentPage.tsx`, `OngekiRatingPage.tsx` |
| Shared DTO module | `<area>-models.ts` | `cabinet-models.ts`, `song-models.ts`, `server-mission-models.ts` |
| Page CSS | `<Page>.css` | `Maimai2LocksPage.css` |
| Feature-local helper | `<area>.ts` | `pipes.ts`, `new-rating.ts`, `card-pick-position.ts` |

The `<Game>` prefix is the legacy route namespace (`Maimai2*`, `ChuniV2*`, `Ongeki*`) — keep it, the
`src/router.tsx` imports and the parity specs both rely on it.

### `src/lib/` — the old Angular services

Every module here is plain TypeScript with no JSX. Files that used to be Angular services keep a
`等价旧版 xxx` header comment naming the legacy counterpart. Put reusable, testable, framework-free
logic here; do not import React components from `src/lib/`.

### `src/components/`

- `ui/` — shadcn/ui primitives. Treat as vendored: extend by composition, not by editing in place.
- `shared/` — genuinely reusable widgets consumed by more than one feature (e.g. `Pagination`).
- `shell/` — chrome around every route: sidebar/topbar/footer, toast host, loading bar, confirm
  dialog. Hooks that exist only to drive the shell live here too (e.g. `useMobileLiquidFooter.ts`).

---

## Naming Conventions

- Components: `PascalCase.tsx`, one exported component per file, named export (`export function
  Pagination(...)`). `src/app.tsx` and `src/main.tsx` are the only default exports.
- Hooks: `useThing.ts` / `useThing` inside a component file when private to it.
- Stores: `<concern>Store` (`userStore`, `toastStore`, `botPermissionStore`) — never a raw
  `createStore` call inside a component.
- CSS: kebab-case class names, prefixed by the owning screen (`cab-mode-*`, `kop-ranking-page`) to
  avoid collisions — see [quality-guidelines.md](./quality-guidelines.md).
- Path alias: always import through `@/` (`@/lib/message`, `@/components/ui/button`), never a long
  `../../..` chain. Relative imports are reserved for siblings inside the same folder.

---

## Examples

- Feature folder with page + DTO module + CSS: `src/features/mai2/` (`cabinet-models.ts`,
  `Maimai2LocksPage.tsx` / `.css`).
- `src/lib/` service-style module: `src/lib/botPermission.ts` (store + probes + pure filters).
- Shell-owned component with a dedicated hook: `src/components/shell/AppShell.tsx` +
  `useMobileLiquidFooter.ts`.
