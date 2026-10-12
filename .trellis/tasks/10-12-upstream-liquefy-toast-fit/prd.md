# 上游 liquefy toast 上下留白：修法设计与授权

## Goal

为上游 `RinNET-OpenSource/RinNET_frontend` 中与 LCDX fork **同源**的「单行 toast 上下留白不对称」
问题设计修法，并在**取得授权后**才动上游代码。

> 本任务当前处于**方案评审**阶段：`prd.md` + `design.md` 产出后**停下来问用户**，
> 未获批准前对上游 repo 零改动（上游工作区现状保持原样）。

## 背景

- 问题本体与 fork 完全相同：`.liquefy-toast` 的 `min-height: 4.1rem` 配上库
  `@liquefy-ui/react` 的 `.lq-alert { align-items: flex-start }`，使单行 toast 多出的高度
  **全部落到文字下方**（实测上 16 / 下 27.56px = **1.72×**，看起来像"多了一个空行"）。
- fork 已修（方案 A：`min-height` → `3.4rem`，提交 `fe6bbba`，**未推送**）；
  上游同源同代码（该规则出自上游提交 `90d8f11`，两仓为同一提交对象）。
- 上游默认主题就是 `liquefy`（`src/lib/theme.ts:24`）⇒ 该问题在上游**默认可见**；
  任何单行短文案 toast 都中（例：`ResetPasswordPage` 的「验证码发送成功。」）。

## Requirements

- R1 只在 `[data-theme='liquefy']` 作用域内改（服主口径：改动限于某主题自己的代码即可）。
- R2 **不得**改 markup；**不得**动 `src/styles/theme/contract.css` 共享令牌。
- R3 不改第三方依赖版本（跨大版本升级属大范围改动，见 `design.md` §3）。
- R4 保持上游既有设计语言：`4.1rem`（`.app-navbar` 高度、`.sidebar` 的 `top/margin-top`）是壳层行高，
  toast 当前与 navbar 同高。
- R5 上游工作区**当前有另一会话的未提交改动**（`src/features/mai2/Maimai2RecentPage.css`）⇒
  实施时必须**路径限定**提交，禁止 `git add -A`、禁止建/切分支或 stash 他人文件。
- R6 交付边界：上游侧只**本地提交**，**不 push、不开 PR**（需用户单独授权）。

## Acceptance Criteria

- [x] AC1 给出 ≥2 个候选方案，每个都附实测/源码依据与代价（`design.md` §3）。
- [x] AC2 明确推荐一个方案，并说明为何对上游最友好（含同仓既有先例）。
- [x] AC3 给出精确到行的 diff 草案与取值论证。
- [x] AC4 给出验证计划与"哪些门禁覆盖不到"的诚实说明。
- [x] AC5 给出回滚方式与提交策略（路径限定、不 push）。
- [x] AC6 **用户已选定方案**（2026-10-12）：上游采用 **B**，且 fork **同步统一为 B**。

## 决定（用户 2026-10-12）

- **上游**：方案 **B** —— 保留 `min-height: 4.1rem`，在 `[data-theme='liquefy'] .liquefy-toast` 加
  `align-items: center`（1 行 + 注释）。
- **fork**：**统一为同一实现**（把 `fe6bbba` 的 `3.4rem` 改回 `4.1rem` 并补 `align-items: center`），
  同步改写 `spec/frontend/quality-guidelines.md` 中先前"取单行自然高 3.4rem"的表述。
- 依据：同文件既有先例（`.liquefy-import-warning`）、保住 4.1rem 壳层行高节奏、无魔法数、
  对库升级幂等；详见 `design.md` §4。

## 实施结果

| 项 | 结果 |
| --- | --- |
| 变更 | 两仓同款：`align-items: center` + 英文/中文注释（上游英文、fork 中文） |
| 实测（真实源文件注入渲染，`.artifacts/probe-toast-fit.mjs`） | 两仓均 **544 × 65.59px**、上/下留白 **21.78 / 21.78（1.00×）**、单行 |
| 作用域隔离 | `data-theme=legacy` 下回到 51px（无 4.1rem 下限）+ 库默认 `flex-start` ⇒ 规则仅液化生效 |
| 门禁 | 上游/本仓 parity 与 `theme-system.spec.ts` 均不覆盖 toast 几何（见 design.md §2）；`npm run build` 未跑（需授权） |
| 交付边界 | 两仓均**仅本地提交，未 push、未开 PR** |

## Notes

- 相关前置材料：`10-11-login-success-toast-shape`（fork 侧取证全部数据）、
  `archive/2026-10/10-12-upstream-recent-score-strip-decision`（同类上游改动的先例与协作面事实）、
  `.trellis/spec/frontend/quality-guidelines.md`（服主口径与产物核验配方）。
