# 技术设计：上游 liquefy toast 上下留白

> 状态：**已定稿并实施**（用户 2026-10-12 选定 **方案 B**，且 fork 同步统一为 B）。
> 实施明细与实测见 `prd.md`「实施结果」；两仓均只本地提交，未 push、未开 PR。

## 1. 问题与实测

上游与 fork **同源同代码**：该规则出自上游提交 `90d8f11`（作者 HoshimiRIN，两仓为同一提交对象），
两仓 `liquefy.css` 的 `[data-theme='liquefy'] .liquefy-toast` 段**逐字节一致**。

| 量 | 实测值 | 来源 |
| --- | --- | --- |
| 单行 toast 盒 | 544 × **65.59px**（`min-height: 4.1rem`） | fork 侧探针 `.artifacts/probe-toast-shape.mjs`（1440×900） |
| 文字行盒 | 22.03px（`0.95rem × 1.45`） | 同上 |
| padding | `1rem 1.1rem` | `liquefy.css:1412` |
| **上 / 下留白** | **16 / 27.56px = 1.72×** | 探针 |
| 生产截图复核 | 墨迹距顶 18px / 距底 32px = **1.78×** | `10-11-login-success-toast-shape/research/toast-shape-forensics.md` §9.2 |

**根因**（两仓相同）：`.liquefy-toast` 用 `min-height: 4.1rem` 把盒子撑到 65.6px，
而第三方库 `@liquefy-ui/react` 的 `.lq-alert { align-items: flex-start }` 让**多出的 ~11.6px 全落在文字下方**。

**影响面**：上游默认主题即 `liquefy`（`src/lib/theme.ts:24`）⇒ 问题默认可见；
**任何单行短文案 toast 都中**，例如 `ResetPasswordPage.tsx:77` 的
`notice(t('ResetPasswordPage.Messages.SendCodeSuccess'), 'success')`（「验证码发送成功。」）。
多行消息不受影响（自然高 > min-height，无剩余空间）。

**注意**：`4.1rem` 不是随意取的——它就是壳层行高（`liquefy.css:967/968` 的 `.app-navbar` 高度、
`globals.css:710/715` 的 `.sidebar { top/margin-top: 4.1rem }`），
而 toast 的 `marginTop: 4.35rem`（`Toasts.tsx:87`）正好把它挂在 navbar 正下方。
⇒ **toast 当前与 navbar 等高，是一条既有的视觉节奏**（R4）。

## 2. 门禁现状（决定"验证到什么程度"）

| 门禁 | 是否会拦这次改动 | 依据 |
| --- | --- | --- |
| 上游 parity 像素套件 | **不会**（且已退休） | 维护者 2026-10-12 口径：parity 是 React 迁移期的验收手段，现已改为 logic/UI 分离；替代品 `theme-system.spec.ts` 只测语义令牌对比度 |
| `tests/ui-parity/theme-system.spec.ts` | **不会** | 全文件只对 `.animal-island-toast` 断言 `role="alert"`；无 liquefy toast 几何断言 |
| `tests/ui-parity/liquefy-importer-feedback.spec.ts` | **不会** | 只断言 toast 文本 `Wrong Game ID`、关闭按钮生效、关闭后数量 0（L96-99），无几何断言 |
| 上游 CI | **不会跑** | `.github/workflows/deploy-test-server.yml` 触发条件是 **push 到 `next`** 或手动 ⇒ PR 不跑任何测试 |
| `npm run build`（`tsc -b && vite build`） | 唯一可跑门禁 | 见 §6 |
| `npm run lint` | **不可用** | 上游同样未装 eslint（与 fork 一致）⇒ 不得声称覆盖 |

## 3. 候选方案

