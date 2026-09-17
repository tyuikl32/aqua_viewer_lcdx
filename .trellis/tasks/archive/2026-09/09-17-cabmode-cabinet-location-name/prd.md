# Cabmode cabinet list show locationName

## Goal

`/mai2/cabmode`（机台控制）机台下拉原先只显示别名，无法区分同名/短别名机台。对齐 `/mai2/cabinets` 的展示：别名后括号补全 `locationName`。

## Requirements

- 机台控制页机台下拉 option 展示与 cabinets 一致：
  - `{{ cab.nickName || cab.fullKeychip }}`
  - 若 `cab.locationName` 非空，追加 ` ({{ cab.locationName }})`
- option 的 `[ngValue]` 仍为 `cab.nickName ?? cab.fullKeychip`（后端定位契约不变，提交/查询逻辑不变）
- 允许原生 select 文案过长时截断/省略（与 cabinets 行为一致），不做额外裁切逻辑
- 本任务范围仅 `maimai2-cabmode`；remotecontrol / locks 下拉不在本次范围

## Acceptance Criteria

- [x] `maimai2-cabmode.component.html` 机台下拉与 cabinets 同款「别名 (locationName)」模板
- [x] `ngValue` 未改，选择值仍是 nickName ?? fullKeychip
- [x] `tsc --noEmit -p tsconfig.app.json` 通过（exit 0）
- [x] 提交并推送到 origin/master（`2c38fee`）

## Audit (trellis-check)

- Diff 仅 `maimai2-cabmode.component.html`：option 文案对齐 cabinets；`[ngValue]` 未变。
- 与 frontend quality-guidelines / AGENTS.md：无新增硬编码文案、无 status.message 直通、未改 NgModule/standalone。
- remotecontrol / locks 仍仅别名 —— 超出本 PRD 范围，已知债。
- Spec 更新判断：无新增非显而易见约定（cabinets 模板已是 exemplar），`.trellis/spec` 不改。

## Notes

- 轻量任务，PRD-only。
- 参考实现：`maimai2-cabinets.component.html` 机台下拉 option。
