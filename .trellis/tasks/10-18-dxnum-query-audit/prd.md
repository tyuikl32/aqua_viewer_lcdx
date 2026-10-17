# dxnum 查询溯源：操作记录筛选项补 dxnum-query（前端）

> 设计全文：`E:/ALL.Net/Project_LCDX_NET/.artifacts/dxnum-设计方案-v6.md` §3
> 后端同批任务：`LCDXNetApi/.trellis/tasks/10-18-dxnum-query-audit`

## Goal

`/mai2/locks`「操作记录」卡（EP-14）的 Action 下拉里能选到新的 `dxnum-query`，让用户不写 SQL 就能筛出 dxnum 查询溯源行。

## Requirements

1. `src/features/mai2/Maimai2LocksPage.tsx` 的 `ACTIONS` 常量追加 `'dxnum-query'`（建议放在列表末尾/语义位置）。
2. 不改页面其它行为；不加 i18n 键（action 是协议值，不翻译；下拉直接展示原值）。
3. 不新增类型（`RemoteLockItem.action` 已是 `string`）。

## Acceptance Criteria

- [ ] `npm run build` 通过
- [ ] 定向 Playwright（dxnum + guards + permissions）保持全绿（本任务不改页面断言）
- [ ] `node scripts/audit-i18n.mjs` errors 为空（键数不变）
- [ ] 路径限定提交，不 push

## Notes

- 后端未落库前，选 `dxnum-query` 会得到空列表，属正常。
- 执行顺序见 `implement.md`。
