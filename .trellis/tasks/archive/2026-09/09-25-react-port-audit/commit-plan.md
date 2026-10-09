# Proposed commits (confirmation required)

No commit has been created. This plan covers only files edited for the current audit.
No unrecognized dirty files were found in the final snapshot. Do not use `git add -A` blindly;
re-check the worktree and this list at execution time. No push is proposed.

Approve these two local commits explicitly, request changes, or leave committing to you.
Archive/journal bookkeeping follows approved work commits. No push is proposed. The local `dist` build was not uploaded; the separately requested Nginx-only SPA rewrite change was applied remotely outside Git and backed up at `/root/backups/lcdx-spa-20260925-123607`.

## 1. fix(lcdx): preserve account tools and stabilize React port async flows

Includes production fixes, their regression coverage, i18n loading/empty-content text, KOP CSS isolation, announcement compatibility, test tools and matching
frontend spec learnings as one coherent change unit:

- `.trellis/spec/frontend/index.md`
- `.trellis/spec/frontend/quality-guidelines.md`
- `package.json`
- `playwright.lcdx.config.ts`
- `public/assets/i18n/en.json`
- `public/assets/i18n/zh.json`
- `scripts/audit-i18n.mjs`
- `scripts/serve-lcdx-regression.mjs`
- `src/features/mai2/Maimai2CabinetsPage.tsx`
- `src/features/mai2/Maimai2CabmodePage.tsx`
- `src/features/mai2/Maimai2LocksPage.tsx`
- `src/features/mai2/Maimai2RemoteControlPage.tsx`
- `src/features/mai2/Maimai2SettingPage.tsx`
- `src/i18n/en.json`
- `src/i18n/zh.json`
- `src/lib/botPermission.ts`
- `src/pages/auth/OnetimeSignInPage.tsx`
- `tests/lcdx-regression/README.md`
- `tests/lcdx-regression/account.spec.ts`
- `tests/lcdx-regression/cabinets.spec.ts`
- `tests/lcdx-regression/fixture.ts`
- `tests/lcdx-regression/game-contracts.spec.ts`
- `tests/lcdx-regression/guards.spec.ts`
- `tests/lcdx-regression/permissions.spec.ts`
- `tests/lcdx-regression/settings.spec.ts`
- `tests/lcdx-regression/themes.spec.ts`

- `src/features/announcements/announcement.ts`
- `src/features/announcements/AnnouncementContent.tsx`
- `src/features/ongeki/OngekiProfilePage.css`
- `src/pages/AnnouncementsPage.tsx`
- `src/pages/DashboardPage.tsx`
- `tests/lcdx-regression/content-pages.spec.ts`

## 2. docs(trellis): record React merge audit and preservation coverage

Includes scope, findings, validation, commit inventory and parent/child audit linkage:

- `.trellis/tasks/09-24-react-upstream-merge/task.json`
- `.trellis/tasks/09-25-react-port-audit/audit-report.md`
- `.trellis/tasks/09-25-react-port-audit/check.jsonl`
- `.trellis/tasks/09-25-react-port-audit/commit-inventory.txt`
- `.trellis/tasks/09-25-react-port-audit/commit-plan.md`
- `.trellis/tasks/09-25-react-port-audit/design.md`
- `.trellis/tasks/09-25-react-port-audit/i18n-dynamic-review.json`
- `.trellis/tasks/09-25-react-port-audit/implement.jsonl`
- `.trellis/tasks/09-25-react-port-audit/implement.md`
- `.trellis/tasks/09-25-react-port-audit/prd.md`
- `.trellis/tasks/09-25-react-port-audit/task.json`
- `.trellis/tasks/09-25-react-port-audit/validation.json`


## Remote deployment note

- `lcdxnet.am-allnet.com` and `test-lcdxnet.am-allnet.com` are separate Baota/Nginx vhosts.
- Both rewrite includes now serve `/index.html` for client-side routes.
- `nginx -t` passed and `systemctl reload nginx` completed.
- Remote verification confirmed `/mai2/photos` -> `/` for an unauthenticated browser and an unknown path -> `/not-found`.
- This is configuration state, not a Git commit; do not include it in the proposed application commit.
