# mai2 recent score 条：方案 A 液化作用域内边距（上游 + fork 统一）

## Goal

把 `/mai2/recent` 卡片内层 DX score 条的水平内边距，从**跨主题的 Bootstrap utility**（fork 现行的
markup `px-3`）改为**液化主题自有样式**（`[data-theme='liquefy']` 作用域），使上游与 LCDX fork 的
markup 与 CSS 回到**逐字节一致**的形态。

> 本任务处于**方案设计**阶段。`design.md` 经用户批准后才实施。

## 背景

- 问题本体：内层 `div.card.bg-secondary-subtle` 无内边距（Bootstrap `.card` 自身 padding 为 0，
  且未用 `.card-body`），叠加 `.row` 负 gutter 与列 padding 相互抵消，右侧只剩 span 的 `mx-1` = 4px；
  liquefy 主题给 `.card` **20px 圆角**（`theme/liquefy.css:593`），4px 留白被圆弧吞掉 → 视觉贴边。
- fork 已修：`10-11-mai2-recent-score-box-offset` 加了**无条件** `px-3`（右侧 4 → 20px）。
- 上游同源：`RinNET-OpenSource/RinNET_frontend` 代码与 CSS 与 fork **逐字节相同**，问题未修。
- **架构转折（2026-10-12，服主确认）**：逻辑与 UI 已分离（`theme/contract.css` 拥有 `--ui-*` 词汇，
  各主题在自己的 `data-theme` 根上实现），因此「React 版必须与 legacy Angular 逐像素一致」的
  parity 像素门禁**已退休**；服主口径是「**改的只要是这个主题自己的代码就没有问题**」。
  详见已归档任务 `10-12-upstream-recent-score-strip-decision`。

## Requirements

- **R1 视觉等价（液化主题）**：修复后在液化主题下，score 文本右缘到卡片内缘的距离 ≥ 16px
  （现行 `px-3` 实测为 20px），观感不得回退。
- **R2 作用域正确（legacy 主题）**：legacy 主题下的渲染必须**回到原状**（右侧 4px / 左侧 8px），
  即修复不得跨主题生效——这是本方案相对 `px-3` 的核心收益。
- **R3 落在主题自有代码内**：改动形态须为 `[data-theme='liquefy']` 作用域下的规则，符合服主的分层口径。
- **R4 两版一致**：完成后上游与 fork 的 `Maimai2RecentPage.tsx`（markup 部分）与
  `Maimai2RecentPage.css` 应当一致，未来 `merge upstream/main` 零冲突。
- **R5 markup 零改动**：上游侧不得修改 DOM 结构（服务端已退休的 parity、以及任何依赖结构的断言都不受影响）。
- **R6 不越界**：不新增 i18n 文案、不改业务逻辑、不触碰 chuni/ongeki（LCDX fork 冻结目录）、
  不改 `theme/contract.css` 等三主题共享的令牌。

## Acceptance Criteria

- [ ] AC1 液化主题下探针实测右侧留白 ≥ 16px，且与现行 `px-3` 结果一致（观感不回退）。
- [ ] AC2 探针在 legacy 主题对照组下实测右侧留白回到 4px（证明作用域隔离生效）。
- [ ] AC3 `npm run build`（`tsc -b && vite build`）绿；不得声称 lint 覆盖（仓库未装 eslint）。
- [ ] AC4 上游与 fork 的 markup/CSS 差异收敛为 0（除既有的 `maiAssetsHost` / i18n / `vsRank` 三处本地化 delta）。
- [ ] AC5 两仓各自提交，**不 push**（推送与 PR 需用户单独授权）。

## Out of Scope

- 左右严格对称化（现方案左 24px / 右 20px）。如需对称须另动 markup 的 `ms-2`/`mx-1`，与 R5 冲突，故不做。
- 上游 PR 流程（本任务只到本地提交；是否 push / 开 PR 由用户单独决定）。
- LCDX fork 的 parity 文件删除（取决于服主"可以扔掉"的确切范围，另议）。
