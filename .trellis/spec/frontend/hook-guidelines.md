# Hook Guidelines

> How hooks are used in this project.

---

## Overview

The app is deliberately low-abstraction: **four** custom hooks exist in the whole codebase, and
there is no data-fetching library in use. Feature pages fetch with plain `async` functions and hold
results in `useState`.

| Hook | File | Purpose |
|---|---|---|
| `useStore(store)` | `src/lib/store.ts` | Subscribe a component to a `createStore` value |
| `useTheme()` | `src/lib/theme.ts` | Theme family + resolved colour scheme |
| `useBotPermission()` | `src/lib/botPermission.ts` | LCDX five-tier permission state |
| `useMobileLiquidFooter(enabled, routeKey)` | `src/components/shell/useMobileLiquidFooter.ts` | Collapsing mobile footer behaviour |

`useTranslation()` comes from `react-i18next`; the shadcn/ui primitives in `src/components/ui/**`
use Radix hooks internally.

---

## Custom Hook Patterns

- Name the file `useThing.ts` when the hook is shared, or declare `useThing` next to the single
  component that owns it when it is private.
- Hooks that read global state are **thin wrappers** over `useStore`:

```ts
export function useBotPermission(): LcdxPermissionState {
  return useStore(botPermissionStore);
}
```

- Hooks that own DOM behaviour return a ref plus derived state, and keep every listener paired with
  its cleanup in the same effect (`useMobileLiquidFooter` returns `{ footerRef, compact }`).
- Do not add a hook for one call site. Two inline `useState` calls are preferred over a
  `useFooState()` abstraction that hides what is going on.

---

## Data Fetching

There is **no React Query / SWR usage** in feature code, even though `QueryClientProvider` is mounted
in `src/app.tsx`. Follow the established pattern instead:

```tsx
const [info, setInfo] = useState<CabinetInfo | null>(null);

const loadInfo = useCallback(async (nick: string) => {
  const resp = await lcdx.get(`lcdx/cabinet/info/${encodeURIComponent(userName())}/${encodeURIComponent(nick)}`);
  setInfo(isOk(resp) ? (resp.data as CabinetInfo) : null);
}, []);

useEffect(() => {
  void loadInfo(selectedNick);
}, [selectedNick, loadInfo]);
```

Rules:

- Wrap loaders in `useCallback` with an accurate dependency list so they can be effect dependencies
  without re-running every render.
- Always `void` a floating promise (`void loadInfo(nick)`); the project has no-floating-promises
  discipline.
- Use `lcdx` for LCDX business endpoints (`lcdx/cabinet/*`, `lcdx/mergeRegistry/*`,
  `lcdx/announcement/*`, `lcdx/kop/*`) and `api` for portal endpoints. Both share auth headers, the
  single-flight 401 refresh, the ref-count loading bar and the error mapping — never call `fetch`
  directly except through `rawFetch` for blob downloads.
- Unwrap the envelope with `isOk(resp)` and cast `resp.data` to the DTO from the feature's
  `*-models.ts`. LCDX `kop/rank` is the one endpoint returning a **bare array** — tolerate both
  shapes there.
- Errors are not surfaced automatically. Show a toast yourself:
  `catch { notice(translate('Common.OperationFailed')); }`.

### Polling

Long-running screens poll instead of streaming. Two shapes exist:

- Fixed-interval refresh: a `setInterval` gated by a user-visible toggle (`Maimai2CabinetsPage`,
  `REFRESH_MS = 30_000`).
- Bounded poll after a command: `Maimai2RemoteControlPage` polls every 2s up to 30 times, keyed by
  the `requestId` returned from the send call, and stops on terminal state.

Interval callbacks must read state through a ref mirror, and the effect must clear the interval on
unmount:

```tsx
const selectedNickRef = useRef(selectedNick);
selectedNickRef.current = selectedNick;

useEffect(() => {
  if (!autoRefresh) return;
  const id = setInterval(() => void refreshAll(selectedNickRef.current), REFRESH_MS);
  return () => clearInterval(id);
}, [autoRefresh, refreshAll]);
```

---

## Naming Conventions

- `use*` for hooks; `useXxxStore` only when a hook returns a store object rather than a value.
- Loader callbacks: `loadXxx` (data), `refreshAll` (fan-out refresh), `handleXxx` for DOM event
  handlers when the inline arrow would be non-trivial.
- Refs mirroring state are named `<state>Ref` (`selectedNickRef`).

---

## Common Mistakes

- Adding React Query "because it is installed" — the provider is mounted for parity with upstream,
  but no page uses it. Introducing it into one page creates two competing data-fetch patterns.
- Omitting the `void` on a floating promise (or awaiting inside a non-async effect callback).
- Using `useState` + `useEffect` to derive a value that could be computed during render — the
  codebase computes derived lists with `useMemo` or plain consts (`Pagination`'s page window).
- Forgetting the `active`/cancelled guard when an async loader can resolve after unmount.
- Reading a prop or state inside an event listener registered once (wheel/scroll/touch handlers in
  `useMobileLiquidFooter` are the canonical example of doing this correctly).
