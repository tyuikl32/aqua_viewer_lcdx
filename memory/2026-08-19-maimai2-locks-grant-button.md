# Debug Report: Maimai DX Add Grant Button

## Symptom

The "Add Grant" button on the maimai DX locks/authorization page remained disabled or appeared impossible to press after the QQ number was entered.

## Root Cause

The template used `Number($event)` in an `(ngModelChange)` expression for the QQ input. Angular evaluates template expressions against the component context, so the compiled handler called `this.Number(...)`. `Maimai2LocksComponent` has no `Number` member, causing a browser runtime `TypeError` and leaving `grantQQ` as `null`. The button's `[disabled]` condition (`grantQQ == null || !grantNick`) therefore stayed true.

## Fix

- Replaced both numeric `ngModelChange` conversions in `maimai2-locks.component.html` with `[(ngModel)]` and `type="number"`.
- Added a component regression test that dispatches real input/change events and verifies the numeric QQ value, selected cabinet, and enabled button state.
- Documented the Angular template-expression rule in `.trellis/spec/frontend/quality-guidelines.md` and `docs/PROJECT_MEMORY.md`.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` passed.
- Scoped Karma run passed: 12 tests across the user, permission, and locks component specs.
- `npm run build-prod` passed.

## Prevention

For native numeric controls, use Angular's `[(ngModel)]`/`NumberValueAccessor`. If custom conversion is unavoidable, put it in a component method and test the DOM event path rather than only testing the TypeScript method.
