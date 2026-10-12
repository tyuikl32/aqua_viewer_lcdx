# 登录成功 toast「上窄下宽」— 诊断与证据

## 1. 症状

用户（2026-10-11）：「'登陆成功'的提示框，上窄下宽，是不是多了个换行」。
2026-10-12 用户补充**生产环境截图**（589×272，桌面 DPR=1），取证见 §9。

## 2. 触发链路（唯一路径）

| 环节 | 文件:行 |
| --- | --- |
| 登录成功 → 提示 | `src/pages/auth/SignInPage.tsx:61`（密码登录）、`:92`（TOTP 二段） |
| 一次性登录成功 → 提示 | `src/pages/auth/OnetimeSignInPage.tsx:32` |
| `notice()` → `toastStore` | `src/lib/message.ts:16-39` |
| 渲染 | `src/components/shell/Toasts.tsx:8-76`（`ToastItem`），容器 `Toasts()` `:79-101` |

`Toast` 只有 `{id, text, classname}` 三个字段，**没有 title / 摘要等第二文本源**；
`LiquidAlert` 收到的是 `{toast.text}` 单个子节点，`title` 为 `undefined`（不渲染 `lq-alert__title`）。
⇒ 一个 toast 里只会有一段文本。

## 3. 文案资源逐字节核实（排除「多了个换行」）

`cat -A` 校验，四份资源一字节对齐、行尾只有 LF：

| 文件:行 | 值 |
| --- | --- |
| `src/i18n/zh.json:1437` | `"LoginSuccessMessage": "登录成功",` |
| `src/i18n/en.json:1437` | `"LoginSuccessMessage": "Sign in successful",` |
| `public/assets/i18n/zh.json:1437` | `"LoginSuccessMessage": "登录成功",` |
| `public/assets/i18n/en.json:1437` | `"LoginSuccessMessage": "Sign in successful",` |

值内**没有 `\n` 转义、没有尾随空格、没有全角空格**。
`src/lib/i18n.ts` 用的是 `src/i18n/*.json`（打包进 bundle），`public/assets/i18n/*.json` 是副本；
两处都干净，运行时插值也不涉及该 key（无 `{{}}`）。

## 4. 实测几何（静态复现，产物 CSS + 真实 DOM）

复现脚本：`.artifacts/probe-toast-shape.html` + `.artifacts/probe-toast-shape.mjs`（只读，`node .artifacts/probe-toast-shape.mjs`）。
做法：加载 `dist/assets/index-*.css`（含 `bootstrap-compat / legacy / animal-island / liquefy / tailwind-adapter`
全部样式与 `node_modules/@liquefy-ui/react/dist/styles.css` 的 `.lq-alert` 规则），
按 `Toasts.tsx` 三个分支各自渲染等价 DOM（`data-theme` = `liquefy` / `legacy` / `animal-island`），
用 Playwright（系统 Chrome）在 1440×900 与 390×844 下量 `boundingBox()` 与
消息节点的 `Range.getClientRects().length`。

| 视口 | toast 盒 | 消息可用宽 | 消息行数 |
| --- | --- | --- | --- |
| 1440×900 | 544.0 × 65.59，`x=820`（右缘贴面板） | 452.8px | **1** |
| 390×844 | 370.8 × 65.59，`x=-6.39` ⚠️ | 279.6px | **1** |

三主题族同法实测（文案均为「登录成功」，`Range.getClientRects().length` 判行数）：

| 主题族 | 1440×900 | 390×844 | 行数 |
| --- | --- | --- | --- |
| `liquefy` | 544 × 65.6（msgW 452.8） | 370.8 × 65.6（msgW 279.6，左缘 −6.4 ⚠️） | 1 / 1 |
| `legacy` | 350 × 53 | 350 × 53 | 1 / 1 |
| `animal-island` | 350 × 56 | 350 × 56 | 1 / 1 |

即：**六个组合全部单行、宽 > 高（扁矩形），没有任何「上窄下宽」形态**。
4 个汉字≈60px，对最小可用宽 279.6px 都无折行可能。
截图：`.artifacts/probe-toast-shape-desktop.png`、`.artifacts/probe-toast-shape-mobile.png`。

### 三主题族的容器宽度（源码）

| 主题族 | 规则 | 宽度 |
| --- | --- | --- |
| `liquefy`（默认，`theme.ts:24`） | `Toasts.tsx:49` `w-[min(34rem,calc(100vw-1.2rem))]`（产物已正确编译为 `min(34rem,100vw - 1.2rem)`） | 桌面 544px；窄屏 100vw-1.2rem |
| `animal-island` | `animal-island.css:1236` `width: min(350px, calc(100vw - 1.2rem))` | 350px |
| `legacy` | `Toasts.tsx:70` `w-[350px]` | 350px |

