# Align merge date labels on setting page

## Goal

`/mai2/setting` 引继卡片两行日期标签等宽对齐(用户上报)。

## Change

- zh `Maimai2.Setting.MergeLastSuccessDate`:`上次成功的日期` → `上次成功引继的日期`,与 `MergeLastRequestDate`(上次请求引继的日期)同为 9 字
- 仅改值,不动 key;en 两侧本已平行(Last merge request/success date),不动

## Acceptance Criteria

- [x] 两标签等宽(9 字),冒号与日期列对齐
- [x] zh/en JSON 有效,flat key 集合一致(864/864)
