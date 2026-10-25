# 技术设计 · 玩家二维码独立页面

## 1. 组件结构（重构后）

```
src/features/cards/CardQrPanel.tsx      ← 内联面板：取码 + 倒计时 + 警示 + 保存/刷新 + 自持冷却
src/pages/PlayerQrPage.tsx              ← 新页面：遍历主卡，渲染 0..N 个 CardQrPanel
src/router.tsx                          ← 新增 /mai2/playerqr
src/lib/menu.ts                         ← maimai2 分组新增 PlayerQr 项
src/pages/CardsPage.tsx                 ← 移除二维码入口
src/pages/DashboardPage.tsx             ← 移除二维码按钮
```

`CardQrModal.tsx` 与 `CardQrEntry.tsx` 删除（改内联后无调用方）。

## 2. CardQrPanel 契约

```ts
CardQrPanel({
  userName: string,     // 当前登录用户名（/lcdx/cardQr/{user} 的第一段）
  cardId: string,       // 主卡完整卡号，调用方需保证 decodeGuofuCardId 非 null
  fileName: string,     // 保存图片文件名
  autoStart?: boolean,  // true 时挂载即取码（页面用）；false 需要点按钮（保留扩展）
})
```

内部状态与既有 `CardQrModal` 完全一致：

| 状态 | 说明 |
|---|---|
| `dataUrl` | `QRCode.toDataURL` 产物，纯内存 |
| `remain` | 由 `expiresAt` 计算并钳制 `[0, 540]`，缺失回退 `expiresInSeconds` |
| `cooldownLeft` | 10 秒刷新冷却（组件内自持，面板不会再被关掉重开） |
| `errorKey` | 错误态与二维码容器互斥渲染 |

渲染结构（与原弹窗一致，只是不再包 `BModal`）：

```
[白底容器 > img 或 占位/错误]
[剩余 mm:ss]
[警示：为了您的账号安全 / 请勿传播此二维码]
[提示：对准扫码区，倒计时结束前有效]
[保存图片] [刷新（冷却时禁用并显示剩余秒）]
```

## 3. 页面结构

```
<h1 class="page-heading">玩家二维码</h1>
<alert info> 使用说明（对准机台扫码区；10 分钟内有效；请勿传播）

无卡        → alert warning「请先绑定卡片」
有卡但不可出码 → alert warning「当前卡号不支持生成登入二维码」
有可用卡    → 每张卡一块：
                <div class="mb-3 small text-secondary">主卡 (24**4430************)</div>
                <CardQrPanel autoStart ... />
```

掩码复用 `src/lib/format` 或页面内 `11001111000000000000`（与后端审计掩码一致）。

## 4. 菜单与路由

```ts
// menu.ts
{ id: 17, name: 'PlayerQr', url: 'mai2/playerqr', displayCondition: DisplayCondition.AfterLogin }

// router.tsx（mai2 子路由内）
{ path: 'playerqr', element: <PlayerQrPage />, handle: { title: 'PlayerQrPage.Title' } }
```

侧栏标签取 `t('App.Sidebar.PlayerQr')`，需在 zh/en 各加一条。

## 5. 冷却归属的变化

原设计把冷却放在「页面级」（防止关弹窗再打开绕过 10 秒）。改为内联面板后不存在「重开」动作，冷却可收进面板内部：`cooldownUntil` 状态 + `setInterval` 递减。

刷新按钮：`disabled = busy || cooldownLeft > 0`，文案 `QrRefreshCooldown`。

## 6. 兼容与回滚

- 纯前端改动，后端契约未动；回滚只需 revert 本任务提交。
- 旧书签 `/cards` 仍可访问（页面保留，只是少了二维码图标）。
- 新增 i18n key 为加法，不删旧 key（`CardsPage.Qr*` 仍被面板复用，命名保持不变，避免大改）。

## 7. 测试策略

`tests/lcdx-regression/cards-qr.spec.ts` 改写为 `player-qr.spec.ts`：

| 用例 | 断言 |
|---|---|
| 2430 主卡 | 进入后 `img[alt=玩家二维码]` 可见、`09:00 left` 可见 |
| 物理卡 | 无 `img`，出现「不支持」提示 |
| 无卡 | 出现「请先绑定」提示 |
| 94032 | 出现「操作太频繁」，且不出现「生成失败」 |
| 暗色主题 | 容器纯白、中间调 < 2%、亮度跨 0–255 |
| 侧栏 | 菜单出现「玩家二维码」且可跳转 |
