# 技术设计：方案 A —— 液化作用域内边距

## 1. 选型结论

**采用方案 A**：在页面样式文件里，用 `[data-theme='liquefy']` 作用域给内层 score 卡片补水平内边距；
markup 保持上游原样（fork 侧的 `px-3` 回退掉）。

### 为什么是 A，而不是 B / C

| 方案 | 处置 | 判定 |
|---|---|---|
| **A ✅** | CSS-only，`[data-theme='liquefy']` 作用域 | 改动落在**服主所说的「这个主题自己的代码」**里；不碰 markup；legacy 主题回到原状 |
| B | markup 加 `px-3` | parity 门禁虽已退休，但它把液化主题的视觉修正**铺到所有主题**（legacy 也被内缩 16px），最小作用域原则不成立 |
| C | markup 加语义类名 `recent-score-strip` + 同样 scoped CSS | 选择器更稳，但**必须改 markup**，与 R5 冲突；收益不足以抵消代价 |

### 决定性依据：本文件里已有同构先例

`Maimai2RecentPage.css` 现有一处液化条件规则，解决的是**同一类问题**（液化圆角 → 内容贴边）：

```css
/* Liquefy's rounded cards clip overflow, so keep the rank badge clear of their curved edge. */
[data-theme='liquefy'] .maimai2-recent-page .recent-rank-icon {
  right: 0.35rem;
  bottom: 0.35rem;
}
```

方案 A 与它**形态完全一致**（同样是"液化主题下把内容从圆角边挪开"）。这不是新发明的做法，
而是沿用本文件已经确立的模式——也正是服主口径的直接体现。

## 2. 精确改动

### 2.1 LCDX fork（`E:\ALL.Net\Project_LCDX_NET\aqua_viewer_lcdx`）

**(a) 回退 markup 的 `px-3`** —— `src/features/mai2/Maimai2RecentPage.tsx:221`

```diff
-                <div className="card bg-secondary-subtle px-3">
+                <div className="card bg-secondary-subtle">
```

**(b) 在 `src/features/mai2/Maimai2RecentPage.css` 追加规则**（放在现有液化规则之后，同类聚合）

```css
/* Liquefy's 20px card radius swallows the 4px this strip leaves on each side,
   so give it the horizontal padding a card body would have. */
[data-theme='liquefy'] .maimai2-recent-page .card.bg-secondary-subtle {
  padding-inline: 1rem;
}
```

### 2.2 上游（`E:\ALL.Net\RinNET_frontend`）

只做 **(b)** 一项——上游 markup 本来就没有 `px-3`。改动后两仓该文件（CSS 与 markup 部分）收敛一致。

## 3. 取值论证：为什么 `padding-inline: 1rem`

- 净效果推导：`1rem`(16px) 经 `.row` 的 −12px 负 gutter 与 `.row > *` 的 12px padding 相消后**全额生效**，
  即内容盒左右各内缩 16px。
- 叠加既有 margin 后：**右侧 4 + 16 = 20px**，**左侧 8 + 16 = 24px**。
- 该值同时与 Bootstrap `.card-body` 的默认水平内边距一致，有据可依（无 `.card-body` 的卡片补上它的等价内边距）。
- 现状对照：fork 的 `px-3` 实测右侧 20px / 左侧 24px —— **本方案在液化主题下应产出完全相同的数值**，
  即"换实现不换观感"。这正是 AC1 要验证的。

## 4. 选择器取舍

选择器 `.card.bg-secondary-subtle`（在页面类 + 液化主题前缀下）：

- **命中唯一且准确**：该页 `bg-secondary-subtle` 只有两处——
  L97 是 `dx-rating-container p-1 bg-secondary-subtle mt-1`（详情区小格，**不含 `card` 类**，不会被误伤），
  L221 是 `card bg-secondary-subtle`（目标）。加 `.card` 限定后指向明确。
- **特异性充足**：`(0,4,1)`，高于 `theme/liquefy.css` 的 `[data-theme='liquefy'] .card`（`(0,2,1)`）；
  且后者只设 `overflow: clip; border-radius`，与 `padding-inline` 无冲突。
- **符合 scoped 要求**：规则以页面类 `.maimai2-recent-page` 为前缀，满足 spec「新 CSS 必须 scoped」。
- **已知脆性（低）**：若上游将来更换该背景类名，规则会**静默失效**。缓解：规则上带注释说明意图；
  一旦失效会表现为可见的视觉回归，不是难以察觉的静默错误。若日后需要更稳，可升级为方案 C（另开任务）。

## 5. 验证计划

| 项 | 方法 | 通过判据 |
|---|---|---|
| AC1 液化等价 | 复用 `.artifacts/probe-score-box.mjs`（默认即液化主题） | 右侧留白 **20px**（与改前 `px-3` 一致）、左侧 24px |
| AC2 作用域隔离 | 同探针加 **legacy 对照组**：把 `data-theme` 切为 `legacy` 后复测 | 右侧回到 **4px**、左侧 **8px**（即规则未跨主题生效） |
| AC3 构建门禁 | `npm run build`（`tsc -b && vite build`） | 退出 0，无 TS 错误 |
| — | 回归套件 | **不跑**：`npm run test:lcdx-regression` 在本机会挂死在 teardown；且该套件不覆盖 `/mai2/recent` |
| — | lint | **不可用**（仓库未装 eslint），不得声称覆盖 |

探针需扩展一处：在测量前可切换 `document.documentElement.setAttribute('data-theme', …)` 并重测
（液化规则随属性即时生效，足以验证隔离，无需重建页面）。

## 6. 风险与回滚

| 风险 | 等级 | 说明 / 缓解 |
|---|---|---|
| 选择器脆性 | 低 | 见 §4；失效表现为可见回归 |
| 影响其它页面 | 极低 | 选择器以 `.maimai2-recent-page` 前缀限定，且仅在液化主题生效 |
| 与主题切换的交互 | 极低 | `data-theme` 是 html 属性，规则随切换即时生效；无 JS 参与 |
| 视觉回退 | 低 | AC1/AC2 双主题实测把关 |

**回滚**：删除该 4 行 CSS 规则即可（fork 侧还需恢复 `px-3` 才能回到当前已上线形态）；
或直接 revert 对应 commit。

## 7. 执行顺序与提交策略

1. **fork 先行**（有自己的验证手段）：
   (a) 改 CSS + 回退 `px-3` → (b) 跑探针双主题 → (c) `npm run build` → (d) commit
2. **上游跟随**：只加 CSS 规则 → `npm run build` → commit
3. 两仓**各自提交、均不 push**。是否 push / 开 PR 由用户单独授权。

提交信息沿用两仓既有风格（Conventional Commits，英文），fork 侧建议：

```
fix(mai2): scope the recent score strip padding to the Liquefy theme
```

## 8. 明确不做

- 不 push、不开 PR。
- 不做左右严格对称化（左 24 / 右 20 的 4px 差保留；对称化须改 markup，与 R5 冲突）。
- 不改 `theme/contract.css` 等共享令牌，不动 liquefy.css 全局 `.card` 圆角。
- 不删除 LCDX fork 的 parity 文件（服主"可以扔掉"的确切范围未定，另议）。
