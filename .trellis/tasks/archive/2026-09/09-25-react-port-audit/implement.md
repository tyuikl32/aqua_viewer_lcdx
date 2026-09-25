# Execution plan

- [x] Inventory all 46 migration commits and baseline build; check infrastructure/router/store/API contracts.
- [x] Audit cabinet pages against legacy and backend; fix confirmed regressions.
- [x] Audit auth/account/shared pages and LCDX flows; fix confirmed regressions.
- [x] Audit upstream game features, i18n, assets and deployment preservation.
- [x] Integrate fixes and run full offline regression tests plus production build.
- [x] Record severity-ranked findings, coverage matrix, limitations and spec learnings.
- [ ] Phase 3.4: present commit plan and obtain one-shot confirmation before creating commits.
- [ ] Phase 3.5: archive and journal after approved commits; not performed in this audit turn.

## Verification outcome

- Final full suite: **56 passed (1.2m)**; account4/cabinet7/permission4/guard10/settings3/rival1/theme6/content20.
- Final production build: passed, including TypeScript and PWA generation.
- i18n scanner: four resources with 1,205 keys each; 1,361 static calls; no errors.
- Dynamic suffix review: 101 keys across 11 finite domains; no missing keys.
- Tracked whitespace check: passed; all newly added text files also checked before handoff.
- Lint: unavailable (`eslint` not recognized); no lint coverage claimed.
- Backend: unchanged at 49f20db; contracts reviewed, no runtime build/test or authenticated mutation. Follow-up read-only test-site announcement requests are recorded in the report.

## Validation rules

Application production writes were not performed; tests intercept local API fixtures and block external origins. The separately requested Nginx-only SPA fallback update was applied to both vhosts after backup and config validation. Build is
necessary but insufficient. Compare affected behaviors to both baselines before editing. Do
not push, switch branch pointers, rewrite existing commits, or commit without confirmation.

Native multi-agent dispatch was unsupported; review/fixes ran locally with the planned module
partition. Package context reports a single-repo frontend layer. Spec updates capture atomic
permissions, stale request guards, independent account tools, polling ownership and offline tests.
See `audit-report.md`, `validation.json`, `i18n-dynamic-review.json` and `commit-plan.md`.

Task status remains in_progress because Trellis commit/archive steps require confirmation; the
code audit and offline validation are complete within the explicitly documented limits.


## Follow-up: KOP layout and announcement detail failures

User reported `/mai2/kop` UI mismatch and `/announcements` Markdown parser crash after build.
Compare refreshed upstream/main and master/origin/master with the current branch; preserve earlier uncommitted audit fixes.

- [x] Reproduce KOP with populated ranking fixtures; compare legacy styles, assets and current runtime.
- [x] Normalize nullable announcement content at the DTO boundary, preserving translations and sanitized rendering on list and dashboard.
- [x] Add regression tests for both user reports and LCDX contract edge cases.
- [x] Run full offline suite, i18n checks and production build; record verification and limitations.
- [ ] Await explicit confirmation before Git commit, push, or Trellis archive.


## Follow-up: SPA deep-link deployment behavior

- [x] Confirm the React router already distinguishes known protected routes (`RequireAuth` -> `/`) from unknown routes (`*` -> `/not-found`).
- [x] Identify the deployment fault: `test-lcdxnet.am-allnet.com` had an empty rewrite include, so Nginx returned 404 before React could run.
- [x] Back up both site vhosts/rewrite files to `/root/backups/lcdx-spa-20260925-123607`.
- [x] Ensure both separate rewrite files contain `try_files $uri $uri/ /index.html;`, pass `nginx -t`, and reload Nginx.
- [x] Verify both live hosts: `/mai2/photos` ends at `/`; an unknown path ends at `/not-found`.
- [x] Rebuild the local application to `E:\ALL.Net\Project_LCDX_NET\aqua_viewer_lcdx\dist`; do not upload the artifact without an explicit deployment request.
