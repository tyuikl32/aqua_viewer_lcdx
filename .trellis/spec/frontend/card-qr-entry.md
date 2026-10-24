# Arcade Login QR (NCBT) — Frontend Entry

> Knowledge captured by task `10-25-card-qr-login-frontend`. Backend counterpart:
> `LCDXNetApi/.trellis/spec/backend/card-qr-ncbt.md`.

---

## Where it lives

| Piece | Path |
|---|---|
| Card-number decode / eligibility | `src/lib/guofuCard.ts` (`decodeGuofuCardId`, `isGuofuCardNumber`) |
| API wrapper | `src/lib/api/cardQr.ts` (`fetchCardQr`) |
| Dialog | `src/features/cards/CardQrModal.tsx` |
| Entry point | `src/pages/CardsPage.tsx` (QR icon next to the primary card's access code) |
| Regression spec | `tests/lcdx-regression/cards-qr.spec.ts` |

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

### 3. The 10-second cooldown is page-level, not dialog-level

The backend throttles on the audit table with a 10s window, and **any** request except `94001` consumes
that window. That is why the cooldown lives in `CardsPage` state:

- opening the dialog during cooldown is blocked with a notice;
- the dialog's refresh button is disabled and shows `CardsPage.QrRefreshCooldown`.

If you move the cooldown into the dialog, closing and reopening lets the user hit `94032` immediately,
which reads as a bug.

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

---

## Status code mapping

| code | meaning | i18n key |
|---|---|---|
| 92001 | ok | — |
| 94001 | card number cannot be encoded | `CardsPage.QrUnsupported` |
| 94031 | card is not the caller's primary card | `CardsPage.QrNotOwner` |
| 94032 | throttled (10s) | `CardsPage.QrTooFrequent` |
| 95001 | ownership unverifiable (Rinnet down) | `CardsPage.QrUnavailable` |
