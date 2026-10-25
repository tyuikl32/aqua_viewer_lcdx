# Arcade Login QR (NCBT) — Frontend Entry

> Knowledge captured by tasks `10-25-card-qr-login-frontend` and `10-26-player-qr-page`. Backend counterpart:
> `LCDXNetApi/.trellis/spec/backend/card-qr-ncbt.md`.

---

## Where it lives

| Piece | Path |
|---|---|
| Card-number decode / eligibility | `src/lib/guofuCard.ts` (`decodeGuofuCardId`, `isGuofuCardNumber`) |
| API wrapper | `src/lib/api/cardQr.ts` (`fetchCardQr`) |
| Inline panel (QR + countdown + cooldown) | `src/features/cards/CardQrPanel.tsx` |
| Page | `src/pages/PlayerQrPage.tsx` (route `/mai2/playerqr`) |
| Sidebar entry | `src/lib/menu.ts` → `{ id: 17, name: 'PlayerQr', url: 'mai2/playerqr' }` |
| Regression spec | `tests/lcdx-regression/player-qr.spec.ts` |

**Why a dedicated page and not a button on `/cards`:** `/cards` has no sidebar entry at all (only the
direct URL reaches it), so an entry placed there is invisible to real users. The QR feature must live on
a page that is reachable from the sidebar; do not re-attach it to the cards page or the dashboard card row.

---

## Rules that are easy to break

### 1. The QR must be black-on-white, regardless of theme

`colorTheme` defaults to `'auto'` and follows the OS, so a large share of users are in dark mode. The
QR is rendered inside a forced `bg-white` container with `color: { dark: '#000000ff', light: '#ffffffff' }`.
If you let it inherit theme colors, the cabinet's ZXing reader is not guaranteed to retry with inverted
colors and scanning silently fails.

### 2. Only primary cards get an entry

`cards[].luid` is eligible; `cards[].cardExternalList[]` is **not**. Aliases never carry a `2430…`
number in practice, and the backend ownership check rejects them anyway — keep both layers aligned.

### 3. The 10-second cooldown follows the server, not the click

The backend throttles on the audit table with a 10s window, and **any request that mints a new code**
consumes it. Two consequences:

- the cooldown must be driven by the response, not by "the user clicked": `if (!resp.data.resumed)`
  start the 10s cooldown. A `resumed: true` response reused an already-issued code and did **not**
  consume the window, so disabling the button would be wrong;
- the panel auto-requests on mount with `resume: true`, so there is no "close and reopen" path that
  could bypass the window — a reload just gets the same code back.

If a future UI adds a modal/entry layer around the panel, keep the cooldown above that layer.

### 3b. `resume` is the only correct way to survive a reload

`POST lcdx/cardQr` takes `resume`. On mount the panel always sends `resume: true`; the「刷新」button
always sends `resume: false`. Do **not** try to cache the payload in the browser (module scope,
`sessionStorage`, …) to survive a reload: the server is the authority for "which code is currently
issued", and a second local copy drifts (e.g. the server may decide the remaining time is under 60s and
mint a new code while the client still shows the old one).

### 4. Payload is never persisted

The 40-character payload exists only in component state. Do not put it in `localStorage`,
`sessionStorage`, the URL, or a React Query cache entry — it is a bearer credential for ~10 minutes.
`vite-plugin-pwa` has no `runtimeCaching` for `/lcdx`, so the service worker will not keep it either;
do not add one.

### 5. Countdown and validity

`expiresInSeconds` is 540 — the exact worst case, because the cabinet decoder aligns to whole minutes
and looks back 10 of them. Do not "round up" to 600 when wiring a new UI.

### 6. Legacy card numbers are first-class

`243044306799` + 8 digits is a valid CN card and must render both the login QR entry and the merge
("引继") entry. The discriminator is the 11th digit (`'9'` legacy, `'0'`/`'1'` new), identical to
`LCDXNetApi/Helper/NcbtQrGenerator.TryResolveClientId`. If you change one side, change the other —
otherwise you get a button that always fails.

### 7. The error state must REPLACE the QR container, not stack on top of it

The dialog used to render two independent branches:

```tsx
<div className="bg-white …">{showQr ? <img/> : <span>{failedCopy}</span>}</div>
{errorKey && <div className="text-danger">{t(errorKey)}</div>}   // ← also renders
```

On every error `dataUrl` is null, so `expired && dataUrl` is false and the placeholder fell through to
`QrRenderFailed`. Users therefore saw *"Failed to render, please refresh"* next to *"Too frequent"* — and
the refresh button was disabled for 10 s at that exact moment, i.e. the copy told them to do the one
thing that could not work.

Keep the two mutually exclusive: `errorKey ? <error> : <white container>`. Tests must assert the generic
copy has `count === 0`; asserting only that the specific message is visible passes even with the bug.

### 8. Countdown comes from `expiresAt`, not from `expiresInSeconds`

`expiresInSeconds` starts counting when the **response arrives**, while the code actually expires
`540 s` after the server captured `now`. The backend now also returns an absolute `expiresAt`
(ISO 8601 with offset) which is authoritative:

```ts
const target = data.expiresAt ? Date.parse(data.expiresAt) : NaN;
return Number.isFinite(target)
  ? clamp(Math.round((target - Date.now()) / 1000))
  : clamp(data.expiresInSeconds || 540);
```

Keep the fallback — the frontend must still work against a backend that predates `expiresAt`.
`clamp` to `[0, 540]` so clock skew cannot display a remaining time that never existed.

---

## Status code mapping

| code | meaning | i18n key |
|---|---|---|
| 92001 | ok | — |
| 94001 | card number cannot be encoded (or user not registered) | `CardsPage.QrUnsupported` |
| 94031 | card is not the caller's primary card | `CardsPage.QrNotOwner` |
| 94032 | throttled (10s) | `CardsPage.QrTooFrequent` |
| 95001 | ownership unverifiable (Rinnet down) | `CardsPage.QrUnavailable` |

---

## Automated guards

| Concern | Where |
|---|---|
| entry visibility (new / legacy / physical / no card) | `cards-qr.spec.ts` |
| one message per error state | `cards-qr.spec.ts` — "shows exactly one error message" |
| black-on-white under dark theme (pixel statistics) | `cards-qr.spec.ts` — "QR stays black-on-white in …" |
| `expiresAt` vs `expiresInSeconds` | `cards-qr.spec.ts` — two countdown cases |

