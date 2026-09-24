# Type Safety

> Type safety patterns in this project.

---

## Overview

TypeScript 7 in `strict` mode, compiled by `tsc -b` as part of `npm run build`. Two projects:

| Config | Scope | Target |
|---|---|---|
| `tsconfig.app.json` | `src` | ES2022 + DOM, `jsx: react-jsx` |
| `tsconfig.node.json` | `vite.config.ts`, `scripts/` | ES2023, node |

Both enable, beyond `strict`:

- `noUnusedLocals` / `noUnusedParameters` — an unused import, local or catch parameter **fails the
  build**. Write `catch { … }` (no binding) when the error object is unused.
- `noFallthroughCasesInSwitch`
- `noUncheckedSideEffectImports`
- `verbatimModuleSyntax` — type-only imports **must** use `import type`, and re-exported types must
  use `export type { … } from '…'`. Mixing a type into a value import is a compile error.

There is **no runtime validation library** (no Zod / Yup / io-ts). Backend payloads are trusted and
modelled by hand.

---

## Type Organization

| Kind | Location |
|---|---|
| Shared portal models (`User`, `Card`, `StatusCode`, `ApiResponse`) | `src/lib/models.ts` |
| LCDX permission model | `src/lib/botPermission.ts` |
| Per-feature DTOs | `src/features/<game>/*-models.ts` (`cabinet-models.ts`, `song-models.ts`, …) |
| Component props | inline in the component's parameter type |
| Environment declarations | `src/vite-env.d.ts` |

DTOs for a feature belong next to the pages that use them, not in `src/lib/models.ts` — the cabinet
work put every cabinet DTO plus its constants (`LC_MODES`, `CABINET_LEVELS`, `LCSET_KEYS`,
`REMOTE_COMMANDS`) and its formatters in `src/features/mai2/cabinet-models.ts` precisely so the
feature folder stays self-contained.

DTO interfaces are **plain structural types with no classes and no decorators**, mirroring the JSON
the backend returns. Optional fields are marked `?` rather than given placeholder defaults, so the
rendering code is forced to handle absence.

---

## Validation

There is none at the type level. The trust boundary is `src/lib/api/client.ts`, which parses the
response body as `any` and hands it to the caller. Each caller then does two things:

1. **Envelope check** — `isOk(resp)` from `src/lib/models.ts` verifies `status.code === StatusCode.OK`.
2. **Cast to the DTO** — `resp.data as CabinetInfo`.

Because step 2 is unchecked, defensive rendering is the norm:

- `setInfo(isOk(resp) ? (resp.data as CabinetInfo) : null)` — a failed envelope becomes `null`, and
  the component renders its empty/error branch.
- Optional chaining and `??` are used liberally when reading nested backend data
  (`resp.data?.permission ?? 0`).
- Endpoints with irregular shapes are tolerated explicitly: `lcdx/kop/rank` returns a **bare array**
  rather than an `ApiResponse` envelope, so that page accepts both.

If a payload is genuinely ambiguous, narrow it with a type predicate rather than casting twice. The
existing escape hatches (`as unknown as …`) are confined to the IndexedDB wrapper (`src/lib/db/db.ts`)
and one circle-info fallback — do not add new ones in feature code.

---

## Common Patterns

- **Discriminated unions for UI state.** `src/lib/theme.ts` models
  `ColorTheme = 'auto' | 'light' | 'dark'` and derives `ResolvedColorTheme = Exclude<ColorTheme,
  'auto'>`; `src/lib/db/preload.ts` uses `'checking' | 'completed' | 'error' | null`. Prefer a union
  over parallel booleans.
- **String-literal unions over enums** for wire values (`type ThemeFamily = 'liquefy' | 'animal-island'
  | 'legacy'`), paired with a runtime guard (`isThemeFamily`) when the value arrives from
  `localStorage`. This is the standard shape for "untrusted string from storage or URL" — guard
  first, then narrow.
- **Numeric constants over magic numbers.** Permission tiers are named exports
  (`PERMISSION_ACTIVATED = 1`, `MANAGE_GRANTS = 4`, `MANAGE_PERMISSIONS = 7`, `ADMIN_PERMISSION = 10`)
  in `src/lib/botPermission.ts`. Never write a bare `4` or `7` in a guard or menu condition.
- **`satisfies` for exhaustive object literals** that must keep their literal types
  (`{ … } satisfies ThemeSnapshot`).
- **Generic helpers** where a function is shape-agnostic — e.g. `filterCommands<T extends { command:
  string }>(permission: number, commands: T[]): T[]`.
- **`useRef<T>(null)` with an explicit type** for DOM refs (`useRef<HTMLElement>(null)`).

---

## Forbidden Patterns

- `any` in new code. The existing occurrences are concentrated in `src/lib/db/db.ts` (IndexedDB
  wrappers), the auth service files and a handful of pages; do not extend them. Prefer `unknown` plus
  a narrowing guard.
- Non-null assertions (`!`) on values that can genuinely be absent. The accepted use is immediately
  after a presence check that TypeScript cannot see through (`document.getElementById('root')!` in
  `main.tsx`).
- `@ts-ignore` / `@ts-expect-error`. None exist; do not introduce one.
- Casting a DTO to `any` to read an unmodelled field — add the field to the feature's `*-models.ts`
  instead.
- Default-exporting types or components (only `src/app.tsx` and `src/main.tsx` default-export
  components).
- Adding a `Props` interface for a single-use component when the inline parameter type is enough —
  follow the established inline style (see [component-guidelines.md](./component-guidelines.md)).

---

## Verification

`npm run build` (`tsc -b && vite build`) is the type gate and must be green before every commit.
`npm run lint` is **not** usable — there is no ESLint config in the repo and `eslint` is not a
declared dependency. Do not rely on it; use the build plus `tests/ui-parity/` for verification.
