# Frontend Development Guidelines

> Conventions for the React port of `aqua_viewer_lcdx`. Everything here describes what the code
> **actually does today** — not an aspirational target.

---

## Stack

| Concern | Choice |
|---|---|
| Framework | React 19 (function components only, no class components) |
| Build | Vite 8 + `tsc -b` (`npm run build` = typecheck then bundle) |
| Language | TypeScript 7, `strict` + `noUnusedLocals` + `noUnusedParameters` |
| Routing | `react-router-dom` v7 (data router, see `src/router.tsx`) |
| Styling | Bootstrap 5 class names + `--bs-*` tokens rebuilt in `src/styles/globals.css`; Tailwind v4 available; `@liquefy-ui/react` is the default theme family |
| i18n | `i18next` + `react-i18next`, resources in `src/i18n/{zh,en}.json` |
| Global state | Hand-rolled `createStore` / `useStore` (`src/lib/store.ts`) — no Redux/Zustand |
| Server state | Plain `fetch` via `src/lib/api/client.ts`; `@tanstack/react-query` is mounted in `src/app.tsx` but is **not** used by feature pages |
| Tests | Playwright UI-parity suite in `tests/ui-parity/` (`npm run test:ui-parity`) |

---

## Guidelines Index

| Guide | Description |
|-------|-------------|
| [Directory Structure](./directory-structure.md) | Where pages, features, shared components and libs live |
| [Component Guidelines](./component-guidelines.md) | Function-component patterns, Bootstrap parity rule, theme-aware components |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, async load patterns, effect cleanup |
| [State Management](./state-management.md) | `createStore`, local state, permission/theme stores |
| [Quality Guidelines](./quality-guidelines.md) | Forbidden patterns, i18n rule, CSS scoping, verification steps |
| [Type Safety](./type-safety.md) | tsconfig strictness, DTO modelling, `verbatimModuleSyntax` |

---

## The one rule that matters most

This repo is a **semantic port** of an Angular application, not a rewrite. Ported LCDX screens must
keep their Bootstrap markup and 1:1 visual behaviour; only the framework mechanics change
(`@if`/`@for`/`ngModel`/pipes → React state and JSX). See
[component-guidelines.md](./component-guidelines.md) before touching any `src/features/**` page.

---

**Language**: All documentation is written in **English**. Code comments in ported LCDX files are
frequently Chinese (they carry over the upstream rationale) — that is intentional, do not translate
them.
