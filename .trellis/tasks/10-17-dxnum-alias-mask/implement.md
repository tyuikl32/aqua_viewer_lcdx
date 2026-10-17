# 实施清单（前端）

1. `src/features/mai2/cabinet-models.ts`
   - `CabinetDxnumItem` 加 `locationVisible: boolean`
2. `src/features/mai2/Maimai2DxnumPage.tsx`
   - `SingleCabinetCard`：标题右侧条件渲染别名 badge（`item.locationVisible && <span className="badge text-bg-secondary ms-2">{item.nickName}</span>`）
   - `MultiCabinetCard`：`const showLocation = items.some((i) => i.locationVisible);` → 表头与单元格条件渲染
   - 标题取值保持 `?? nickName ?? '—'` 回退链
3. `tests/lcdx-regression/fixture.ts`
   - `user` 增加位置名（如 `LocA` 的既有 mock 已含 locationName，确认 dxnum mock 的取值受 permission 控制）
   - `dxnumResponse(...)` 增加 permission 维度：`permission >= 4` → 每台 `locationVisible: true` + 真实 `locationName`；否则 `locationName: null` + `locationVisible: false`
4. `tests/lcdx-regression/dxnum.spec.ts`
   - 新增：`P3 hides the concrete location and falls back to the alias`（多台 + 单台两条断言，含「位置」列头不出现）
   - 新增或扩展：`P10/P4 shows the concrete location`（出现位置名与「位置」列头）
   - 既有用例回归
5. 验证：`npm run build` → `node scripts/audit-i18n.mjs` → 定向 Playwright（dxnum + guards + permissions，用 Start-Process + WaitForExit + Kill 包裹）
6. 提交：先实现后测试，路径限定 `git add`（不 push）
