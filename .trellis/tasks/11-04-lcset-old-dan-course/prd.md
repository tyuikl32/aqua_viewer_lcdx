# LC 功能设置新增「旧段位 → EnableOldDanCourse」

## Goal

`/mai2/cabmode` 的「LC 功能设置」下拉目前只有 9 项，缺「旧段位」。本任务只加这一条下拉项，让 P≥4 账号能选到并提交。

## Requirements

1. `LCSET_KEYS` 增加一条：`{ key: '旧段位', setting: 'EnableOldDanCourse' }`。
2. 不新增 `段位` 别名；不加 `default`（「恢复默认值」按钮对该项禁用，与 `cam` / `cc` 一致）。
3. 不改权限过滤（`filterLcsetKeys` 仍 P≥4）、不改提交逻辑、不改 i18n。

## Acceptance Criteria

- [ ] P≥4 账号进入 `/mai2/cabmode`，LC 功能设置下拉出现「旧段位 → EnableOldDanCourse」。
- [ ] 选中后填值提交，请求体为 `{ key: '旧段位', val: <输入值> }`。
- [ ] P≤3 账号看不到该下拉（既有权限过滤，不回归）。
- [ ] `npm run build` 通过。

## Out of Scope

- 其余 13 个设置。
- `段位` 别名、`default` 值、`noteKey` 格式提示。
- 4 处「9 项」注释的措辞（既有文档漂移，另起清理）。

## Notes

- 后端对应任务：`LCDXNetApi/.trellis/tasks/11-04-lcset-old-dan-course`（白名单不加则提交 94001）。
- 前端下拉文本格式为 `{key} → {setting}`，所以显示「旧段位 → EnableOldDanCourse」。
