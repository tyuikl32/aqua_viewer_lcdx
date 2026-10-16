# dxnum 前端（菜单/守卫/页面/类型/i18n/Playwright）

> PRD 全文：`E:/ALL.Net/Project_LCDX_NET/.artifacts/dxnum-设计方案-v3.md` §3/§5。
> 后端在另建任务 `LCDXNetApi/.trellis/tasks/10-16-dxnum-cabinet-stats`。

## 范围（本仓）

- [x] `src/lib/menu.ts`：`Menu` 加 `allowFromPermission?: number`；`showItem` 门控块插入放行分支（`allowFromPermission` 满足先返回 true）；菜单项 `{ id: 16, name: 'Dxnum', url: 'mai2/dxnum', displayCondition: AfterLogin, requiredBotPermission: 0, allowFromPermission: 7 }`。
- [x] `src/router.tsx`：新增 `RequireDxnumAccess`（`hasManage ∨ permission≥7`，照抄 `RequireCabinetManage` 的 loaded-deny 形状）；mai2 children 加路由 `dxnum`。
- [x] `src/features/mai2/cabinet-models.ts`：`CabinetDxnumItem`（无 fullKeychip）+ `CabinetDxnumResult`（含 `playingWindowMinutes`）。
- [x] `src/features/mai2/Maimai2DxnumPage.tsx` 新建：查询行（input+回车+查询+刷新）、表格每行一台（别名/位置/LC模式/今日/30分/1时/2时/在玩徽章）、`Maimai2Pagination`、行展开在玩名单（文案动态 `playingWindowMinutes`）、汇总行、空态、无权限兜底。骨架照抄 `Maimai2CabinetsPage.tsx`。
- [x] `npm run build` 过（tsc -b + vite build）。
- [ ] i18n 四份同步：`src/i18n/zh.json`、`src/i18n/en.json`、`public/assets/i18n/zh.json`、`public/assets/i18n/en.json`。键：`App.Sidebar.Dxnum`、`Maimai2.DxnumPage.{Title,Keyword,Placeholder,Search,Refresh,NoMatch,NoPermission,Summary,SummaryPageOnly,Playing,LoadFailed,ColCabinet,ColLocation,ColLcMode,ColPlaying}`；四窗列头复用 `Maimai2.Cabinets.{Today,HalfHour,OneHour,TwoHour}`。
- [ ] `tests/lcdx-regression/fixture.ts`：`setup()` 加可选 `hasManage` 参数（默认维持现行为不破坏既有 spec）。
- [ ] `tests/lcdx-regression/dxnum.spec.ts` 新建：P0 深链跳 dashboard / P7 且 hasManage=false 菜单出现可访问 / P3 有无授权 menu 显隐 / 接口失败降级。
- [ ] `npm run build` 过（`tsc -b && vite build`）；Playwright 定向跑 dxnum+guards spec 验证；commit（路径限定）。

## 约束

- 提交 `git add <单文件>`，禁 `-A`；不 push。
- 保留 Bootstrap 类名（`card`/`row`/`table`/`badge text-bg-*`/`page-heading`），别改写成 shadcn/Tailwind。
- 主题特有视觉修正写在该主题作用域内。
- 验证途径：`vite.config.ts` dev 代理无 `/lcdx` ⇒ 走 `.artifacts/local-server.mjs` 生产同域形态；Playwright 用 `channel:'chrome'`，定向跑单 spec，按 `test-results/lcdx-regression/` 是否为空判定，跑完 kill。
- `npm run lint` 不可用（无 ESLint 配置）⇒ 唯一门禁是 `npm run build`。
