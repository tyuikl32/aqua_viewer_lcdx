# 实施清单（前端）

1. `src/lib/menu.ts`
   - `Menu` 接口增加 `requiresBoundCard?: boolean`；`showItem` 内新增判定：`if (item.requiresBoundCard && !hasBoundCard()) return false;`
   - 判定用 `getCurrentUser()?.cards?.length > 0`（`src/lib/user.ts` 的 `userStore`，`User.cards` 见 `src/lib/models.ts:151`）；注意 `menu.ts` 目前只依赖 `botPermission`，新增 import 后确认无循环依赖
   - dxnum 菜单项（id 16）改为 `{ id: 16, name: 'Dxnum', url: 'mai2/dxnum', displayCondition: DisplayCondition.AfterLogin, requiresBoundCard: true }` —— **删除** `requiredBotPermission: 0` 与 `allowFromPermission: 7`
   - 检查 `allowFromPermission` 是否还有其他使用者；没有则同步删除该字段与放行分支（保持最小实现；若删字段影响面大，可保留字段但 dxnum 不再使用，并在提交信息里说明）
2. `src/router.tsx`
   - `RequireDxnumAccess` 改为绑卡判定（`cards.length > 0`）；未绑卡 → `<Navigate to="/dashboard" replace />`（沿用既有守卫形状与注释风格）；路由与 `handle.title` 不变
3. `src/features/mai2/cabinet-models.ts`
   - `CabinetDxnumItem` + `recentPlayers: PlayerPlayCount[]`、+ `namesHidden: boolean`；新增 `export interface PlayerPlayCount { userId: number; userName: string; plays: number }`
4. `src/features/mai2/Maimai2DxnumPage.tsx`（结果区重写）
   - 状态：`keyword`（输入框）、`submittedKeyword`（已提交）、`result`、`page`、`loading`、`error`
   - 查询行：`form-control` + 回车提交 + 查询按钮（`submittedKeyword.trim()===''` 时禁用）+ 刷新按钮（重发 `submittedKeyword`）
   - 初次进入：只显示空态提示（i18n `Hint`），不请求
   - 请求：`lcdx.get('lcdx/cabinet/dxnum/' + username, { keyword: submittedKeyword, page, pageSize })`（沿用现有调用与 `isOk(resp)` 判定、`notice()` 报错、generation 竞态守卫）
   - 渲染：
     - `matchedCount === 0` → `NoMatch`
     - `matchedCount === 1` → 单台卡（标题/LC/三行/在玩名单/2 小时名单/口号）
     - `matchedCount > 1` → 多台卡（标题含数量 + 当页合计三行 + 每台一行数字；**不渲染任何 userName**）
   - 分页：`Maimai2Pagination`（`current=page`、`pageSize`、`totalItems=matchedCount`、`onPageChange`）
5. i18n 四份（`src/i18n/{zh,en}.json`、`public/assets/i18n/{zh,en}.json`）按设计 §3.3 增删键，四份结构必须一致
6. `tests/lcdx-regression/fixture.ts`
   - `setup()` 增加可选参数控制绑卡（例如第 5 个参数之后追加 `cards: 'bound' | 'none' = 'bound'`，或改为配置对象；**必须保证既有 spec 的默认行为不变**）
   - `api/user/me` 的返回按该参数给 `cards`（`bound` → 至少一张 `{ id, extId, luid, default: true }`；`none` → `[]` 且无 `defaultCard`）
   - dxnum mock 按 `keyword` 分流：`dw` → matchedCount=2、两台、`namesHidden: true`、`playing: []`、`recentPlayers: []`；`dw1` → matchedCount=1、单台含 `playing` 与 `recentPlayers`；其他 → matchedCount=0
7. `tests/lcdx-regression/dxnum.spec.ts` 重写为 PRD 验收里的 6 条用例
8. 验证：`npm run build` → `node scripts/audit-i18n.mjs` → 定向 Playwright（`dxnum.spec.ts guards.spec.ts`，用 `Start-Process` + `WaitForExit` + `Kill` 包裹，判据看 `test-results/lcdx-regression/`）
9. 提交：按文件分组路径限定 `git add` + commit（不 push）
