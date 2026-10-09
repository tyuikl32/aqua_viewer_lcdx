# State Management

> How state is managed in this project.

---

## Overview

No Redux, no Zustand, no context-based store. Global state is a hand-rolled observable cell in
`src/lib/store.ts`:

```ts
export interface Store<T> {
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T>(initial: T): Store<T> { … }

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
```

`createStore` is the direct replacement for the legacy `BehaviorSubject` + `asObservable()` service
pattern — the store's `get()` is the old `currentValue`, `set()` is `next()`, `subscribe()` is the
subscription. Because it is built on `useSyncExternalStore`, an unsubscribed store never causes a
re-render and there is no provider to mount.

---

## State Categories

| Category | Where it lives | Example |
|---|---|---|
| Component-local | `useState` in the page | selected cabinet, form inputs, dialog open flags |
| Derived | computed in render / `useMemo` | filtered + paged table rows, pagination window |
| Global, in-memory | a `createStore` cell in `src/lib/` | `botPermissionStore`, `accessStatusStore`, `loadingStore` |
| Global, persisted | `createStore` hydrated from storage | `accountStore`, `userStore` |
| Server state | **not cached** — refetched per page mount | every `lcdx.get(...)` result |
| URL state | `react-router` location | route params, `useLocation()` in guards |

### The stores

| Store | File | Persistence |
|---|---|---|
| `accountStore` | `src/lib/auth/account.ts` | `localStorage.currentAccount` (or `sessionStorage` in an impersonation iframe) |
| `userStore` | `src/lib/user.ts` | `localStorage.currentUser` (same iframe rule) |
| `accessStatusStore` | `src/lib/auth/access.ts` | none |
| `botPermissionStore` | `src/lib/botPermission.ts` | none |
| `toastStore` | `src/lib/message.ts` | none |
| `langStore` | `src/lib/i18n.ts` | backed by `localStorage.lang` |
| `loadingStore` | `src/lib/api/client.ts` | none (ref-counted by in-flight requests) |
| `preloadStates` / `dbVersionStore` / `checkingUpdate` | `src/lib/db/preload.ts` | `dbVersionStore` from `localStorage.dbVersion` |

---

## When to Use Global State

Promote to `src/lib/<concern>.ts` + `createStore` only when **both** hold:

1. More than one unrelated screen reads the value, and
2. The value must survive a route change.

Otherwise keep it local. Cabinet page selections, filters, page numbers and dialog flags are all
local state — do not lift them "for reuse".

When you do add a store, follow the existing module shape: constants → state interface →
`INITIAL_STATE` → `createStore` → `useXxx()` / `getXxx()` accessors → mutator functions → pure
helpers. `src/lib/botPermission.ts` is the reference implementation.

Read state outside React through the getter (`getAccount()`, `getCurrentUser()`,
`getBotPermission()`), never by importing the store and calling `.get()` inline — the getters are the
documented surface and the ones the guards use.

---

## Cross-Cutting Side Effects

Global transitions trigger side effects by **subscribing to the store**, not by wrapping the setter:

```ts
// src/lib/api/client.ts — re-arm the proactive token refresh whenever the account changes
accountStore.subscribe(() => rescheduleRefresh(getAccount()));
rescheduleRefresh(getAccount());
```

The permission lifecycle follows the same idea but is driven explicitly at the call sites:
`loadUser()` calls `loadBotPermission(user.username)` on success, and `clearUser()` calls
`clearBotPermission()`. When adding a store that must react to login/logout, extend those two
functions rather than scattering subscriptions.

---

## Server State

There is no client cache. Each screen mounts, fetches, and holds the result in `useState`; navigating
away discards it. Consequences to keep in mind:

- Do not assume data is fresh because another page loaded it a moment ago.
- Do not introduce a cache "just for this page" — that would create a second source of truth
  alongside the store pattern.
- The single shared piece of server-derived state is the permission snapshot, and it is explicitly
  loaded once per login (`loadBotPermission`) and cleared on logout.

Request-level concerns (auth header, 401 single-flight refresh, the global loading bar, banned-account
redirect) are centralised in `src/lib/api/client.ts` and apply to `api` and `lcdx` alike. Pages must
not re-implement them.

---

## Common Mistakes

- Using a `createStore` for something one component needs. It survives navigation, so the value
  silently leaks into the next visit of that page.
- Mutating a store value in place (`store.get().push(x); store.set(store.get())`) — `set` is a
  reference assignment, and `useSyncExternalStore` compares by identity, so the UI will not update.
  Always construct a new object/array.
- Reading `store.get()` during render instead of `useStore(store)` — the component will not
  re-render when the value changes.
- Calling `.set()` on a store during another component's render (React will warn about updating
  during render); do it in an effect or an event handler.
- Forgetting that `botPermission` is **not** a security boundary — it drives menu/route UX only. The
  authoritative checks live in the backend `CabinetPolicy`; keep the display-layer filter in place as
  a second line of defence but never treat it as enforcement.
