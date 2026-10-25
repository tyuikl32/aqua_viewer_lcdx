# 机台登入二维码加固（前端）

> 来源：`10-25-card-qr-login-frontend` 交付后的冒烟测试 + 代码审查（2026-10-25）。
> 审查已用真实 Chromium 逐像素验证过「暗色主题下仍是白底黑块」（纯黑 39.3% / 纯白 60.7% /
> 中间调 0.0%，`data-bs-theme=dark` 下 `--bs-white-rgb` 仍为 255,255,255）。
> 本任务只处理审查中列出的前端项。

## Goal

修掉二维码弹窗**错误态自相矛盾**的 P1 级缺陷，消除「文案说 10 分钟、倒计时 09:00」的矛盾，
把「白底黑块」从"靠人看"升级成自动化断言，并消费后端新增的 `expiresAt`。

## Background（审查发现）

| 编号 | 问题 | 证据 |
|---|---|---|
| P1-1 | 错误态**同时**渲染「生成失败，请刷新重试」与具体原因，且指引用户去做**必然失败**的操作 | `CardQrModal.tsx:142-148` 占位分支 + `:158` `errorKey` 分支同时命中（出错时 `dataUrl=null` → `expired && dataUrl` 为假 → 落 `QrRenderFailed`）。浏览器实测 94032/94031/95001/94001 **四条路径全部**双消息；94032 时刷新按钮正处 `Refresh in 9s` 禁用态 |
| P2-1 | 文案称「10 分钟内有效」，倒计时起点是 `09:00` | `zh.json`/`en.json` 的 `CardsPage.QrHint` vs `CardQrModal.tsx:20` `COUNTDOWN_SECONDS = 540`；playwright 断言 `'09:00 left'` |
| P2-9 | 暗色主题白底黑块无自动化断言 | `implement.md` §未覆盖 自承；`themes.spec.ts` 只覆盖机台 UI，不含二维码弹窗 |
| P2-5 | 倒计时从**响应送达**起算，真实失效从服务端 `now` 起算 | 后端任务新增 `expiresAt`；前端需优先使用 |

### P1-1 复现输出（真实浏览器）

```
--- 94032 throttled ---
  visible: "Failed to render, please refresh"
  visible: "Too frequent, please try again later."
  -> placeholder "render failed" also shown: YES  <-- double message
--- 94031 not owner ---  double message: YES
--- 95001 rinnet down --- double message: YES
--- 94001 unsupported --- double message: YES
```

现有 5 条用例只断言「目标文案可见」，**不断言「通用文案不可见」**，所以测试是绿的。

## Requirements

- **R1（P1-1）错误态唯一文案**：`errorKey` 存在时，占位分支**不得**再渲染
  `QrRenderFailed`；用户只看到一条准确原因。
- **R2（P1-1）文案不得给出错误指引**：`QrRenderFailed` 从「生成失败，请刷新重试」改为
  不承诺可刷新动作的表述（94032 时刷新是被禁用的）。
- **R3（P1-1）测试要能抓住它**：新增用例必须断言「通用失败文案 `count === 0`」，
  而不只是断言具体文案可见。
- **R4（P2-1）文案与倒计时一致**：`QrHint` 不再出现「10 分钟」这类与 `09:00` 矛盾的
  具体时长，改为不带数字的表述（中英同步）。
- **R5（P2-9）暗色断言**：新增 spec，在 `colorTheme=dark` 下打开弹窗并断言
  ①容器计算样式为 `rgb(255, 255, 255)`；②渲染出的 PNG 中间调像素占比 < 2% 且亮度跨 0–255。
  覆盖至少 `legacy` 与 `liquefy` 两个主题族。
- **R6（P2-5）消费 expiresAt**：`CardQrPayload` 增可选 `expiresAt`；有则按服务端绝对时刻
  起算倒计时（钳制到 `[0, 540]`），无则回退 `expiresInSeconds`（保证与旧后端兼容）。

## Acceptance Criteria

- [ ] `94032` / `94001` / `94031` / `95001` 四种错误下，`QrRenderFailed` 文案**均不出现**
- [ ] 四种错误下具体原因文案各出现一次
- [ ] `zh.json` / `en.json` 的 `QrHint` 不再含「10 分钟 / 10 minutes」
- [ ] 暗色主题（legacy + liquefy）弹窗容器背景为 `rgb(255, 255, 255)`，PNG 中间调 < 2%
- [ ] 响应含 `expiresAt` 时倒计时按它起算；不含时回退 `expiresInSeconds`
- [ ] `npm run build` 通过
- [ ] `npx playwright test --config=playwright.lcdx.config.ts tests/lcdx-regression` 全绿（78 + 新增）

## Out of Scope

- 不改后端、不改码制、不改 `540` 这个数值（它是对的）。
- 不修审查中的 Nits（`margin: 2` 静区、`Luid.at()` 越界、`ERROR_KEYS` 语义重载）。
- 不改 `CardQrModal` 的对外 props 结构（`CardsPage` 不需改动）。
- 不 push（push `master` 会自动部署）。

## Notes

- 发布顺序：后端先上（新增 `expiresAt` 是加法，旧前端无感），前端后上。
  前端对 `expiresAt` 缺失必须优雅回退，否则会造成「前端先上」的假失败。
- 暗色断言不截图比对，直接读像素统计——既稳又不需要维护基线图。