三者最小可用宽都 ≥ 280px，均**不可能**让 4 个汉字折行。

## 5. 已排除的假设

| 假设 | 结论 | 依据 |
| --- | --- | --- |
| 文案里多了换行 | ❌ 排除 | 四份资源逐字节干净（§3） |
| 某个主题把 toast 排成两行 | ❌ 排除 | 三族均为固定宽度、单文本；`.lq-alert` 是 `display:flex` 行布局、无 `flex-wrap`、无 `flex-direction:column`（`@liquefy-ui/react/dist/styles.css:2271`，全文件 24 处 `lq-alert` 规则无媒体查询改布局） |
| 库有「液态形变」把盒子扭曲成梯形 | ❌ 排除 | 库内无 `feTurbulence/feDisplacementMap`；`wobbliness` 只用于 slider 拇指弹簧（`index.mjs:2018-2091`）；`.liquefy-toast` 无动画（`liquefy.css:1422` 只有阴影/圆角/min-height） |
| `white-space: pre-wrap` 把 `\n` 显示出来 | ❌ 排除 | 全仓 `pre-wrap` 只出现在 `Maimai2CirclePage.css` / `Maimai2CabmodePage.tsx`，与 toast 无关 |
| 存在第二套 toast 实现 | ❌ 排除 | 全仓仅 `lib/message.ts` + `Toasts.tsx`，无 `liquefy-ui` 的 `LiquidToast` 用法 |
| 旧版 Angular 站点是另一形态 | ❌ 排除 | `legacy-angular` 分支用 `ngb-toast`，子节点只有 `{{ toast.textOrTpl }}` 一段文本（`src/app/toasts-container.component.ts`） |
| 文案被后端覆盖 / 其它 key | ❌ 排除 | 全仓 `login 成功` 字样只出现在 i18n 与上述 3 个调用点 |
| 盒子被渲成梯形 / 上缘倾斜 | ❌ 排除（生产实测） | 逐列追踪：x=30..553 上缘恒 `y=47`、下缘恒 `y=111`；逐行宽恒 544px（§9.1） |
| 垂直明暗渐变造成错觉 | ❌ 排除（生产实测） | 盒内亮度 63.1→63.4 恒定，盒外 33~34（§9.1） |

## 6. 收敛结论（生产截图已到，2026-10-12）

「上窄下宽」**不是轮廓形状问题，也不是换行**。真因是一条纵向留白不对称：
`liquefy.css:1428` 的 `min-height: 4.1rem` 把盒子撑到 65.6px，而
`.lq-alert { align-items: flex-start }` 让多出的 ~11.6px **全部落在文字下方**
（生产实测 上 18px / 下 32px = 1.78×；本地复刻 16 / 27.56 = 1.72×）——
所以看起来「下面空了一整条，像多了一个空行」。

另发现一处独立缺陷：成功提示用了 **info 的青色 ⓘ**（`notice(text)` 未传颜色）。

详见 §9（取证）、§10（候选修法）。

## 7. 附带发现（真实缺陷，非本次症状，待定是否修）

`Toasts.tsx:49` 的 `w-[min(34rem,calc(100vw-1.2rem))]` **没有扣掉容器自身的 `p-3`（24px）**，
而 liquefy 的容器右偏移是 `max(0.6rem, (100vw-1320px)/2)`（`liquefy.css:1098`）。
窄视口下二者相加超出视口：390px 实测 `x=-6.39` → **toast 左缘被切掉约 6px**。
宽视口（≥563px）因 `34rem` 封顶不受影响。修法（若做）：把宽度公式并入容器几何，或给容器加 `max-width` 约束。

## 8. 复现配方

```
cd E:/ALL.Net/Project_LCDX_NET/aqua_viewer_lcdx
node .artifacts/probe-toast-shape.mjs      # 只读，产物截图落到 .artifacts/
node .artifacts/probe-toast-variants.mjs   # 现状 vs 三种改法对照图
"C:/Users/23208/AppData/Local/Programs/Python/Python314/python.exe" .artifacts/probe-toast-prod-shape.py   # 生产截图轮廓分析
```
真实登录态复现（需要后端+同域产物，按既有套路）：
`.artifacts/local-server.mjs` 起服务 → Playwright `channel: 'chrome'` 登录 QQ `2320812015` →
`#qqNumber` / `#password` 填写提交 → 断言 `.liquefy-toast` 的 `boundingBox()` 与
`.lq-alert__message` 的 `getClientRects().length`。

