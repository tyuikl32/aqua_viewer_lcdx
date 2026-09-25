# Offline LCDX regression tests

Run from the frontend repository root:

```powershell
npm ci
npm run test:lcdx-regression
node scripts/audit-i18n.mjs
npm run build
```

Prerequisites: the project's Node/npm toolchain, dependencies from package-lock.json, and an
installed Chrome browser (`channel: 'chrome'`). Port 5187 must be free. No hosts entry or HTTPS
certificate is required. Dependencies were already installed for this audit; `npm ci` above is
setup guidance, not a claim that this run reinstalled them.

The server uses production environment configuration under local HTTP, with no live proxy.
The shared fixture blocks other origins and fulfills local `/api/` and `/lcdx/` requests.
Service workers are disabled. Tests use fake tokens and identities only. New tests must call
`setup()` before navigation and must not remove the network-isolation route.

The suite covers cabinet permission races/tier guards, cold deep links, stale selections,
filter application, polling overlap/final attempts, LCDX login/register/one-time/NET binding,
independent settings tools, first-card/default-card contracts, rival IDs, and six mobile theme
configurations. Backend mutation responses are fixtures, not production executions. Theme
tests check layout and runtime errors at 390x844 and save screenshots; they do not prove
pixel-perfect parity or that real CDN imagery loaded.

The i18n scanner uses the parser already included through the locked Vite React plugin tree.
`node scripts/audit-i18n.mjs --dynamic` lists expressions that need semantic review. It checks
resource equality, interpolation variables and literal keys, not every server-driven string.
The separate `test:ui-parity` suite retains its own legacy-server/hosts/certificate prerequisites.

## Announcement and KOP follow-up coverage

`content-pages.spec.ts` adds 20 cases (55 total in the current suite):

- Announcement list and dashboard: null, omitted, empty and whitespace-only bodies (8 cases).
- Markdown/HTML sanitization, upstream translations, empty-translation fallback (3 cases).
- LCDX `OTHERS` display normalization and reverse filter mapping (1 case).
- Populated KOP rankings: three theme families at 1280px and 390px (6 cases), checking score,
  date, rank, locally served medal assets, row geometry and viewport overflow.
- KOP envelope/empty response compatibility and Ongeki's own scoped layout (2 cases).

The six KOP screenshots are saved under `test-results/lcdx-regression`. KOP cases do not
parameterize light/dark modes and are not legacy screenshot-diff tests. Ongeki assertions
check its own name/rank styles, not live CDN artwork availability.

Separate read-only live announcement checks are documented in the Trellis audit report;
this browser suite still makes no real API mutations or external-origin requests.
