# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Standards distilled from the mai2 cabinet management work (2026-08). Scope: `aqua_viewer_lcdx` frontend and its integration with `LCDXNetApi`.

---

## Forbidden Patterns

### HTTP DELETE with a request body (non-standard transport)

- `ApiService.deleteLcdx(path, body)` sends a body via HttpClient's `{body}` option (see `api.service.ts`). ASP.NET Core accepts `[FromBody]` on DELETE, but some proxies/gateways strip DELETE bodies.
- For **new** endpoints, prefer path/query parameters. The existing `deleteLcdx` variant is kept for already-settled cabinet endpoints — do not add new body-carrying DELETE calls.

---

## Required Patterns

### Service stubbing in specs

- `jasmine.createSpyObj` requires a **non-empty** method-name array; and its third-argument property object already installs property spies — calling `spyOnProperty` on the same property afterwards throws `currentValue#get has already been spied upon`.
- For services consumed via getter properties (`currentValue`, `currentAccountValue`), stub with a plain object + closure-backed getter:

```typescript
let permState = {permission: 0, hasManage: false, loaded: true};
botPermission = {get currentValue() { return permState; }} as unknown as BotPermissionService;
```

This allows re-stubbing per test case without spy bookkeeping.

### Guards

- Guard classes: `providedIn: 'root'`, synchronous `canActivate(): boolean | UrlTree` unless async work is genuinely required (sync exemplar: `cabinet-guards.service.ts`; justified-async case: `auth-guard.service.ts`).

---

## Testing Requirements

- `ng test` **baseline is NOT all-green**: 54 pre-existing failures from Ongeki/Chunithm legacy specs (missing providers) — unrelated to new work (session-observed count, 2026-08; re-count on the next full run). Run scoped specs instead and compare totals against this baseline:

```powershell
npx ng test --include "src/app/auth/*.spec.ts" --watch=false --browsers=ChromeHeadless
```

- Backend counterpart: `dotnet test LCDXNetApi.sln` (cwd = `LCDXNetApi`), expected 95/95 green; use `--filter` for scoped runs.

---

## Code Review Checklist

- **IDE auto-revert hazard**: this workspace's IDE occasionally restores old buffer contents over just-edited files (hit ~10× during cabinet work). After each edit batch, re-verify the critical file state before building; if a change vanished, re-apply it via a one-shot script instead of repeating single edits.
- New user-facing strings: prefer i18n keys unless the surrounding feature is deliberately single-language.
- Route-guard changes: confirm guard tier (`hasManage` vs `ADMIN_PERMISSION >= 10`) matches the page's permission tier in design §3.2.

### Angular template expressions and numeric inputs

- Do not call JavaScript global constructors or static methods such as `Number(...)`, `Number.parseInt(...)`, or `parseFloat(...)` from an Angular template event binding. Angular template expressions are evaluated against the component context, so a missing component member can fail only at runtime while the application still compiles.
- For native numeric inputs, prefer `[(ngModel)]` with `type="number"`; Angular's `NumberValueAccessor` keeps the bound value numeric and handles the empty state as `null`. If custom conversion is required, put it in a component method or a typed value accessor and test the actual DOM event.
- Add a component regression test that dispatches an input/change event and verifies both the bound value and any dependent `[disabled]` state. A TypeScript-only test is insufficient for template binding regressions.