---

## 9. 生产截图取证（2026-10-12，用户提供）

来源：`C:\Users\23208\.workbuddy\clipboard-images\clipboard-2026-10-11T16-53-49-296Z-f14c94a9.png`（589×272）。
分析脚本：`.artifacts/probe-toast-prod-shape.py`（逐行/逐列扫描 teal 掩码）。

### 9.1 盒子是**对称圆角矩形**，不是梯形

| 量 | 结果 |
| --- | --- |
| 逐行宽度 | y=57..100 恒为 **544px**（x 20..563）；y=47 与 y=111 各为 524 / 522（圆角收边） |
| 逐列上下缘 | x=30..553 上缘恒 **y=47**、下缘恒 **y=111** → **无倾斜、无梯形** |
| 四角 | 顶/底各内收 10/11px（半径 ≈16px = `1rem`），**上下对称（误差 1px）** |
| 盒内垂直渐变 | body 亮度 63.1 → 63.4（恒定）→ 无明暗渐变造成的错觉 |
| 盒外投影 | 盒外亮度恒 33~34 → 深色底上投影不可见 |
| 文字 | 墨迹 y=65..79，**单行**（无第二行） |

⇒ **「上窄下宽」若指盒子轮廓形状，则不成立** —— 生产盒子的几何与 master 完全一致
（544 = 34rem 宽、65.6px 高、四角 16px）。

### 9.2 真正的成因：`min-height` 撑出来的**底部空白**

| 量 | 生产截图 | 本地复刻（`probe-toast-variants.mjs`） |
| --- | --- | --- |
| 盒高 | 65px（y 47..111） | 65.59px（`min-height: 4.1rem`，border-box） |
| 文字距盒顶 | **18px** | 上留白 16px（+行盒半 leading ≈2px = 18） |
| 文字距盒底 | **32px** | 下留白 27.56px（+2px ≈ 30） |
| 下/上 比 | ≈1.78 | **1.72** |
| 单行内容自然高 | — | 54.03px |

链路：`liquefy.css:1428` 的 `min-height: 4.1rem`（65.6px）把盒子撑高，而
`@liquefy-ui/react` 的 `.lq-alert { align-items: flex-start }` 让**多出的 ~11.6px 全部落在文字下方**。
⇒ 视觉上就是「文字占上面一条窄带 + 下面空一大条」，这正是「像多了一个空行」的来源，
但**不是换行**（§3 文案干净、§9.1 只有一行）。

### 9.3 语义色/图标：确认是 info（青色 ⓘ），不是 success（绿色 ✓）

用户质疑「我这里是绿青色」→ 做三重像素级验证，结论：**观感没错（info 的 tint 本身就是青绿），但语义仍是 `info`**。

1. **图标字形**（`prod-toast-icon-8x.png`，8× 放大）：圆内一个 `i` = `InfoGlyph`；
   success 应为圆内**对勾** `SuccessGlyph`（`@liquefy-ui/react/dist/index.mjs:751-756`）。
2. **图标描边色**（取图标 bbox 最亮 8% 像素）：生产实测 **(96.7, 200.1, 206.7)，色相 183.6°**；
   预期 info `82% × #3cc9d1 + 18% white` = (95.1, 210.7, 217.3) = **183.2°**；
   预期 success `82% × #52d69a + 18% white` = (113.1, 221.4, 172.2) = **152.7°**（且 B<G）。
3. **toast 填充色**（同一页面底色 `rgb(32,38,49)` 下对照渲染 → `probe-fill-info.png` / `probe-fill-success.png`）：

   | 变体 | 填充 RGB | 色相 |
   | --- | --- | --- |
   | 生产截图 | (36.9, 69.1, **83.1**) | 198.2° |
   | info 渲染 | (36.4, 69.0, **81.5**) | 196.6° |
   | success 渲染 | (41.0, 72.0, **72.3**) | 180.6° |

   ⇒ 生产与 **info** 每通道差 ≤1.6；与 success 差 5~11 每通道。
4. **代码**：`SignInPage.tsx:61`/`:92`、`OnetimeSignInPage.tsx:32` 均 `notice(text)` 不传颜色
   ⇒ `classname = null` ⇒ `Toasts.tsx:38-45` 判为 `info` ⇒ `--lq-alert-tint: #3cc9d1`（青绿）+ `InfoGlyph`。

⇒ 「绿青色」是 info tint 的本来面目；要绿色 ✓ 必须传 `'success'`（见 §10-C，**本次未实施**）。

### 9.4 DPR 与构建一致性

