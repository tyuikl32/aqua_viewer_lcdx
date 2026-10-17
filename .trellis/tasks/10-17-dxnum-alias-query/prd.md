# dxnum 别名查询 + 绑卡准入 + netUpsert 统计卡（前端）

> 设计全文：`E:/ALL.Net/Project_LCDX_NET/.artifacts/dxnum-设计方案-v4.md`（§3 前端）
> 后端同批任务：`LCDXNetApi/.trellis/tasks/10-17-dxnum-alias-query`

## Goal

`/mai2/dxnum` 从「进入即列全部 + 权限组门控」改为「绑卡才可见 + 输入别名查询 + 结果覆盖式刷新」，结果区按 netUpsert 的统计卡文案重写。

## Requirements

1. **绑卡准入**：`hasBoundCard = (getCurrentUser()?.cards?.length ?? 0) > 0`。菜单项仅绑卡用户可见（**去掉 `requiredBotPermission` / `allowFromPermission` 权限组依赖**）；`RequireDxnumAccess` 同样条件，未绑卡深链跳 `/dashboard`。
2. **查询驱动**：进入页面空态（提示输入别名），不自动查询、不列机台；输入框占位含示例「如：xx」；空关键词禁用查询并在前端拦截。
3. **结果只展示当前一次查询**：新查询覆盖旧结果（保留竞态 generation 守卫）；保留 `Maimai2Pagination`（`totalItems = matchedCount`，查询变化时 page 归 1）。
4. **单台命中**（`matchedCount === 1`）展示：标题「以下是 {locationName} 实时统计」、LC 模式、半小时/1 小时/2 小时三行「X 人（共 Y 次）」、`正在上机的玩家:` 名单、`以下是两小时内游玩过的玩家：` 名单（含次数）；三窗全 0 → 「没人，快去霸机」。
5. **多台命中**（`> 1`）展示：标题「以下是 {首个 locationName} 等 N 台机台 实时统计」、三行数字（**当页合计**，文案标注「当页」）、每台一行只有别名/位置/LC/三窗数字、**页面不得出现任何玩家名字**；半小时合计 0 → 「人少，快去霸机」。
6. 未命中 → 「未找到匹配机台」；接口失败 → 降级提示。
7. i18n **四份同步**（`src/i18n/{zh,en}.json` + `public/assets/i18n/{zh,en}.json`）。

## Acceptance Criteria

- [ ] `npm run build`（`tsc -b && vite build`）通过
- [ ] `node scripts/audit-i18n.mjs` errors 为空且四份键一致
- [ ] 定向 Playwright：`dxnum.spec.ts` + `guards.spec.ts` 全绿（判据：`test-results/lcdx-regression/` 只剩 `.last-run.json`）
- [ ] 用例覆盖：无绑卡→菜单不显示且深链跳 dashboard；有绑卡→菜单出现可访问；`dw`→多台无名字；`dw1`→单台有名字与 2 小时名单；未命中提示；接口失败降级
- [ ] 保留 Bootstrap 类名风格（`card` / `table table-sm` / `badge text-bg-*`），不改写成 shadcn/Tailwind
- [ ] 路径限定提交（`git add <单文件>`，禁 `-A`，不 push）

## Notes

- `npm run lint` 不可用（无 ESLint 配置），唯一门禁是 `npm run build`。
- `.artifacts` 同域伺服（`node .artifacts/local-server.mjs`，PORT=8099）用于用户手工验收。
- `cabinets.spec.ts:29` 是既有 flaky，与本任务无关，定向回归不跑它。
- 执行顺序见 `implement.md`。
