# 远程控制指令参数契约修复（printscr/remote-card/download 提示与校验）

## Goal

`/mai2/remotecontrol`（页③ 远程控制）的参数区与指令语义不对齐：三条指令的“提示 / 可输入性 / 必填性”与实际 Remoteware 契约不符，导致用户被错误引导（printscr、remote-card 的输入框被禁用且提示“无需参数”；download/downloadpro 提示成“下载 URL”）。本任务把参数契约从「有参/无参」两态升级为「可选 / 必填 / 格式」，并按契约渲染与校验。

## Background

- 前端 `REMOTE_COMMANDS`（`src/features/mai2/cabinet-models.ts`）以 `hasArg: boolean` 描述指令，页面据此决定提示文案与输入框 `disabled`。
- `printscr` 实际接受 **0 / 1 / 2**（可选），却被标为无参。
- `remote-card` 实际需要 **20 位卡号**（必填），却被标为无参。
- `download` / `downloadpro` 实际参数是 **「存储位置|下载URL」**，却复用了 `ArgUrl`（只说下载 URL）。
- 后端 `LCDXNetApi` 只做指令白名单与转发（`RemoteControlService.DispatchAsync`），**不校验参数**；参数语义的权威在机台侧 daemon。因此前端校验只承担 UX，不得假装成安全边界。

## Requirements

1. `printscr`：参数框可编辑；下拉下方提示与输入框 placeholder 均标明 **可选**，并给出取值 `0 / 1 / 2`；留空允许发送。
2. `remote-card`：参数框可编辑且 **必填**；输入框 placeholder 为「必填，20位卡号」；空值与长度不足 20 位不得发出请求（行内报错，不发网络请求）。
3. `download` / `downloadpro`：提示与 placeholder 改为「存储位置|下载URL」。
4. 无参指令（`ping` / `game-reboot` / `game-switch` / `game-force-reboot`）：参数框禁用，且 **不得把上一条指令的残留参数发给机台**。
5. 其余 9 条有参指令（`unzip` / `logsince` / `logsave` / `remote-cmd` / `-with-user` 系列 / `remote-url-bat*`）：提示文案与“不阻断空值”的现状保持不变，只换承载结构。
6. 用户可见文案一律走 i18n，且 `src/i18n/{zh,en}.json` 与 `public/assets/i18n/{zh,en}.json` 四份同步、zh/en key 集一致。
7. 不新增全局 CSS；沿用 Bootstrap 类名（`.form-text` / `.is-invalid` / `.invalid-feedback`）。
8. 不改后端、不改轮询逻辑、不碰 `chuni/` 与 `ongeki/`（冻结区）。

## Acceptance Criteria

- [ ] 选 `printscr` 后参数框可输入，提示与 placeholder 均含「可选」/「optional」，取值为 `0 / 1 / 2`。
- [ ] 选 `remote-card` 后参数框可输入，placeholder 为「必填，20位卡号」；留空或 19 位数字时点击发送**不出现网络请求**并显示行内错误；20 位数字可发送，且下发值就是 20 位数字（允许从别处粘来的分组空格）。
- [ ] 选 `download` / `downloadpro` 后提示与 placeholder 均为「存储位置|下载URL」。
- [ ] 选无参指令时参数框禁用，下发 `message` 恒为空串；从上一条指令带过来的残留值不发出。
- [ ] 指令切换时不兼容的旧值被清空（`remote-card` → `download` 清空；`download` → `downloadpro` 保留）。
- [ ] `npm run build`（`tsc -b && vite build`）通过。
- [ ] `node scripts/audit-i18n.mjs` 的错误集合与改动前**完全一致**（基线 76 条 missing-resource-key + 76 条 public-copy-drift，全部来自既有的玩家二维码 key 缺口，本任务不新增条目）。
- [ ] 定向回归 `playwright test -c playwright.lcdx.config.ts remote-args.spec.ts` 全过；既有 `cabinets.spec.ts` 远程控制两条 spec 不回归。
- [ ] `git log` 可见本任务的分批提交；**未 push**。

## Out of Scope

- 补齐 `public/assets/i18n/*` 缺失的 38 个玩家二维码 key（既有欠账，另立任务）。
- 为 `download` 增加「`|` 结构强校验」、为 `printscr` 之外的指令增加必填约束。
- 后端参数校验、审计脱敏、回执缓存。
