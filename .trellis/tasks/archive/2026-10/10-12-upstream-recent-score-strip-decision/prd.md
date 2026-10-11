# 上游 RinNET_frontend recent 页 score 框偏移：调研结论与不修改决定

## Goal

记录上游 `RinNET-OpenSource/RinNET_frontend` 中与 LCDX fork 同源的「recent 页 DX score 条右侧贴边」
问题的调研结论，以及**决定不在上游实施修改**的决策依据，供日后回看与复用。

> 本任务**不含任何代码改动**（上游与本地均零改动）。它是决策与调研的归档载体。

## 背景

LCDX fork 已在 `10-11-mai2-recent-score-box-offset` 修好该问题（内层卡片加 `px-3`，右侧留白 4px → 20px）。
用户随后确认上游存在同一视觉问题，要求"先设计方案再问"，因为上游属他人仓库，需谨慎。

## 调研事实（全部实测）

### 上游现状 = LCDX fork 修复前的状态

| 项 | 实测结果 |
|---|---|
| 工作副本 | `E:\ALL.Net\RinNET_frontend`：`master` 与 `upstream/main` **0 ahead / 0 behind**，HEAD `593510f`（PR #63 squash） |
| 上游默认分支 | **`main`**（用户 fork 的是 `master`） |
| 问题代码 | `Maimai2RecentPage.tsx:221` `card bg-secondary-subtle` ／ `:241` `col ms-2` ／ `:249,252` `text-end mx-1` |
| 样式文件 | `Maimai2RecentPage.css` 与 LCDX fork **逐字节相同**（diff 为空） |
| 该文件历史 | 上游仅 2 次提交（`2a54776` React 迁移、`b512ca7` Liquefy 主题）—— **从未修过** |
| 20px 圆角来源 | `src/styles/theme/liquefy.css:593` → `[data-theme='liquefy'] .card { overflow: clip; border-radius: 1.25rem }` |
| 影响范围 | 全站 `bg-secondary-subtle` 仅 2 处，都在 recent 页（L97 展开区带 `p-1`、L221 内层卡片）→ 本问题全站唯一 |

### 决定性约束：上游有像素级 parity 套件，且覆盖 recent 页

`tests/ui-parity/mai2-recent-rating.spec.ts` 的 `recent default and expanded detail match Angular in ${theme} mode`：

- 用 **pixelmatch 逐像素比对** React(`:5173`) vs legacy Angular(`:4201`)，容差 `MAX_DIFF_RATIO = 0.005`（**0.5%**）
- **像素比对只在 `family='legacy'` 下执行**；液化主题那条测试（该文件 L540）**只做功能断言**
  （`data-theme=liquefy`、`.recent-rank-icon` 的 `right/bottom: 5.6px`、collapse 展开、只读无写请求）
  → **不做像素比对**
- legacy 基线产物来自 `../aqua_viewer/dist/aqua-viewer/browser`（可用 `LEGACY_DIST_DIR` 覆盖）
- **本机没有 `E:\ALL.Net\aqua_viewer`** → parity 在本机跑不起来，影响只能推理、**无法实测**
- 上游组织 `RinNET-OpenSource` 的仓库只有 `RinNET_frontend` / `.github` / `RinNET_backend` /
  `StarResonanceDps` —— **没有 `aqua_viewer`** ⇒ legacy Angular 源不在公开组织下 ⇒ **无法"双改"**

**推论**：parity 判的是「React 版是否与 legacy Angular 版逐像素一致」。单边给 React 加 16px 内边距会
系统性破坏该一致性，**报的是"不同步"，不是"改坏了"**。容差按整页像素占比算
（1280×720 ≈ 92 万 px，0.5% ≈ 4,600 px），位移 16px 使旧/新位置各留数千像素差异，两张卡片累计大概率越线。

### 上游协作面

- `pull_request_creation_policy: all`（任何人均可提 PR）；**无 PR/issue 模板**（`.github` 只有 `profile/`）
- CI `deploy-test-server.yml` 只在 **`next` 分支 push** 或手动触发 → **PR 不跑任何测试**，仅 `npm ci + npm run build` + 部署
- 上游 `npm run lint` 存在但**同样未装 eslint**（devDeps 无 eslint、无配置文件）→ 与 LCDX fork 同一情况
- open issues 仅 1 条（#57 handleErrorResponse），与本问题无关 → 若提报不会重复

## 候选方案（未实施）

| | 改动 | parity（legacy 像素比对） | 与 fork 同步 |
|---|---|---|---|
| **A** | CSS-only：`[data-theme='liquefy'] .maimai2-recent-page .card.bg-secondary-subtle { padding-inline: 1rem }`，**markup 零改动** | **不影响** → 维护者本地仍绿 | 需把 fork 的 `px-3` 改成同款，或保留差异 |
| B | markup 加 `px-3`（与 fork 现状完全一致） | **大概率红**（单边改变基线） | **零冲突** |
| C | markup 加语义类名 `recent-score-strip` + 同样的 liquefy-scoped CSS | 同 A（安全） | 需两版都调整 |

方案 A 被评估为对上游最友好：零 markup 改动、零 parity 风险，且**问题本身只在液化主题成立**
（legacy 默认圆角约 6px，4px 留白无观感问题），修正只作用于液化主题属对症。

## 决定

**不修改上游**（用户 2026-10-12 决定："归档吧，不改了"）。

- 上游工作副本保持原样：`593510f`，working tree 干净，**未产生任何本地改动、未建分支、未提交、未开 PR/issue** ✓
- 方案 A 作为**备查方案**保留在本记录中；若日后需要，可直接依此实施
- LCDX fork 已修好的实现（无条件 `px-3`）**保持不变**；两者的一致性差异（1 行）待未来上游同步时再处理

## 影响 / 残留

- 上游 recent 页在液化主题下的「score 条右侧贴边」观感问题**继续存在**，修复方案已就绪但未提交。
- 本记录同时产出一条可复用约束（已写入 `.trellis/spec/frontend/quality-guidelines.md`）：
  上游的 parity 套件是**活跃**的，任何要回流上游的样式改动都必须一并考虑 legacy Angular 基线。

## Acceptance Criteria

- [x] AC1 上游现状（代码、文件历史、圆角来源、影响范围）有实测证据。
- [x] AC2 parity 约束与"只在 legacy family 做像素比对"这一关键事实有源码依据。
- [x] AC3 给出可选方案与各自代价，并说明为何 A 对上游最友好。
- [x] AC4 记录"不修改"的决定与零改动证据（worktree 干净、HEAD 未变）。
- [x] AC5 可复用约束回写 spec。
