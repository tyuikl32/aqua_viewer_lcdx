# Audit React upstream merge and LCDX feature preservation

## Request
Audit all commits in the current React migration against upstream 90ed95b and the preserved LCDX legacy-angular b1c3fb4. Preserve upstream functionality/UI while retaining LCDX behavior. Identify omissions, incorrect ports, broken API contracts, and regression risks. Fix confirmed regressions only; never push or change branch pointers.

## Acceptance criteria
- Inventory all migration commits and compare changes against both source baselines.
- Check auth/storage/API, cabinet permissions and actions, shared LCDX pages, assets, i18n and deployment.
- Cross-check LCDX contracts against the adjacent LCDXNetApi repository without changing backend behavior.
- Add runnable offline regression coverage for confirmed fixes and run production build.
- Report concrete findings with severity, evidence and exact validation limitations.
- Do not describe mocked/browser smoke coverage as production integration coverage.

## Follow-up acceptance: reported content pages
- KOP preserves legacy rank/score/date/medal behavior without upstream CSS leakage.
- Announcement detail and dashboard do not crash for absent/blank LCDX bodies; valid localized
  Markdown and sanitized HTML remain supported.
- LCDX Other-category responses and list filters match the backend contract.
- Explicitly separate frontend resilience from missing deployed announcement content.
