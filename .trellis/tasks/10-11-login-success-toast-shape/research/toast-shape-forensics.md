# 登录成功 toast「上窄下宽」— 诊断与证据

## 1. 症状

用户（2026-10-11）：「'登陆成功'的提示框，上窄下宽，是不是多了个换行」。
未附截图、未说明主题族与视口。

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
| `src/i18n/zh.json:1436` | `"LoginSuccessMessage": "登录成功",` |
| `src/i18n/en.json:1436` | `"LoginSuccessMessage": "Sign in successful",` |
| `public/assets/i18n/zh.json:1436` | `"LoginSuccessMessage": "登录成功",` |
| `public/assets/i18n/en.json:1436` | `"LoginSuccessMessage": "Sign in successful",` |

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

## 6. 尚存的可能成因（需用户信息收敛）

「主题族差异」这一支已排除：三族容器宽度下限 350px，两视口实测均单行（§4）。
剩下三条都需要用户侧信息：

1. **用户看的是与 master 不同的构建**：本地 `dist/` 与线上产物无法核对
   （本机到 `aqua.naominet.live` 的 TLS 被环境拦截，`curl` 报 `SEC_E_INVALID_TOKEN`，`fetch` 失败）。
   若线上是较早期构建，toast 容器类名/宽度可能不同。
2. **视觉遮挡/裁切被读成「上窄下宽」**：例如窄视口下 toast 左缘越界（§7），
   或上方浮动面板/状态栏压住盒子上缘一角 —— 这类「上边缺角、下边完整」最容易被描述成「上窄下宽」。
   静态渲染无遮挡，此项**只有真实页面截图能证伪**。
3. **别的提示框**：用户以「登录成功」举例，实际看到的是另一条更长的消息（长消息才会折行）。

## 7. 附带发现（真实缺陷，非本次症状，待定是否修）

`Toasts.tsx:49` 的 `w-[min(34rem,calc(100vw-1.2rem))]` **没有扣掉容器自身的 `p-3`（24px）**，
而 liquefy 的容器右偏移是 `max(0.6rem, (100vw-1320px)/2)`（`liquefy.css:1098`）。
窄视口下二者相加超出视口：390px 实测 `x=-6.39` → **toast 左缘被切掉约 6px**。
宽视口（≥563px）因 `34rem` 封顶不受影响。修法（若做）：把宽度公式并入容器几何，或给容器加 `max-width` 约束。

## 8. 复现配方

```
cd E:/ALL.Net/Project_LCDX_NET/aqua_viewer_lcdx
node .artifacts/probe-toast-shape.mjs      # 只读，产物截图落到 .artifacts/
```
真实登录态复现（需要后端+同域产物，按既有套路）：
`.artifacts/local-server.mjs` 起服务 → Playwright `channel: 'chrome'` 登录 QQ `2320812015` →
`#qqNumber` / `#password` 填写提交 → 断言 `.liquefy-toast` 的 `boundingBox()` 与
`.lq-alert__message` 的 `getClientRects().length`。
