# 技术设计 · 玩家二维码 resume 接入

## 1. 请求侧

```ts
fetchCardQr(userName, cardId, resume = false)
  → POST lcdx/cardQr/{user}  { cardId, resume }
```

`CardQrPayload` 增 `resumed?: boolean`（旧后端不返回 → `undefined`）。

## 2. 面板状态机

```
挂载 ──generate(true)──▶ loading ──92001──▶ ready（倒计时按 expiresAt）
                                   │
                                   └─94001/31/32/95001──▶ error

点「刷新」──generate(false)──▶ loading ──▶ 同上；期间按钮禁用（10s 冷却）
```

- 挂载只触发一次：`autoResumedRef` 守卫（StrictMode 双调用 / 重复渲染不重复请求）。
- 冷却只由「真的发新码」触发：`if (!resp.data.resumed) setCooldownUntil(now + 10s)`。
  旧后端 `resumed` 为 undefined → 视为发新码 → 保持原有冷却行为。

## 3. 删除模块缓存

上一轮的 `livePayloadCache`（模块内存，抗重挂载）被移除：

- 现在服务端持有权威发行记录，重挂载/刷新都会以 `resume:true` 拿回同一枚；
- 前端自持第二份状态会与后端不一致（例如后端已判定剩余不足 60s 而发新码，前端却还在显示旧的）。

## 4. 兼容矩阵

| 前端 | 后端 | 行为 |
|---|---|---|
| 新 | 新 | 挂载 resume 命中 → 同一枚；刷新换新 |
| 新 | 旧 | `resume` 被忽略 → 每次发新码（受频控）；页面可用 |
| 旧 | 新 | 不传 resume（默认 false）→ 与改造前一致 |
| 旧 | 旧 | 不变 |

**发布顺序建议：后端先上**。前端先上时，"挂载即请求"会退化为"每次都发新码"，
若组件在 10 秒内重挂载会撞 94032（比点击生成更容易触发）。

## 5. 测试

`player-qr.spec.ts` 重写为 12 项，核心变化：

- 挂载即渲染（不再点「生成」）；
- 断言请求体 `{ resume: true }`；
- 点「刷新」断言请求体 `{ resume: false }`；
- `resumed: true` 时不进入冷却（按钮仍可用）；
- 物理卡 / 无卡：**零请求**；
- 四个错误码单条文案；
- 暗色像素（legacy + liquefy）。
