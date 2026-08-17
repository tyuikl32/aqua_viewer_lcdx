# PRD: 舞萌DX 机台管理 —— 前端（aqua_viewer_lcdx 专属范围）

> 本任务仅覆盖 **aqua_viewer_lcdx 前端** 改动。后端（LCDXNetApi）由独立 Trellis 任务管理：
> `E:\ALL.Net\Project_LCDX_NET\LCDXNetApi\.trellis\tasks\08-17-mai2-cabinet-backend`
> 共同的设计基线（单一事实源）：`.trae/documents/mai2-cabinet-management-v3-design.md`

## 需求（设计文档 §8）

前端 4 页重组 + 权限探测：

1. **机台管理页** `mai2/cabinets`：机台下拉 + 四卡片（机台状态/上机人数/配信状态 delivery/下载进度 dlprog）+ 30s 自动刷新
2. **机台控制页** `mai2/cabmode`：普通区（LC 模式切换四框 + 传统重启二态按钮 + LC 功能卡——普通用户仅 `event` 一项（第六轮 Q1 定案，chevent 不下放），Admin 全 19 项）；管理区 P≥10（机台级别 8 档）
3. **远程控制页** `mai2/remotecontrol`：指令下拉**按角色过滤**（普通用户仅 `game-reboot`/`game-switch`，Admin 17 条）+ 参数 + 发送 + requestId 轮询（2s×30）+ printscr 图片展示（仅 Admin）。菜单对 hasManage=true 用户可见（EP-18 探测，不再 P10 限定）
4. **操作记录与授权页** `mai2/locks`（P≥10）：卡A 操作记录过滤器+分页表格；卡B 授权管理（EP-15..17：授权表格+新增+吊销）

支撑：BotPermissionService（EP-01 权限 + EP-18 hasManage 入口探测）、ApiService.getLcdxAuth/postLcdxAuth/deleteLcdxAuth（Authorization 头）、菜单 4 项（Cabinets/CabinetControl/RemoteControl 为 AfterLogin+hasManage；Locks 带 requiredBotPermission:10）、机台下拉统一走 EP-19（普通=授权投影，Admin=全量，原 EP-02/03 废弃）、i18n zh/en、Karma 单测（BotPermissionService/角色过滤纯函数）。

约束：前端不出现 QQ 号与 FullKeychip 明文；delivery 与 dlprog 是两个不同接口（EP-06/EP-07），不得合并。

## 验收标准

- [ ] P≥10 账号：4 菜单全可见；页③ 17 条指令全量；页② LC 功能 19 项；页④ 记录+授权管理可用
- [ ] 普通授权账号：页①②③可用（仅授权机台）；页② LC 功能仅 1 项（event）；页③仅 game-reboot/game-switch；页④菜单隐藏且直访显示无权限
- [ ] 无授权且非管理员的登录账号：①②③菜单隐藏（EP-18 hasManage=false），直访提示无权限
- [ ] 页② 重启按钮随 isRebooting 二态切换；模式未变时提交禁用
- [ ] 页③ ping 回执轮询到 Pong!（Admin）；printscr 显示截图（Admin）
- [ ] `ng build` + `ng test` 零错误
- [ ] 依赖的后端 EP-01、EP-04..EP-19（含 13R）联调通过（后端就绪后）
