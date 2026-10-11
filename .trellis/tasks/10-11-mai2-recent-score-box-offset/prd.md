# mai2 recent 页 DX score 框右侧偏移排查

## Goal

定位 `/mai2/recent` 播放记录卡片中，内层 DX score 条（`3058/3375` + ⭐⭐）**紧贴容器右缘**这一视觉问题的根因，
给出量化证据与候选修法；**本轮只做排查，不改代码、不提交、不部署**。

## 背景

用户截图（liquefy 主题 / dark）显示：浅色内层圆角条右侧的 `3058/3375` 与 `⭐⭐` 几乎压到边框。

## 排查结论（已完成）

**是，确实偏右，且左右不对称。**

| 测量项 | 实测值 |
|---|---|
| 卡片内边缘 → 右侧 score 文本右缘 | **4 px**（= `.mx-1` 的 0.25rem） |
| 卡片内边缘 → 左侧图标左缘 | **8 px**（= `.ms-2` 的 0.5rem） |
| 内层卡片圆角 | **20 px** |
| `.row` 负 gutter 溢出 | 12 px，被 `.row > *` 的 12px padding 精确抵消（净 0） |

根因链（`Maimai2RecentPage.tsx` L221-256）：

1. 内层 `div.card.bg-secondary-subtle` **没有 `.card-body`**，而 Bootstrap 的 `.card` 自身 padding 为 0
   → 容器内部边距只能来自子元素自身。
2. 直接子级 `.row` 带 `margin-right: -12px`（`--bs-gutter-x: 1.5rem` 的一半），
   与 `.row > *` 的 `padding-right: 12px` **精确抵消**，净贡献 0。
3. 因此右侧唯一留白来源就是 `.dx-score-container` 内两个 span 的 `mx-1` → **4 px**。
4. liquefy 主题给该卡片 **20px 圆角**，4px 留白完全落在圆弧内侧，视觉上即「文字压边/太靠右」。

## Requirements

- R1 结论须有可复现的量化证据（几何测量 + 截图），不得只凭肉眼判断。
- R2 须确认是否为本地移植引入（对照 upstream React 版与 legacy Angular 版）。
- R3 本轮不修改任何生产代码；是否修、修成什么值由用户决定。

## Acceptance Criteria

- [x] AC1 给出 score 文本右缘到容器内边缘的实际像素值，并说明该值的来源（哪个类/属性）。
- [x] AC2 给出左侧对照值，判断左右是否对称。
- [x] AC3 与 upstream `main`、`legacy-angular` 分支对照，判定问题归属（本地改造 / 上游固有）。
- [x] AC4 提出候选修法（含目标留白取值建议），**已由用户拍板选定方案 A**。

## 采纳的修法（方案 A）

| 方案 | 做法 | 结论 |
|---|---|---|
| **A ✅** | 内层卡片加水平 padding：`card bg-secondary-subtle` → `card bg-secondary-subtle px-3` | **采纳**。最贴 Bootstrap 卡片语义；不动 `.row`/`.col` 结构，改动面最小 |
| B | 只调 span margin（`mx-1` → `mx-2`/`mx-3`） | 未采纳：左右仍不对称 |
| C | `.row` 改 `g-0` 或换 `d-flex` | 未采纳：会连带清掉 icons 内层 `.col` 的 padding，图标间距塌陷，需额外补偿 |

**取值 `px-3` = 1rem（16px）**，与 Bootstrap `.card-body` 默认水平内边距一致。
预期结果（推导）：右侧留白 4 → **20px**，左侧 8 → **24px**，两者均远离 20px 圆角的圆弧区。

**为什么不动 `.row` 结构**：实测已证明 `.row` 的 −12px 负 gutter 与 `.row > *` 的 12px padding
精确相消（净 0），它在这里既不产生留白也不造成偏移；而左侧 icons 内部的 `div.col` 依赖这套
padding 提供图标间距，动它必须同时补 `gap`，得不偿失。

## 目标值

- 右侧留白 ≥ 左侧的 8px（最低线）；实际取 1rem 以匹配 20px 圆角。
- 回归护栏：修改后 `scoreSpan.right` 到卡片内边缘的距离应 ≥ 16px，且不引入水平溢出。

## 实施与验证

改动（1 行）：

```diff
-                <div className="card bg-secondary-subtle">
+                <div className="card bg-secondary-subtle px-3">
```

| 验证项 | 结果 |
|---|---|
| `npm run build`（`tsc -b && vite build`） | ✅ green（唯一可用的自动化门禁） |
| `npm run lint` | ⛔ 不可用 —— 仓库无 ESLint 配置、`eslint` 非声明依赖（spec 已记载，不得声称 lint 覆盖） |
| 探针复测（1366×900，liquefy） | 右侧留白 4 → **20px**；左侧 8 → **24px**；`.row` 由溢出 +12px 变为 **−4px**（不再出界） |
| dark 主题复测 | `paddingRight: 16px`，右侧留白 **20px**，与 light 一致 |
| `shell-alignment.spec.ts` 定向回归 | ✅ 4/4 通过（`test-results/lcdx-regression/` 为空即无失败） |

对照截图：`.artifacts/score-box-card.png`（light）／`.artifacts/score-box-card-dark.png`（dark）。

> 全套 `npm run test:lcdx-regression` 在本机会在 webServer teardown 阶段挂起（已有 spec 记载），
> 故改用定向 spec + 失败产物判定。该套件亦不覆盖 `/mai2/recent`，对本次改动的回归价值主要在「未波及其它页面」。

## Notes

- 该问题**不是**本地移植引入：`Maimai2RecentPage.css` 与 upstream `main` 完全一致；
  `.tsx` 的本地差异仅涉及 `assetsHost` 改名、错误提示本地化、`vsRank` 判定修正，**布局 markup 未动**。
- 实测脚本：`.artifacts/probe-score-box.mjs`（离线运行，复用 `tests/lcdx-regression` 的 mock 约定，不触达外部服务）。
- 证据截图：`.artifacts/score-box-card.png`（现状）、`.artifacts/score-box-card-fixed.png`（右侧 1rem 对照）。
- 详细测量数据见 `research/score-box-right-offset.md`。
