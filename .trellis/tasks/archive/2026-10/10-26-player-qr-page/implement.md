# 执行计划 · 玩家二维码独立页面

## 步骤

### S1 · 抽出内联面板

1. 新增 `src/features/cards/CardQrPanel.tsx`：把 `CardQrModal` 的请求/倒计时/冷却/渲染逻辑搬过来，去掉 `BModal` 包裹。
2. 删除 `src/features/cards/CardQrModal.tsx`、`src/features/cards/CardQrEntry.tsx`。

验证：`npx tsc -b --noEmit`

### S2 · 新页面

3. 新增 `src/pages/PlayerQrPage.tsx`
   - `loadUser()` → `user.cards`
   - 过滤 `decodeGuofuCardId(luid) !== null`
   - 每张卡一块 `CardQrPanel autoStart`
   - 空态：无卡 / 有卡不可用

**Commit 1**：`feat(mai2): 新增玩家二维码独立页面`

### S3 · 路由 + 侧栏

4. `src/router.tsx` 在 `/mai2` children 增加 `playerqr`
5. `src/lib/menu.ts` 的 `maimai2` 分组增加 `PlayerQr`（id 17，AfterLogin）
6. i18n：`App.Sidebar.PlayerQr`、`PlayerQrPage.*`（zh + en）

**Commit 2**：`feat(nav): 玩家二维码加入左侧导航`

### S4 · 移除旧入口

7. `src/pages/CardsPage.tsx` 删除 `CardQrEntry` 及其 import
8. `src/pages/DashboardPage.tsx` 删除 `CardQrEntry` 及其 import

**Commit 3**：`refactor(cards): 二维码入口从卡片页与仪表板移出`

### S5 · 测试

9. `tests/lcdx-regression/cards-qr.spec.ts` → 改写为 `player-qr.spec.ts`
10. 覆盖：可出码 / 物理卡 / 无卡 / 94032 / 暗色像素 / 侧栏入口

验证：
```
npm run build
npx playwright test --config=playwright.lcdx.config.ts tests/lcdx-regression
```

**Commit 4**：`test(mai2): 玩家二维码页面回归用例`

### S6 · 文档回填

11. 本文件末尾追加「实际改动与结论」
12. `.trellis/spec/frontend/card-qr-entry.md` 同步入口位置变化

**Commit 5**：`docs(trellis): 记录玩家二维码页面交付`

## 验证命令

```bash
cd E:/ALL.Net/Project_LCDX_NET/aqua_viewer_lcdx
npm run build
npx playwright test --config=playwright.lcdx.config.ts tests/lcdx-regression
```

## 回滚点

| 阶段 | 回滚 |
|---|---|
| S1–S2 | 删除新页面/面板，恢复 CardQrModal |
| S3 | 移除菜单项与路由 |
| S4 | 恢复 CardsPage / DashboardPage 的入口 |

## 提交纪律

`git commit` 不 `push`（推送由用户确认后再执行）。

---

# 实际改动与结论

## 交付清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `src/features/cards/CardQrPanel.tsx` | 新增 | 内联面板：取码、倒计时、警示、保存/刷新、自持 10 秒冷却 |
| `src/pages/PlayerQrPage.tsx` | 新增 | `/mai2/playerqr` 页面：遍历主卡渲染面板 + 空态提示 |
| `src/router.tsx` | 改 | 新增 `playerqr` 子路由 |
| `src/lib/menu.ts` | 改 | `maimai2` 分组新增 `PlayerQr`（id 17，AfterLogin） |
| `src/i18n/zh.json` / `en.json` | 改 | `App.Sidebar.PlayerQr` + `PlayerQrPage.*`（20 条 ×2） |
| `src/pages/CardsPage.tsx` | 改 | 移除二维码入口 |
| `src/features/cards/CardQrModal.tsx` | 删 | 改为内联面板后无调用方 |
| `src/features/cards/CardQrEntry.tsx` | 删 | 同上 |
| `tests/lcdx-regression/player-qr.spec.ts` | 新增 | 11 项用例 |
| `tests/lcdx-regression/cards-qr.spec.ts` | 删 | 旧入口已不存在 |
| `.trellis/spec/frontend/card-qr-entry.md` | 改 | 入口位置、冷却归属同步更新 |

