# 执行计划 · 玩家二维码 resume 接入

## 步骤

### S1 · API 封装

1. `src/lib/api/cardQr.ts`
   - `fetchCardQr(userName, cardId, resume = false)` → body `{ cardId, resume }`
   - `CardQrPayload` 增 `resumed?: boolean`

**Commit 1** 与 S2 合并。

### S2 · 面板

2. `src/features/cards/CardQrPanel.tsx`
   - `generate(resume: boolean)`
   - 挂载自动 `generate(true)`，`autoResumedRef` 守卫只跑一次
   - 刷新按钮 `generate(false)`
   - 冷却条件改为 `!resp.data.resumed`
   - 删除 `livePayloadCache` 与其还原 effect

### S3 · 测试

3. `tests/lcdx-regression/player-qr.spec.ts` 重写为 resume 语义（12 项）

验证：
```
npm run build
npx playwright test --config=playwright.lcdx.config.ts tests/lcdx-regression/player-qr.spec.ts
```

### S4 · 文档

4. 本文件补「实际改动与结论」；`.trellis/spec/frontend/card-qr-entry.md` 增 resume 约定

## 回滚

删掉挂载 effect 即可退回"点击生成"；`resume` 字段留空不影响旧后端。

## 提交纪律

`git commit`；**推送需先确认后端已部署**（否则挂载即请求会退化成每次发新码）。

---

# 实际改动与结论

## 交付清单

| 文件 | 改动 |
|---|---|
| `src/lib/api/cardQr.ts` | `fetchCardQr(..., resume)`；`CardQrPayload.resumed?` |
| `src/features/cards/CardQrPanel.tsx` | 挂载 `generate(true)`（ref 守卫）、刷新 `generate(false)`、冷却看 `resumed`、删除 `livePayloadCache` |
| `tests/lcdx-regression/player-qr.spec.ts` | 重写 12 项（resume 语义） |
| `.trellis/spec/frontend/card-qr-entry.md` | 冷却归属与 resume 约定 |

## 验证

| 项 | 命令 | 结果 |
|---|---|---|
| 构建 | `npm run build` | 通过 |
| 定向用例 | `playwright ... player-qr.spec.ts` | **12 passed** |
| 全量回归 | `playwright ... tests/lcdx-regression` | 84 passed / **1 failed** |

那 1 条失败固定是 `cabinets.spec.ts:29 › remote final poll preserves timeout`（虚拟时钟精确轮询断言，
单独跑 7/7 全过），属既有 flake，与本次无关。

## 关键行为

- 挂载请求体 `{ cardId, resume: true }`；「刷新」按钮 `{ cardId, resume: false }`。
- `resumed: true` 时**不**进入冷却（后端没消耗窗口）。
- 物理卡/无卡账号：不渲染面板 → **零请求**。

## 发布顺序（重要）

**后端必须先部署。** 前端先上线时 `resume` 会被旧后端忽略：
挂载即请求会退化成"每次都发新码"，若组件在 10 秒内重挂载就会撞 94032 ——
比改造前的"点击生成"更容易触发。

