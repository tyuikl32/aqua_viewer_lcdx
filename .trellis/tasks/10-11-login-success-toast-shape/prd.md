# 登录成功 toast 上窄下宽排查

## Goal

查清用户报告的「'登录成功' 提示框上窄下宽，是不是多了个换行」的真实成因，并给出可执行的结论。

**结论（2026-10-12，生产截图取证后）**：
不是换行，也不是盒子轮廓变梯形 —— 是 `min-height: 4.1rem` 撑出的**底部空白**（下/上留白 = 1.72×），
看起来像「多了一个空行」；另发现成功提示误用 info 语义（青色 ⓘ）的独立缺陷。
证据见 `research/toast-shape-forensics.md` §9，候选修法见 §10。

**归属（2026-10-12 追问后核实）**：
几何问题 = **上游固有**（`90d8f11`，作者 HoshimiRIN，两仓为同一提交对象，`.liquefy-toast` 段逐字节一致）
⇒ 修法可原样回馈上游；「登录成功」文案与该调用点漏传颜色 = **LCDX 专有**。详见 forensics §11。

## Requirements

- 必须逐字节确认成功提示的文案资源，判定是否存在多余换行。
- 必须在**三个主题族**（liquefy / animal-island / legacy）× 明暗 × 桌面(1440)/移动(390) 下给出 toast 的真实几何（宽、高、消息行数、消息可用宽）。
- 若确认为缺陷：修在**主题作用域**内，不得动 Bootstrap 类名契约与其它主题。
- 若为「多了一行」类问题：必须在源头（i18n 资源或调用点）修，禁止用 CSS 掩盖。

## Acceptance Criteria

- [x] 结论：成功提示文案**不含**换行 —— 四份 i18n 资源逐字节干净（`src/i18n/{zh,en}.json:1437`、`public/assets/i18n/{zh,en}.json:1437`）
- [x] 结论：3 主题族 × 2 视口共 6 组实测**全部单行**；生产盒子经像素级逐行/逐列还原为**对称圆角矩形**（544×65.6，四角 r≈16px）
- [x] 定位到真因：`liquefy.css:1428` `min-height: 4.1rem` + `.lq-alert { align-items: flex-start }` → 下方多出 ~11.6px 空白（生产 18/32px = 1.78×）
- [x] **修法 A 已实施**：`min-height: 4.1rem` → `3.4rem`（`src/styles/theme/liquefy.css`），探针实测 65.59→54.39px、留白 1.72×→**1.02×**；多行情形不受影响
- [x] **⚠️ 2026-10-12 改判：A 已被 B 取代** —— 为了让上游 `RinNET_frontend` 与 fork 用**同一实现**，
      改为「保留 `4.1rem`（= `.app-navbar` 壳层行高）+ `align-items: center`」（实测 65.59px、21.78/21.78 = 1.00×）。
      决策与实施见 `.trellis/tasks/10-12-upstream-liquefy-toast-fit/`；本任务 A 的取证结论（留白不对称 1.72×）
      不受影响，仍是问题定性的依据。
- [x] 产物重建 + 部署 + 线上复核：**已完成** —— CI #67/#68（A 形式）→ 改判后 **#69 `8ee0fcd`（B 形式，20:19 +0800）成功**；
      线上 `index-BqfK9Hmp.css` 实测含 `align-items:center`（在 `.liquefy-toast` 块内）+ `min-height:4.1rem`、**0 处 `3.4rem`** ⇒ 方案 B 已上线
- [x] 真浏览器确认：用户 2026-10-12「已部署上线，应该没问题了」
- [ ] （可选遗留）离线 fixture spec 未做——需先给 fixture 造出一条 1 行 toast 的触发路径
- [x] 颜色复核（用户要求）：三重像素验证 ⇒ 确认是 **info（青绿 ⓘ）**，生产填充 (36.9,69.1,83.1)/198.2° 与 info 渲染 (36.4,69.0,81.5)/196.6° 吻合，与 success (41.0,72.0,72.3)/180.6° 不符；详见 forensics §9.3

## 候选修法（实测数据见 forensics §10）

| 方案 | 改动 | 单行时上/下留白 | 盒高 | 状态 |
| --- | --- | --- | --- | --- |
| **A** | `min-height: 4.1rem` → `3.4rem` | 16 / 16.36（1.02×） | 54.39px | ⛔ 曾实施（`fe6bbba`）→ 2026-10-12 改判弃用 |
| **B** | 保留 `4.1rem` + liquefy 作用域 `align-items: center` | 21.78 / 21.78（1.00×） | 65.59px | **✅ 现行（已上线）**，与上游同款 |
| **C** | 3 处 `notice(text)` → `notice(text, 'success')` | — | — | ✅ 已实施并上线 |

## 最终状态（2026-10-12 归档）

- **推送/部署已完成**：`origin/master` 已含全部修复，CI 三次成功（#67/#68 为 A 形式、**#69 为 B 形式**）；
  线上 CSS 实测为方案 B，C（success 语义）亦已上线。
- **两仓同款**：上游 `RinNET_frontend` 本地提交 `158c4d5` 为同一实现（**未 push、未开 PR**）——
  该部分的决策与实施归 `10-12-upstream-liquefy-toast-fit` 任务。
- **用户确认**：线上无问题（本任务据此归档）。

## Notes

- 触发链唯一：`SignInPage.tsx:61`/`:92`、`OnetimeSignInPage.tsx:32` → `notice()` → `lib/message.ts` → `Toasts.tsx`。
- i18n 行号：该 key 现位于四份资源的 **1437** 行（`LoginSuccessMessage`；2026-10-12 因他处新增 key 由 1436 漂移 +1）。
- 探针（只读，均落在 gitignore 的 `.artifacts/`）：
  `probe-toast-shape.mjs`（三族 × 两视口几何）、`probe-toast-variants.mjs`（现状 vs A/B/C 对照图）、
  `probe-toast-fit.mjs`（**注入两仓真实源文件**，验证 B 与作用域隔离）、
  `probe-toast-prod-shape.py`（生产截图轮廓/留白）。
- 另一处**独立**缺陷（未列入本次修法）：窄视口 390px 下 toast 左缘越界 ~6px（forensics §7）。