| 方案 | 改动 | 优点 | 代价 / 风险 |
| --- | --- | --- | --- |
| **A** | `min-height: 4.1rem` → `3.4rem`（= fork 现状） | 改动最小（1 个值）；与 fork **完全一致**；盒子贴合内容 | ① 打破 R4 的壳层节奏（toast 65.6 → 54.4px，navbar 仍 4.1rem）；② `3.4rem` 是**由库的 `padding:1rem` + 22px 行盒推导出的魔法数**——库的 padding 或 `--font-size` 一变就失效；③ 只对"单行"成立 |
| **B（推荐）** | 保留 `min-height: 4.1rem`，加 `align-items: center`（1 行） | ① **本文件已有同型先例**：`.liquefy-import-warning { --lq-alert-tint: …; align-items: center; min-height: 5.5rem; … }`（`liquefy.css:817`），`.liquefy-import-panel` 同为 `align-items:center + min-height`；② 保住 4.1rem 节奏；③ **无魔法数**（剩余高度由 flex 均分）；④ 若将来去掉 `min-height`，该声明退化为 no-op（幂等） | ① 多行消息时图标/关闭按钮随之垂直居中——对 toast 恰当（`.lq-alert__copy` 无 `title`，单行场景为主）；② 与 fork 现行实现不同（见 §5 同步决策） |
| C | 升级 `@liquefy-ui/react`（0.2.0 → 最新 1.1.0） | 若库已修则根治 | **实测不成立**：1.1.0 的 `.lq-alert` 仍是 `align-items: flex-start` + `padding: 14px 16px`（与 0.2.0 相同，已解包核对）⇒ 升级**不解决本问题**；且 0.x → 1.x 是**跨大版本**（`^0.2.0` 不含 1.x）、属第三方包（maintainer `yu5ag`，仓库 `github.com/liquefy-ui/liquefy-ui`，**非 RinNET 组织**）、影响全站所有 alert（含带 `title` 的两行型）⇒ 对上游属大范围改动，违反 R3 |
| F | 不改（维持现状） | 零风险、零评审成本 | 问题继续存在（即上一任务 `10-12-upstream-recent-score-strip-decision` 的选择） |

## 4. 推荐：**方案 B**

四条依据，按权重排序：

1. **同仓先例**：`liquefy.css` 自己解决"有 `min-height` 的 alert 家族构件"就是用 `align-items: center`
   （`.liquefy-import-warning` 连"tint 变量 → align-items → min-height"的书写顺序都可照抄）。
   这不引入新范式，是沿用本文件既有做法——也正是服主"改动限于主题自己的代码"的口径。
2. **保留设计意图**（R4）：toast 与 navbar 同为 4.1rem 的壳层行高，B 不动这个约定。
3. **无魔法数**：A 的 `3.4rem` 依赖库的 padding/行高；B 把"多了多少"交给 flex 自己平分，
   对库的细部改动不敏感。
4. **实测已就绪**：B 的几何早就在 fork 侧探针里量过——变体③（`min-height: 4.1rem` + `align-items: center`）
   得到 **65.59px、上 21.78 / 下 21.78（1.00×）**，盒高不变、留白严格对称。

## 5. fork 侧一致性（已决定：统一为 B）

| 选项 | 动作 | 代价 |
| --- | --- | --- |
| **同步为 B ✅（用户 2026-10-12 选定）** | fork 再提交 1 处：`min-height: 3.4rem` → `4.1rem` + `align-items: center` | 1 个提交 + `quality-guidelines.md` 里「取单行自然高 3.4rem」一段改写；换来两仓实现/行为/后续合并风险完全一致 |
| 保持 A | 不动 | 两仓该规则出现 1 处差异（`min-height` 值 + `align-items`），日后上游同步需手工协调 |

> fork 的 A（`fe6bbba`）尚未推送、尚未部署，切换成本为零。

## 6. 精确改动（上游，方案 B）

`src/styles/theme/liquefy.css`，`[data-theme='liquefy'] .liquefy-toast`（L1405-1415）：

