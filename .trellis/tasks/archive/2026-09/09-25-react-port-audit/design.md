# Audit design

Three-way semantic comparison: upstream React 90ed95b -> current HEAD 9df7a97, and LCDX changes defebab..legacy-angular b1c3fb4 -> React equivalents. Backend contracts at LCDXNetApi 49f20db are authoritative for LCDX endpoints. No backend data mutations or application artifact deployment were performed; the later deployment follow-up was limited to backed-up Nginx SPA rewrite configuration on the two requested vhosts.

Partition review by disjoint write sets: cabinet features; auth/account and shared pages; game features/i18n/assets/CI; main coordinator owns infrastructure/router/stores, consolidated tests and audit artifacts. Reviewers must prove defects from code contracts/baselines, not preferences. Keep upstream UI and existing compatibility.

## Content-page follow-up

Keep KOP markup and data logic unchanged; contain imported Ongeki styles at their source
page boundary. Normalize announcement text/translations in the shared DTO and reuse one
sanitized renderer for dashboard/list details. Keep LCDX category adaptation at its API
boundary and preserve upstream editor writes. Missing deployed body files remain a server
remediation item, not a fabricated frontend fallback.


## Deployment follow-up

The application router owns the semantic distinction: authenticated route guards redirect unauthenticated users to `/`, while the catch-all route redirects unknown paths to `/not-found`. Nginx must only provide the SPA entry point for deep links. Both site-specific rewrite includes now use `try_files $uri $uri/ /index.html;`; API proxy locations remain separate and were not changed.
