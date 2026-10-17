# dxnum 别名遮蔽 + 权限分级（前端）

> 设计全文：`E:/ALL.Net/Project_LCDX_NET/.artifacts/dxnum-设计方案-v5.md`
> 前置：v4（`10-17-dxnum-alias-query`，已归档）
> 后端同批任务：`LCDXNetApi/.trellis/tasks/10-17-dxnum-alias-mask`

## Goal

`/mai2/dxnum` 不再出现具体位置名（低权限）；标题与列表一律以**别名**呈现，仅当后端下发真实位置名（权限 ≥4）时才展示位置。

## Requirements

1. 类型：`cabinet-models.ts` 的 `CabinetDxnumItem` 加 `locationVisible: boolean`（`locationName` 继续可为 null）。
2. 单台卡（`Maimai2DxnumPage.tsx`）：
   - 标题取值 `item.locationName ?? item.nickName ?? '—'`（低权限时自然落到别名）
   - `item.locationVisible` 为 true 时，标题右侧补一个别名 badge（`badge text-bg-secondary`），使「位置 + 别名」同时可见
3. 多台卡：
   - 标题取 `items[0].locationName ?? items[0].nickName ?? '—'`
   - **「位置」列按 `items.some(i => i.locationVisible)` 条件渲染**：低权限时整列不出现（第一列已是别名，避免重复列）
4. i18n：**不新增键**（沿用 `SingleTitle` / `MultiTitle` / `ColLocation`）；四份保持同步。
5. 测试（`fixture.ts` + `dxnum.spec.ts`）：
   - fixture：`user` 带上位置名；dxnum mock 按 `permission >= 4` 决定 `locationName` / `locationVisible`
   - 新增用例：P3 多台 → 页面无真实位置名、标题为别名、无「位置」列头；P3 单台 → 标题为别名；P10 → 出现真实位置名与「位置」列头
   - 既有 6 条用例保持通过（默认 `permission=10`，行为不变）

## Acceptance Criteria

- [ ] `npm run build` 通过
- [ ] `node scripts/audit-i18n.mjs` errors 为空、四份键一致
- [ ] 定向 Playwright（dxnum + guards + permissions）全绿（`test-results/lcdx-regression/` 只剩 `.last-run.json`）
- [ ] 低权限用例断言页面**不出现**具体位置名
- [ ] 保留 Bootstrap 类名风格；路径限定提交，不 push

## Notes

- 脱敏由后端完成，前端只按 `locationVisible` / `locationName` 渲染，不做权限判断。
- 执行顺序见 `implement.md`。
