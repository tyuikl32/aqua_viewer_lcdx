# 执行计划 · 卡片页机台登入二维码（前端）

## 依赖与顺序

**后端 `LCDXNetApi` 的同名任务必须先上线**（或至少先合并）。否则旧码放宽会让引继入口出现「能点必失败」。本任务可先在后端已具备 `POST lcdx/cardQr` 的前提下开发。

## 步骤

### F1 · 判定模块放宽

1. `src/lib/guofuCard.ts`
   - 新增 `decodeGuofuCardId(card): number | null`
   - `isGuofuCardNumber` 改为 `decodeGuofuCardId(...) !== null`
   - 更新文件头注释（旧码不再「刻意不放行」）

验证：`npx tsc -b --noEmit`

**Commit 1**：`feat(lib): 卡号判定支持旧码段（243044306799）`

### F2 · API 与错误码

2. `src/lib/api/cardQr.ts`（新增）
   ```ts
   export async function fetchCardQr(userName: string, cardId: string)
   ```
3. `src/lib/models.ts` — `StatusCode` 增 `CARD_QR_TOO_FREQUENT = 94032`

**Commit 2**：`feat(api): 新增卡号登入二维码请求封装`

### F3 · 弹窗组件

4. `src/features/cards/CardQrModal.tsx`（新增）
   - props: `{ open, userName, card, onClose, onGenerated }`
   - 请求 → `QRCode.toDataURL` → 倒计时 → 失效态
   - 白底容器、警示文案、刷新/保存按钮
   - `cancelled` 守卫

**Commit 3**：`feat(cards): 新增机台登入二维码弹窗`

### F4 · 卡片页入口

5. `src/pages/CardsPage.tsx`
   - `ModalState` 增 `{ kind: 'qr'; card: Card }`
   - 主卡卡片操作区增二维码按钮（仅 `decodeGuofuCardId(card.luid)` 非空）
   - 页面级 10 秒冷却状态

**Commit 4**：`feat(cards): 卡片页接入登入二维码入口`

### F5 · 文案

6. `src/i18n/zh.json` / `en.json` 增 `CardsPage.Qr*`（12 条）

**Commit 5**：`i18n: 补充机台登入二维码文案`

### F6 · 引继入口回归

7. `tests/lcdx-regression/settings.spec.ts`
   - 「legacy CN card scheme」用例断言反转：改为**显示**引继入口
   - 新增：物理卡仍隐藏、无卡仍隐藏（已有，确认不回归）
8. `src/features/mai2/Maimai2SettingPage.tsx` 注释同步

**Commit 6**：`test(lcdx): 旧码卡引继入口改为可见`

### F7 · 全量校验

```
npm run build
npx playwright test --config=playwright.lcdx.config.ts tests/lcdx-regression/settings.spec.ts
```

判定方式沿用仓库既有约定：`test-results/lcdx-regression/` 为空 ⇔ 通过。

**Commit 7**（如有）：`test(cards): 覆盖二维码入口可见性`

### F8 · 文档回填

9. `implement.md` 末尾追加「实际改动与结论」
10. `.trellis/spec/frontend/` 若产生新知识则追加

**Commit 8**：`docs(trellis): 记录卡号二维码前端交付`

## 验证命令汇总

```bash
cd E:/ALL.Net/Project_LCDX_NET/aqua_viewer_lcdx
py -3 ./.trellis/scripts/task.py current --source
npm run build
npx playwright test --config=playwright.lcdx.config.ts tests/lcdx-regression/settings.spec.ts
```

## 回滚点

| 阶段 | 回滚 |
|---|---|
| F1 | 单独 revert；引继门控回到只认新码 |
| F2–F5 | 纯新增，revert 后卡片页回到无按钮状态 |
| F6 | 与后端同步回退，避免「能点必失败」 |

## 提交纪律

- 一律 `git commit`，**不 push**（push `master` 会自动部署）。
- 不用 `--amend`。
- 只提交本任务产生的文件。

---

# 实际改动与结论

## 交付清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `src/lib/guofuCard.ts` | 改 | 新增 `decodeGuofuCardId`（新码+旧码+区间校验）；`isGuofuCardNumber` 改为「能解出 cid」 |
| `src/lib/api/cardQr.ts` | 新增 | `fetchCardQr(userName, cardId)` |
| `src/lib/models.ts` | 改 | `StatusCode.CARD_QR_TOO_FREQUENT = 94032` |
| `src/features/cards/CardQrModal.tsx` | 新增 | 二维码弹窗：白底黑块、540s 倒计时、失效态、保存/刷新 |
| `src/pages/CardsPage.tsx` | 改 | 主卡二维码入口 + 页面级 10 秒冷却 + 弹窗挂载 |
| `src/i18n/zh.json` / `en.json` | 改 | 新增 `CardsPage.Qr*` 15 条 |
| `tests/lcdx-regression/settings.spec.ts` | 改 | 旧码卡引继断言由「隐藏」反转为「显示」 |
| `tests/lcdx-regression/cards-qr.spec.ts` | 新增 | 5 项：入口可见性、弹窗渲染与倒计时、94032、94001 |
| `.trellis/spec/frontend/card-qr-entry.md` | 新增 | 入口约定与 6 条易错规则 |

## 提交记录（`master`，未 push）

| commit | 内容 |
|---|---|
| `e77960a` | feat(lib): 卡号判定支持旧码段并导出解码结果 |
| `5eb70e2` | feat(api): 新增卡号登入二维码请求封装与 94032 错误码 |
| `ff9b244` | feat(cards): 卡片页接入机台登入二维码 |
| `633f4cc` | test(lcdx): 旧码卡引继改为可见，并覆盖二维码入口可见性 |

## 验证结果

| 项 | 命令 | 结果 |
|---|---|---|
| 构建 | `npm run build`（`tsc -b && vite build`） | **通过**，仅保留既有 chunk size 提示 |
| 新增用例 | `npx playwright test --config=playwright.lcdx.config.ts tests/lcdx-regression/cards-qr.spec.ts` | **5 passed** |
| 全量回归 | `npx playwright test --config=playwright.lcdx.config.ts tests/lcdx-regression` | **78 passed / 0 failed** |

关键回归点：`settings.spec.ts` 的「merge entry is shown for the legacy CN card scheme」已随
后端放宽生效；物理卡与无卡仍不渲染引继入口。

## 与设计的偏差

| 项 | 说明 |
|---|---|
| 冷却状态 | 设计写「页面级」，实现一致；额外让弹窗接收 `cooldownLeft` 以禁用刷新按钮并显示倒计时 |
| 94032 也进入冷却 | 后端除 `94001` 外的请求都占用 10s 窗口，因此收到 `94032` 时同样开始冷却，避免连续撞墙 |
| `Maimai2SettingPage.tsx` | 未改：原有注释（「镜像后端 `TryConvertCardIdToUserId`」「非国服卡不渲染」）在放宽后依然准确 |

## 未覆盖 / 已知边界

- 未在真机（机台扫码相机）验证扫码结果；前端只保证码的**内容与样式**正确。
- 暗色主题下的白底效果由 CSS 强制，未加自动化截图断言；`themes.spec.ts` 覆盖的是既有页面。
- 二维码图片为 `dataURL`，允许长按/下载保存（按产品要求，配「请勿传播」警示）。

