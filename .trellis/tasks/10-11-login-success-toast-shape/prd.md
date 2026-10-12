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
- [ ] 产物重建 + 真浏览器回归（`npm run build` + 离线 fixture spec）—— **未做**（重建需先确认）
- [x] 颜色复核（用户要求）：三重像素验证 ⇒ 确认是 **info（青绿 ⓘ）**，生产填充 (36.9,69.1,83.1)/198.2° 与 info 渲染 (36.4,69.0,81.5)/196.6° 吻合，与 success (41.0,72.0,72.3)/180.6° 不符；详见 forensics §9.3

## 待决

- ~~**C（语义）**：三处 `notice(text)` → `notice(text,'success')`~~ → **已实施（用户 2026-10-12 拍板）**：
  `SignInPage.tsx:61`/`:92`、`OnetimeSignInPage.tsx:32` 均补 `'success'`；`tsc -b` 通过。
- **推送/部署未做**（用户选择「先不推」）：本地共 **7 个**未推提交
  （`fe6bbba` fix → `4a86c04`/`546573b` docs → `5488b80` journal → `bf8b3f2` fix → `d8e51b9` docs → `d3b9caa` journal）；
  push master 会触发 CI 自动构建+部署（`deploy-test-server.yml`）。
- 真浏览器回归（离线 fixture spec）未做——需先给 fixture 造出一条 1 行 toast 的触发路径。

## 候选修法（实测数据见 forensics §10）

| 方案 | 改动 | 单行时上/下留白 | 盒高 | 状态 |
| --- | --- | --- | --- | --- |
| **A** | `min-height: 4.1rem` → `3.4rem` | 16 / 16.36（1.02×） | 54.39px | ✅ 已实施 |
| **B** | 保留 `4.1rem` + liquefy 作用域 `align-items: center` | 21.78 / 21.78 | 65.59px | 未采用 |
| **C** | 3 处 `notice(text)` → `notice(text, 'success')` | — | — | ✅ 已实施 |

## Notes

- 触发链唯一：`SignInPage.tsx:61`/`:92`、`OnetimeSignInPage.tsx:32` → `notice()` → `lib/message.ts` → `Toasts.tsx`。
- i18n 行号：该 key 现位于四份资源的 **1437** 行（`LoginSuccessMessage`；2026-10-12 因他处新增 key 由 1436 漂移 +1）。
- 探针（只读，均落在 gitignore 的 `.artifacts/`）：
  `probe-toast-shape.mjs`（三族 × 两视口几何）、`probe-toast-variants.mjs`（现状 vs A/B/C 对照图）、
  `probe-toast-prod-shape.py`（生产截图轮廓/留白）。
- 另一处**独立**缺陷（未列入本次修法）：窄视口 390px 下 toast 左缘越界 ~6px（forensics §7）。