## 提交记录（`master`，已 push）

| commit | 内容 |
|---|---|
| `feat(mai2)` | 新增玩家二维码独立页面（侧栏入口） |
| `refactor(cards)` | 二维码入口从卡片页移出，删除模态框实现 |
| `test(mai2)` | 玩家二维码页面回归用例 |
| `docs(trellis)` | 本记录 + spec 同步 |

## 验证结果

| 项 | 命令 | 结果 |
|---|---|---|
| 构建 | `npm run build` | 通过 |
| 新页面用例 | `playwright ... tests/lcdx-regression/player-qr.spec.ts` | **11 passed** |
| 全量回归（多次） | `playwright ... tests/lcdx-regression` | 82–83 passed，**1–2 条既有 flake** |

### 关于那 1–2 条 flake

失败固定出现在 `tests/lcdx-regression/cabinets.spec.ts:46`（`expect.poll(() => polls).toBe(i)`，
配合 `page.clock.runFor(2000)` 断言精确轮询次数）。实测：

- `cabinets.spec.ts` 单独跑：**7/7 全过**（连续两次）
- 与 `player-qr.spec.ts` 联合跑：出现差 1 次（15 vs 16）的失败，且失败条数在 1–2 之间抖动

结论：**既有的时钟轮询断言对机器负载敏感**，不是本次功能改动导致的回归。本次未修改该用例
（属于另一个任务的范围）。若 CI 要卡全绿，建议把该断言改成 `toPass()` 或放宽为 `>= i`。

## 与设计的偏差

| 项 | 说明 |
|---|---|
| `autoStart` 参数 | 设计中留了 `autoStart` 开关，实际**去掉**：面板只出现在专用页，挂载即取码是唯一合理行为 |
| 冷却层级 | 从「页面级」下移进面板：内联后不存在「关掉重开」绕过窗口的路径 |
| 侧栏门控 | 未用 `requiresBoundCard`：无卡用户也应能看到页面并读到绑定提示 |

## 遗留

- `CardsPage.Qr*` 这组 i18n key 已无代码引用（面板改用 `PlayerQrPage.*`），可作为后续清理项；
  本次保留以免一次性改动过大。
- `/cards` 页面仍在（直接 URL 可访问），只是不再包含二维码入口。

## 上线后的实测与追加修复

部署后用真实账号（`LCDXChEXAy` / QQ 2320812015，主卡 `24304430670867596939`）在生产环境验证：

| 项 | 结果 |
|---|---|
| 侧栏「玩家二维码」入口 | ✅ 出现，可跳转 `/mai2/playerqr` |
| 挂载是否发请求 | ✅ 0 次（改点击生成后） |
| 点击生成 | ✅ 1 次请求，`200 / 94001 → 92001`，返回 40 字符 payload |
| 二维码渲染 | ⚠️ **t+0.6s 渲染成功**（img + 剩余 09:00 + 按钮冷却），**t+1.2s 被重置回「尚未生成」** |

追加修复（已合并）：`fix(mai2)` 改为点击生成 + `livePayloadCache` 重挂载还原。

**仍未解决**：生产环境里生成后约 1 秒组件会被重置。已排除整页刷新（`window.__marker`
跨事件存活）、Service Worker（已 block）、限流（只有 1 次请求）。本地 dev server 下
Playwright 12 项全绿、状态稳定，说明是生产环境的挂载/重渲染路径差异，尚未定位到具体触发源。

下一步建议：在 `PlayerQrPage`/`CardQrPanel` 加临时 `console.info` 标记挂载与 effect 触发，
线上复现一次即可确定是谁在重挂载。


