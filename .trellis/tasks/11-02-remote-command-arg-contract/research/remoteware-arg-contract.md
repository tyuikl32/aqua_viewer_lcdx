# 调研：Remoteware 指令参数契约

## 结论（本任务的权威输入）

| 指令 | 参数 | 来源 |
|---|---|---|
| `printscr` | 可选，取值 `0` / `1` / `2` | 用户 2026-11-02 口述契约 |
| `remote-card` | 必填，20 位卡号 | 用户 2026-11-02 口述契约 |
| `download` / `downloadpro` | `存储位置|下载URL` | 用户 2026-11-02 口述契约 |
| `remote-cmd-with-user` 等 | `用户名|密码|…`（既有 `-with-user` 约定） | 既有 i18n `ArgUser*` 文案 |

## 代码侧事实

- `src/features/mai2/cabinet-models.ts` 的 `REMOTE_COMMANDS` 是前端唯一指令表；`hasArg` 只被 `Maimai2RemoteControlPage.tsx` 使用（两处：提示文案、`disabled`）。
- 后端 `LCDXNetApi/Services/CabinetPolicy.cs` 只有 17 条指令白名单（Admin）与普通子集（`game-reboot`/`game-switch`），**不解析参数**。
- 后端 `RemoteControlService.DispatchAsync` 把 `message` 原样放进 HTTP 载荷发给 `{Remoteware:ServerUrl}/remote/control`，回执经 ZMQ 回来；`printscr` 的 `imageUrl` 由服务端按回执文件名拼。
- 因此：前端无法从后端拿到参数约束，校验只能内建在前端表里，且必须“可一行放宽”。

## 影响面确认

- `grep hasArg src/` → 仅 `cabinet-models.ts`（定义处）、`Maimai2RemoteControlPage.tsx`（使用处）。
- `grep REMOTE_COMMANDS src/` → 仅上述两处 + 无其他消费方。
- 既有 e2e `tests/lcdx-regression/cabinets.spec.ts` 只用 `game-reboot`（无参），不受参数改动影响。

## 未验证/待真机确认

- 机台侧对“无参指令带非空 `message`”的真实行为（当前前端会带残留值，daemon 大概率忽略）。本任务改为恒发空串属防御性修正。
- `download` 的路径分隔符是否允许 `|` 以外的写法（未在 daemon 源码中确认，故不做强校验）。
