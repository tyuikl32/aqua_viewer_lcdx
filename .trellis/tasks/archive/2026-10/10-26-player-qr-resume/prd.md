# 玩家二维码 resume 接入（刷新回到同一枚码）

> 中等任务（frontend-only）。改 1 个 API 封装 + 1 个面板组件 + 重写回归用例。
> 后端对应任务：`LCDXNetApi/.trellis/tasks/10-26-card-qr-issue-cache`。

## Goal

打开「玩家二维码」页就显示**上一次那枚码**（不换新、不报 94032）；只有用户点「刷新」才发新码。

## Background

- 后端新增 `resume` 字段：`resume=true` 时若服务端还存着未过期（剩余 ≥60s）的发行记录，
  就按原发行分钟重算出**同一枚** payload，并返回原始 `expiresAt`；不频控、不写审计。
- 详情：payload 是 `(cid, 分钟)` 的确定性函数，所以服务端只需记住发行时刻。
- 现状痛点：页面一刷新组件状态清零，用户得再点一次；而 10 秒频控会让重开页面后的请求直接 94032。

## Requirements

- **R1** `fetchCardQr(userName, cardId, resume)`：请求体带 `{ cardId, resume }`；响应类型补 `resumed?: boolean`（旧后端不返回）。
- **R2** 面板挂载后**自动**以 `resume: true` 拉一次，命中即渲染同一枚码，倒计时按服务端 `expiresAt` 走。
- **R3** 「刷新」按钮固定用 `resume: false`，仍然受 10 秒冷却约束。
- **R4** 冷却判定改为看服务端语义：只有 `resumed !== true`（真的发了新码）才进入冷却；
  复用旧码不占后端窗口，不该禁用按钮。
- **R5** 删除上一轮加的模块级 `livePayloadCache`（服务端已是权威，前端不再自持第二份状态）。
- **R6** 旧后端兼容：`resume` 被忽略 → 每次都会发新码，页面仍可用。
- **R7** 回归用例覆盖：挂载发 resume、刷新发 fresh、物理卡不发请求、错误码单条文案、暗色像素。

## Acceptance Criteria

- [ ] 进入页面自动渲染二维码 + 倒计时，无需点击
- [ ] 挂载请求体为 `{ cardId, resume: true }`
- [ ] 「刷新」请求体为 `{ cardId, resume: false }`
- [ ] 服务端返回 `resumed: true` 时不进入冷却（按钮可用）
- [ ] 物理卡/无卡账号不发起 `cardQr` 请求
- [ ] `npm run build` 通过；`player-qr.spec.ts` 全绿

## Out of Scope

- 不改后端（另仓任务）
- 不做多卡切换、不做离线缓存
