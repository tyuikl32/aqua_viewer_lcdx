# Fix locks audit card pagination controls not rendering

## Goal

修复 `/mai2/locks` 卡A「操作记录」翻页控件不渲染的既有 bug；顺带清理两卡的无效 `[rotate]` 输入。

## 根因

ngx-pagination 6.x 中 `pagination-controls` 没有 `totalItems` 输入，页码只从 `paginate` 管道按同 `id` 注册的 `PaginationInstance` 读取。卡A 的 controls 是裸写法（无 id、无配对管道）→ `pages=[]` → `autoHide` 下整个控件静默不渲染。卡B（08-22-locks-grants-pagination 任务）已用 `id="grants"` 管道+controls 配对模式修复，规则已录入 `.trellis/spec/frontend/quality-guidelines.md`。

## Requirements

- 卡A 为**服务端分页**（EP-14：`locks` 是当前页切片、`total` 是服务端总数），管道走 server 模式：`@for (lock of locks | paginate: {id: 'locks', itemsPerPage: pageSize, currentPage: page, totalItems: total}; ...)`，`totalItems !== 切片长度` 时管道原样透传集合，仅注册控件状态
- 卡A `pagination-controls` 加 `id="locks"`；两卡移除不存在的 `[rotate]` 输入
- 翻页行为不变：点击页码 → `pageChanged()` → `loadLocks()` 携带 `page` 参数重查
- 新增 Karma 用例：卡A 控件在 `total > pageSize` 时渲染、页数 = ceil(total/size)、点击页码触发 `pageChanged`
- 不改卡B 行为、不改组件 TS 逻辑（纯模板修复 + 测试）

## Acceptance Criteria

- [x] 卡A 翻页控件可见（total=100、size=20 → 5 页），点击页码 `page` 正确更新并触发重查 —— Karma 用例断言锚页码 2..5、点击 page 3 后 `page===3`（DOM dump 确认 "1 / 5" 指示与链接渲染）
- [x] 卡B 现有 8 个用例不回归 —— 9/9 全绿（8 存量 + 1 新增）
- [x] 两卡模板不再含 `[rotate]` —— 已移除并更新 spec 条目（原「已知隐患：卡A」改为修复记录）
- [x] `npx tsc --noEmit -p tsconfig.app.json` 通过；locks scoped Karma 全绿 —— tsc exit 0；TOTAL: 9 SUCCESS
