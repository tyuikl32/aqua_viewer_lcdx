# Design: 前端实现设计（aqua_viewer_lcdx）

完整依据：`.trae/documents/mai2-cabinet-management-v3-design.md` §6（endpoint 契约）§8（前端设计）

## 模块结构

| 文件 | 内容 |
|---|---|
| `src/app/api.service.ts` | +`getLcdxAuth/postLcdxAuth`（读 AccountService，注入 `Authorization: Bearer`） |
| `src/app/bot-permission.service.ts` | EP-01+EP-18 探测，BehaviorSubject\<{permission, hasManage}\>；UserService.load 成功后触发，clear 时归零/false |
| `src/app/menu.service.ts` | maimai2 菜单 4 项：Cabinets/CabinetControl(路由不变 cabmode)/RemoteControl 三项 AfterLogin+hasManage（EP-18）；Locks(requiredBotPermission:10) |
| `sega/maimai2/maimai2-cabinets/` | 页①（EP-19/04/05/06/07） |
| `sega/maimai2/maimai2-cabmode/` | 页②（EP-19/08/09/10/11） |
| `sega/maimai2/maimai2-remote-control/` | 页③（EP-19/13/13R） |
| `sega/maimai2/maimai2-locks/` | 页④（EP-14，ngx-pagination） |
| `maimai2.routing.ts` / `maimai2.module.ts` / i18n zh+en | 路由/声明/词条 |

## 关键契约映射（前端消费的 endpoint）

- EP-01 permission → BotPermissionService（数据源 LCDXMembers，无 bot 库依赖；驱动子集过滤/管理区显隐）
- EP-18 manage-access → 入口探测：hasManage=∃Enabled授权行∨P10（与后端 L2 判定同源），决定菜单组①②③显隐（第五轮新增）
- EP-19 controllable → 页①②③机台下拉**统一**数据源（普通=授权投影，Admin=全量；原 EP-02/EP-03 已并入废弃，无需前端角色切换）
- EP-04 info / EP-05 players / EP-06 delivery / EP-07 dlprog → 页①四卡片
- EP-08 mode / EP-09 reboot(enable 二态) / EP-10 lcset(普通子集仅 event，Admin 19 项) / EP-11 level(Admin) → 页②
- EP-13 command(普通子集 game-reboot/game-switch，Admin 17 条) → 页③发送；EP-13R result 轮询（2s×30 上限；timeout/pending/done 三态；printscr→imageUrl 仅 Admin）
- EP-14 locks + EP-15..17 grants（授权管理卡） → 页④

## 展示规则

- dlprog 状态：10000→Done / -1→Error / -2→HashError / -3→Incomplete / 其余 x%（后端已给 progressText，直接展示）
- fileName 截断：去第 20 位起 7 字符（越界保护），title 属性保留全名
- LC 模式文案：0=国服(2025) / 4=CiRCLE PLUS / 10=Splash PLUS（前端映射，实体无 GameType）
- 级别下拉 8 档带说明（Recover=-1 特殊修复；越低配信越少警告）
- 重启文案固定"机台将在下次心跳（空闲时）自动重启"（读即清语义，禁止写"立即重启"）
