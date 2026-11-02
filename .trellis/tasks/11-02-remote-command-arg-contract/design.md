# 设计：远程控制参数契约

## 1. 根因

| 现象 | 位置 | 原因 |
|---|---|---|
| printscr 提示“无需参数”、输入框禁用 | `cabinet-models.ts` `REMOTE_COMMANDS` `hasArg: false` | 布尔两态表达不了「可选参数」 |
| remote-card 同上，无法输入 20 位卡号 | 同上 | 同上 |
| download/downloadpro 提示“参数：下载 URL” | 两者都复用 `ArgUrl` | 缺「存储位置」半句 |
| 无参指令会把残留参数发出去 | `Maimai2RemoteControlPage.send()` 无条件提交 `message` | 输入框禁用但 state 仍留着旧值 |
| 切换指令不清空参数 | 无切换副作用 | 卡号会残留到 download |

`hasArg` 全仓库仅 `cabinet-models.ts` 与 `Maimai2RemoteControlPage.tsx` 两处引用，替换安全。

## 2. 契约模型

```ts
export interface RemoteCommandArg {
  hintKey: string;                      // 下拉下方提示（可选/必填/格式）
  placeholderKey?: string;              // 输入框 placeholder，缺省回落 ParamsPlaceholder
  required?: boolean;                   // 空值即失败
  pattern?: RegExp;                     // 作用于归一化后的值
  invalidKey?: string;                  // 失败文案，缺省回落 hintKey
  normalize?: (value: string) => string;// 校验与下发都用它
  numeric?: boolean;                    // inputMode="numeric"
}
export interface RemoteCommandDef { command: string; arg?: RemoteCommandArg }
```

`arg === undefined` 即「不接受参数」：输入框禁用、下发空串。这是唯一需要表达的三态之外的第四态，因此不再引入 `hasArg`。

## 3. 17 条指令的映射

| 指令 | arg | 说明 |
|---|---|---|
| ping / game-reboot / game-switch / game-force-reboot | 无 | 禁用 + `NoArgCommand` |
| printscr | `hintKey=ArgPrintScr`, `placeholderKey=PlaceholderPrintScr`, `pattern=/^[012]$/`, `invalidKey=ArgPrintScrInvalid`, `numeric` | 留空放行 |
| remote-card | `required`, `pattern=/^\d{20}$/`, `normalize=去空白`, `numeric` | 必填、20 位 |
| download / downloadpro | `hintKey=ArgDownload`, `placeholderKey=PlaceholderDownload` | 只改文案，不新增阻断 |
| unzip / logsince / logsave / remote-cmd / remote-cmd-with-user / remote-bat / remote-bat-with-user / remote-url-bat / remote-url-bat-with-user | 各自沿用现有 `Arg*` | 不新增阻断 |

## 4. 纯函数（cabinet-models.ts 导出，供页面复用与后续单测）

```ts
function checkValue(spec, raw) { return spec.normalize ? spec.normalize(raw) : raw.trim() }
export function isArgInvalid(spec, raw): boolean     // 空值只在 required 时非法
export function commandArgValue(spec, raw): string   // 无参 → ''；有 normalize → 归一化；否则原样
export function argFormatKey(spec): string           // 参数格式签名（= hintKey）；切换指令时据此决定是否清空
```

- 校验用 `trim`（防全空格绕过必填），**下发不 trim**（保持 `remote-cmd` 等命令行字节原样）；只有声明了 `normalize` 的指令才改动下发值。
- 下发值与原值分离，避免“为了校验顺手 trim 了整条命令”的隐性回归。

## 5. 页面

- 新增 `argTouched`（blur 后置真，切换指令时复位）、`paramsRef`（校验失败聚焦）。
- 新增 effect（依赖仅 `[selectedCommand]`）：复位 `argTouched`；`argFormatKey` 与上一次不同（含切到无参指令）就清空已填值，`download ↔ downloadpro` 因共用同一 `hintKey` 而保留。用 `prevArgFormatRef` 记住上一次签名。
  - 依赖不能带 `commands`：权限探测 P0→P10 会换新数组，会把正在输入的值卷进清理。
- `send()`：先 `isArgInvalid` → 失败则 `setArgTouched(true)` + `focus()` + `return`（不发请求、不弹 toast，避免双提示）；成功则 `message: commandArgValue(...)`。
- 渲染：`disabled={!argSpec}`；`placeholder` 按 `placeholderKey` 回落；`is-invalid` + `.invalid-feedback d-block` 行内报错；`aria-describedby` 指向提示与错误；给三个控件补 `id` 与 `htmlFor`（a11y + 测试稳定定位）。
- 发送按钮**不因参数非法而禁用**：禁用态不解释原因，而「必填为空」是正常中间态；点击给行内错误更明确。

## 6. i18n（7 个新 key）

| key | zh | en |
|---|---|---|
| ArgCardNumber | 参数：20位卡号（必填） | Arg: 20-digit card number (required) |
| ArgDownload | 参数：存储位置\|下载URL | Arg: save location\|download URL |
| ArgPrintScr | 参数：0 / 1 / 2（可选） | Arg: 0 / 1 / 2 (optional) |
| ArgPrintScrInvalid | 仅支持 0 / 1 / 2，可留空 | Only 0 / 1 / 2; may be empty |
| PlaceholderCardNumber | 必填，20位卡号 | Required, 20-digit card number |
| PlaceholderDownload | 存储位置\|下载URL | Save location\|download URL |
| PlaceholderPrintScr | 0 / 1 / 2（可选） | 0 / 1 / 2 (optional) |

- `NoArgCommand` 保留（4 条无参指令仍在用）。
- 四份文件按字母序插入，值逐字一致（`audit-i18n.mjs` 会比对 public 副本与插值变量）。
- 基线：审计当前已是红的（76 + 76，全部来自既有 `CardsPage.Qr*` / `PlayerQrPage.*` / `App.Sidebar.PlayerQr` 缺口）。验收判据是**错误集合不变**，不是 exit 0。

## 7. 权衡与决策

| 决策 | 选择 | 理由 |
|---|---|---|
| download 是否强校验 `\|` | 否 | 分隔符契约在 daemon；前端猜错会“看着合法发不出去”。要加只需补 `pattern` + `invalidKey`，UI 不用动 |
| printscr 是否硬拦非 0/1/2 | 是 | 用户明确给出闭集；daemon 扩展取值时改一行正则 |
| 卡号去空白是否越权 | 否 | 只对 `remote-card` 生效；命令行类指令一律原样 |
| 输入控件类型 | `text` + `inputMode=numeric` | `type=number` 会吃前导零、把 20 位当浮点、滚轮误改；`maxlength` 会在粘贴时截断破坏去空白 |
| 参数框初始态 | 未选指令时禁用 | 语义未定前输入必然被清空，不如不给输入 |

## 8. 兼容性 / 回滚

- 不动后端与 API 契约，回滚 = revert 本任务提交，无数据迁移、无配置项。
- 唯一对外可见的行为变化：无参指令下发 `message: ""`（原为残留值）。若机台侧对空 `message` 有异样，回滚点单条即恢复。
