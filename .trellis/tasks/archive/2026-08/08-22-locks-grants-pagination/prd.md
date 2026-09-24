# Locks page grants card pagination

## Goal

`/mai2/locks` 页卡B「机台管理授权」表格加分页：每页条数可选 10/20/100，页码切换；与既有 QQ 前缀过滤联动（过滤变化回到第 1 页）。

## Background

- EP-15（`GET lcdx/cabinet/grants/{userName}`）仅支持 `fullKeychip`/`qqNumber` 过滤参数，**无分页**，全量返回；卡B已有本地 QQ 前缀过滤（`filteredGrants` getter，前缀匹配）。
- 卡A（操作记录）为服务端分页（EP-14 `page`/`size` + `pagination-controls`）。本卡片采用**客户端分页**，复用 ngx-pagination 的 `pagination-controls` 保持两卡交互一致。
- 现状代码：`src/app/sega/maimai2/maimai2-locks/maimai2-locks.component.ts`（`filteredGrants` getter、`loadGrants()`）、`.component.html` 卡B区块（QQ 搜索行 + 表格迭代 `filteredGrants`）。

## Requirements

- 默认每页 20 条，下拉可选 10/20/100；切换条数后回到第 1 页
- `pagination-controls` 页码切换，样式参数与卡A一致（`maxSize=5 / autoHide / rotate`），单页时隐藏
- QQ 前缀过滤输入变化时回到第 1 页（避免停留在超界页码导致空表）
- 新文案走 i18n（zh/en 同步新增 `Maimai2.LocksPage.PageSize`：zh「每页条数」/ en「Per page」）
- 不改后端；不改卡A/卡C行为；吊销/新增授权后 `loadGrants()` 刷新的分页状态保持正确

## Acceptance Criteria

- [x] 卡B表格迭代分页切片（`filteredGrants` → `pagedGrants`），数据刷新后当前页/条数不越界 —— `pagedGrants` getter 切片 + `loadGrants()` 越界回位；Karma 用例（slicing / loadGrants clamp）绿
- [x] 每页条数下拉（10/20/100）切换即生效并回到第 1 页 —— `grantPageSizeChanged()` 回位；用例派发真实 DOM change 事件验证
- [x] `pagination-controls` 与卡A交互一致，单页时隐藏 —— `id="grants"` 与 paginate 管道配对（ngx-pagination 6.x 裸 controls 不渲染，见 spec 新增规则）；用例覆盖页码点击与单页隐藏
- [x] zh/en key 同步（flat 集合一致）—— 864/864，零差集
- [x] `npx tsc --noEmit -p tsconfig.app.json` 通过；locks 组件 scoped Karma 用例通过（新增分页行为用例）—— tsc exit 0；Karma 8/8（3 存量 + 5 新增）