```diff
 [data-theme='liquefy'] .liquefy-toast {
   --lq-alert-tint: var(--lq-accent);
+  /* 4.1rem is the shell row height (.app-navbar), but .lq-alert is flex-start —
+     centre the row so the surplus height is shared instead of dumped below the text. */
+  align-items: center;
   border-radius: 1rem;
   box-shadow:
```

- 位置与写法照抄同文件 `.liquefy-import-warning`（tint 变量之后紧跟 `align-items`）。
- **不动** `min-height` / `padding` / `border-radius` / 任何 severity 规则。
- 影响面已核实：`liquefy-toast` 类**全仓只有 `Toasts.tsx:49` 使用**，
  且该 toast 不传 `title` ⇒ 居中只影响 toast 自身，不影响库默认 alert 与其它主题。

## 7. 验证计划

| 项 | 方法 | 通过判据 | 备注 |
| --- | --- | --- | --- |
| V1 几何 | 复用 `.artifacts/probe-toast-variants.*`（变体③ 即 B 的实现） | 盒 **65.59px**、上/下留白 **21.78 / 21.78**（1.00×）、消息仍 1 行 | 已在 fork 侧跑过 ✓ |
| V2 作用域隔离 | 同探针把 `document.documentElement.dataset.theme` 切成 `legacy` / `animal-island` | 两族的 toast 几何与改动前一致 | 规则带 `[data-theme='liquefy']` 前缀 |
| V3 构建门禁 | 上游 `npm ci && npm run build` | 退出 0 | **需用户授权**（涉及安装依赖/重建）；上游当前无 `node_modules` |
| — | 上游 parity / theme-system / lint | **不跑** | 见 §2（退休 / 不覆盖 / 不可用）；不得声称覆盖 |

## 8. 风险与回滚

| 风险 | 等级 | 说明 |
| --- | --- | --- |
| 影响其它主题或库默认 alert | 极低 | 选择器带 `[data-theme='liquefy'] .liquefy-toast`，该类仅 toast 使用（§6 已核） |
| 多行 toast 的图标位置变化 | 低 | 从"与首行对齐"变为"整块居中"；toast 不传 `title`，且长文案本就不多，视觉上仍协调 |
| 上游维护者不认可该取向 | 中 | 缓解：方案 B 与同文件既有 `.liquefy-import-warning` 完全一致；且只 2 行（含注释），review 成本极低 |
| 与 fork 实现分叉 | 低 | 由 §5 决定是否同步 |

**回滚**：删除该 2 行（注释 + `align-items: center;`）或 `git revert` 该提交；无数据/接口影响。

## 9. 提交策略（⚠️ 含协作约束）

- 上游工作区**当前有另一会话的未提交改动**：`src/features/mai2/Maimai2RecentPage.css`（R5）。
  ⇒ 实施时必须：
  1. `git status` 先确认只有该文件 + 我的目标文件；
  2. `git add src/styles/theme/liquefy.css`（**单文件**，禁止 `git add -A` / `git add .`）；
  3. **不建分支、不切分支、不 stash**（避免把他人未提交改动带进提交）。
- 提交信息沿用上游风格（Conventional Commits，英文）：
  ```
  fix(liquefy): centre the toast row so the surplus height is not dumped below the text
  ```
- **不 push、不开 PR**（R6，需单独授权）。若日后开 PR：上游 `pull_request_creation_policy: all`、无模板，
  PR 不跑 CI；基线分支是 **`main`**（上游默认分支，注意用户 fork 是 `master`）。

## 10. 明确不做

- 不动 markup、不动 `theme/contract.css` 共享令牌、不动 `theme/liquefy.css` 的 `.card` 圆角等无关规则。
- 不升级 `@liquefy-ui/*` 依赖（R3）。
- 不顺手带上 fork 独有的 `app-toasts` 对齐修复（那属另一议题，且上游没有该 class）。
- 不 push、不开 PR、不建分支。
