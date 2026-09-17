# Remotecontrol / locks cabinet select show locationName (no box stretch)

## Goal

`/mai2/remotecontrol` 与 `/mai2/locks` 的机台下拉原先只显示别名。对齐 `/mai2/cabinets` 与已改的 `/mai2/cabmode`：展示 `别名 (locationName)`。同时约束：**不得因 option 文案变长而拉伸 select 框**。

## Requirements

1. **展示**（与 cabinets/cabmode 一致）：
   - option 文案：`{{ cab.nickName || cab.fullKeychip }}@if (cab.locationName) { ({{ cab.locationName }})}`
   - `[ngValue]` 仍为 `cab.nickName ?? cab.fullKeychip`（后端定位契约不变）
2. **不拉伸框**：
   - select 框宽度由列宽/父容器决定（Bootstrap grid 列），不因最长 option 撑大
   - CSS 约束：`width: 100%; max-width: 100%; text-overflow: ellipsis`（收起态长文案截断，不改布局）
   - 不加宽 `col-md-*` 列来迁就长文案
3. 范围：
   - 改：`maimai2-remote-control` 机台 select、`maimai2-locks` 授权机台 select
   - 同步加固：`maimai2-cabmode`（刚加长文案）同款 select 防撑宽 CSS，避免同一问题复现
   - 不改：cabinets 页业务逻辑、API、i18n key（文案来自后端字段，非新增硬编码 UI 文案）

## Acceptance Criteria

- [x] remotecontrol 机台下拉 option 含 locationName 括号后缀
- [x] locks 授权机台下拉 option 含 locationName 括号后缀
- [x] 三处 select（remote/locks/cabmode）CSS 保证框宽不被 option 文案拉伸（`cabinet-select` + `cabinet-select-col`）
- [x] `[ngValue]` / 提交与查询逻辑未变
- [x] `tsc --noEmit -p tsconfig.app.json` 通过（exit 0）
- [x] 既有相关 scoped 单测：remote-control 全绿；locks 分页 3 例失败为 master 既有问题（stash 对照确认，与本次无关）；授权选机台用例通过
- [x] Trellis 审计 + 提交（`476884a`，待 push 确认）

## Audit (trellis-check)

- 展示模板与 cabinets/cabmode 一致；`ngValue` 契约未动。
- 不撑宽：列 `min-width:0` + select `width/max-width 100%` + ellipsis；未改 col 宽度。
- Spec 已补 `quality-guidelines.md`「Cabinet selects」约定。
- 无新增硬编码 i18n 文案；无 status.message 直通。

## Notes

- 轻量任务，PRD-only。
- 参考：`maimai2-cabinets.component.html:10-12`、`maimai2-cabmode.component.html:10-12`。