`1rem` 实测 = 16px（盒宽 544 = 34rem、字号墨迹 14px ≈ 0.95rem）
⇒ 截图是 DPR=1；**生产构建与本地 master 的 toast CSS 同源**，修前端即可生效。

## 10. 候选修法（实测数据来自 `probe-toast-variants.png`）

| 方案 | 改动 | 单行时上/下留白 | 盒高 | 状态 |
| --- | --- | --- | --- | --- |
| 现状 | — | 16 / 27.56（**1.72×**） | 65.59px | 生产即此 |
| **A** | `min-height: 4.1rem` → `3.4rem` | 16 / 16.36（**1.02×**） | 54.39px | ⛔ 曾实施（`fe6bbba`），**2026-10-12 被 B 取代** |
| **B** | 保留 4.1rem + `align-items: center` | 21.78 / 21.78（1.00×） | 65.59px | **✅ 现行实现**（两仓统一，见 `10-12-upstream-liquefy-toast-fit`） |
| **C（语义，可叠加）** | 三处 `notice(text)` → `notice(text, 'success')` | — | — | **未实施**（用户要求先复核颜色→见 §9.3，复核后仍待定） |

A 让盒子贴合内容（与 `legacy` 350×53、`animal-island` 350×56 的「贴内容」取向一致）；
B 保持面板高度体量不变。两者都**只动 liquefy 作用域**，不影响 Bootstrap 类名契约与其它主题。

**多行情形**：2 行消息自然高 76.06px > 3.4rem，min-height 不参与 ⇒ 上下仍各 16px 对称。

## 11. 归属判定：**上游固有**，不是 LCDX 移植引入（2026-10-12，用户追问）

对照对象：上游工作副本 `E:\ALL.Net\RinNET_frontend`（`origin` = XaviorShen fork，`upstream` = RinNET-OpenSource/RinNET_frontend）。

| 核查项 | 结果 |
| --- | --- |
| `min-height: 4.1rem` 的引入提交 | `90d8f11` "refactor theme system around semantic tokens"，作者 **HoshimiRIN `<admin@sakuramoe.dev>`**，2026-09-07 |
| 两仓是否为**同一提交对象** | **是** —— `git cat-file -p 90d8f11` 两仓输出完全一致：tree `5f7c5bc9…`、parent `b512ca75…`、同一 author |
| 该提交是否在 LCDX master 线上 | 是（`git merge-base --is-ancestor 90d8f11 HEAD`） |
| Liquefy 主题（含 toast markup）来源 | LCDX 仓 `b512ca7` 作者 = **HoshimiRIN**（上游），非本地提交 |
| 上游工作副本状态 | 干净；`liquefy.css` / `Toasts.tsx` 与 `origin/master`（`99029d7`, 2026-09-29）**零差异** |
| `liquefy.css` 的 `.liquefy-toast` 段 | 两仓**逐字节一致**（唯一差异 = 本次 §10-A 的 `3.4rem`） |
| `Toasts.tsx` 两仓差异 | **仅** LCDX 本地加的 `app-toasts` 条件类（`81114d5`, Xavior, 2026-10-10，属对齐修复，与高度无关） |
| `align-items: flex-start` 来源 | 第三方包 `@liquefy-ui/react`（`dist/styles.css:2271`）；两仓声明同为 `^0.2.0`（本地实装 0.2.0；上游未安装 node_modules，无法比实装版） |
| 上游是否会中同款 | **会** —— 上游存在单行短文案成功提示：`ResetPasswordPage.Messages.SendCodeSuccess` = 「验证码发送成功。」（8 字，544px 盒内单行）⇒ 同款上 16 / 下 27.6 |

**LCDX 专有的部分**（上游没有）：
- 「登录成功」这条提示本身：上游 `src/` **无 `LoginSuccessMessage`**、无「登录成功」字样；上游 `SignInPage` 是 OAuth/邮箱那一套，登录后不弹该 toast。
- 「成功提示却走 info 青色 ⓘ」：上游约定是成功传颜色（如 `PasswordResetPage.tsx:77` `notice(t(...SendCodeSuccess), 'success')`），
  LCDX 新写的三个调用点漏传 ⇒ 属移植侧新代码的疏漏。

**⇒ 结论**：几何问题（A）＝**上游固有，两仓同源同代码**，所以我们这份修法可以原样回馈上游；
语义问题（C）＝**LCDX 专有**。上游 2026-09-29 之后是否已自行修掉**无法核实**
（GitHub 代理 `127.0.0.1:14204` 拒连：`Failed to connect to github.com:443 over proxy`）。


