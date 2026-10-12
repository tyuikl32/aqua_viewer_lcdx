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

## 实施与验证

改动：fork `6e82ad0`（`Maimai2RecentPage.tsx:221` 去 `px-3` 1 行 + `Maimai2RecentPage.css` 加液化规则 7 行）；
上游 `a46f9fd`（仅 CSS 7 行）。

### 探针实测（`.artifacts/probe-score-box.mjs`，本次新增 legacy 对照组）

| 主题 | padding-inline | 卡片圆角 | 右侧留白 | 左侧留白 | `.row` 相对卡片内缘 |
|---|---|---|---|---|---|
| liquefy | 16px / 16px | 20px | **20px** | 24px | −4px |
| legacy | 0px / 0px | 6px | **4px** | 8px | +12px |
| liquefy + dark | 16px / 16px | 20px | **20px** | — | — |

⇒ 液化主题与改前 `px-3` **数值完全一致**（换实现不换观感）；legacy 主题回到原状，
且 `padding-inline` 实测为 `0px`，证明液化作用域规则**确未跨主题生效**。

### 构建门禁

- **fork**：`npm run build` ✅ green。
- **上游**：⛔ **本机无法构建**，且与本改动无关 —— `node_modules` 严重错配
  （实装 `typescript@5.0.4` vs 声明 `^7.0.2`；`vite@4.5.5`），`tsc -b` 在 **tsconfig 选项解析阶段**
  即报 `TS5023 Unsupported compiler option 'noUncheckedSideEffectImports'` / `TS6046 target ES2023`，
  `npx vite build` 亦在模块解析阶段崩溃。失败信息全部落在配置/依赖层，**任何源文件都还没被读取**，
  而本次改动是纯 CSS。替代证据：该 CSS 与 fork **逐字节相同**，已在 fork 侧完成渲染验证。

### 一致性核对

- `Maimai2RecentPage.css` 两仓 **byte-identical** ✓
- markup：`bg-secondary-subtle px-3` 两仓均 **0 命中** ✓
- TSX 剩余差异仅为既有 3 类本地化 delta（`assetsHost`→`maiAssetsHost`、错误提示本地化、`vsRank` 判定）✓

### 越界检查

- 改动文件仅 `Maimai2RecentPage.css`（+ fork 的 `.tsx`）；`theme/contract.css`、`theme/liquefy.css`
  及其它主题/页面**均未触碰** ✓
- 邻近的液化规则 `recent-rank-icon { right/bottom: 0.35rem }` 未变 ⇒ 上游 parity 中那条
  `toHaveCSS('right', '5.6px')` 断言仍成立 ✓
- 新规则在该页只出现 1 次、位置紧随液化规则组，未误伤 L97（该处 `bg-secondary-subtle` 不带 `card` 类）✓

### 上游推送与 PR（2026-10-12 晚，用户授权后执行）

`a46f9fd` 的描述经用户同意后**改写**（未 push 过，改写安全）：去掉对上游无意义的
「the LCDX fork」与已不成立的本机 node_modules 说明，换成真实的三主题实测数据。
手法：`tag` 保护后继提交 → `reset --hard` → `commit --amend -F` → `cherry-pick` 接回
⇒ `a46f9fd → 5e9d287`、`158c4d5 → 00f7d5a`（作者与原始时间戳保留）。
**内容零变化**已用 `git diff <旧> <新>` 双验证（均为空）。

- 分支 `fix/liquefy-toast-and-score-strip` → push 到 fork（XaviorShen）
- **PR #64**：https://github.com/RinNET-OpenSource/RinNET_frontend/pull/64
  （`fix/liquefy-toast-and-score-strip → main`，OPEN，2 files +12 −0，2 commits）
  ⚠️ 该 PR 同时包含另一会话的 toast 修复（`00f7d5a`），二者同为液化主题间距修正，故合并为一个 PR。
- fork 本地 `master` **未** push（保持与 upstream 同步）

## Acceptance Criteria

- [x] AC1 液化主题下探针实测右侧留白 20px（≥ 16px），与改前 `px-3` 一致（观感不回退）。
- [x] AC2 legacy 对照组实测右侧留白回到 4px、`padding-inline: 0px`（作用域隔离生效）。
- [x] AC3 fork `npm run build` 绿；上游因本机依赖错配无法构建（已论证与本改动无关）；
      lint 不可用，未声称覆盖。
- [x] AC4 两仓 CSS byte-identical；markup 差异收敛为 0（仅剩既有 3 处本地化 delta）。
- [x] AC5 两仓各自提交（fork `6e82ad0` / 上游 `a46f9fd`→`5e9d287`）；上游已于 2026-10-12
      推送分支并开 **PR #64**（见上节）；fork 本地 master 未 push（无需）。

## Out of Scope

- 左右严格对称化（现方案左 24px / 右 20px）。如需对称须另动 markup 的 `ms-2`/`mx-1`，与 R5 冲突，故不做。
- 上游 PR 流程（本任务只到本地提交；是否 push / 开 PR 由用户单独决定）。
- LCDX fork 的 parity 文件删除（取决于服主"可以扔掉"的确切范围，另议）。
