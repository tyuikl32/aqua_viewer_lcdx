# PRD：修复 content-pages KOP 测试夹具（届次化后未 mock current）

## 背景

KOP 页面届次化改造（标题/期间读取 `lcdx/kop/current`，届次切换读取 `lcdx/kop/tournaments` + `rank?tournamentId=`）后，
`tests/lcdx-regression/content-pages.spec.ts` 的 7 个 KOP 测试未同步更新：它们只 mock 了 `**/lcdx/kop/rank`。

页面逻辑：`selectedId = current?.tournamentId ?? list[0]?.tournamentId ?? null`。
fixture 兜底对 `/lcdx/kop/current` 返回 `ok(null)` → `selectedId=null` → rank 请求根本不发出 → 表格 0 行。

结果：6 个「KOP × family × width keeps legacy table geometry」+ 1 个「KOP still accepts envelope responses」稳定失败（期望 6 行实际 0 行）。
已用临时 worktree 在 dxnum 之前的提交 222967d 复现，确认为存量问题，与 dxnum 无关；是**测试夹具落后于页面改造**，产品行为本身合理（无届次元数据 → 无榜单）。

## 需求

修复上述 7 个测试，使其反映届次化后的页面契约：

1. KOP 相关测试 mock `lcdx/kop/current` 返回一个启用的届次（`tournamentId` 与榜单 `tournamentId: 20004` 一致）。
2. `tournaments` 列表可以不 mock（fixture 兜底 `ok(null)` → 空列表可接受；单届次不渲染切换器）。
3. 不改产品代码 `Maimai2KopRankingPage.tsx`。
4. 现有断言（行数、奖牌、几何）全部保留不动。

## 验收标准

- `npx playwright test -c playwright.lcdx.config.ts tests/lcdx-regression/content-pages.spec.ts` 全绿（20/20）。
- dxnum/guards/themes 等其他 spec 不受影响。
- 提交不含 `.workbuddy/`，不 push。
