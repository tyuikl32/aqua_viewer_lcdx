# LCDX 功能走查静态审计（2026-08-22）

- 审计方式：纯静态，不运行任何服务
- 前端：aqua_viewer_lcdx（Angular 22）；后端：LCDXNetApi（ASP.NET Core）
- 前端 API 前缀：`apiServer=https://portal.naominet.live/`（Rinnet 主站，代码不在本仓库）、`lcdxApiServer=https://lcdxnet.am-allnet.com/`（LCDX 后端，路由统一 `lcdx/*`）
- 生产环境两个前缀均为 `/`（同源反代），前缀匹配无问题

## 一、总览表

| # | 功能 | 前端路由 | 前端文件 | 后端端点 | 状态 | 说明 |
|---|------|----------|----------|----------|------|------|
| 1 | Home 落地页 | `/` | home/home.component.ts | — | ✅ | 已登录自动跳 /dashboard |
| 2 | Dashboard | `/dashboard` (AuthGuard) | dashboard/dashboard.component.ts | GET `lcdx/cabinet/global-players`；GET `lcdx/announcement/recent` ×2；GET `api/user/profiles`（主站）；POST `api/user/unbindCard`（主站） | ✅ | LCDX 端点均匹配；主站端点见 ⚠️-1；lang 参数后端忽略见 D4 |
| 3 | 公告列表/详情 | `/announcements` (AuthGuard) | announcements/announcements.component.ts | GET `lcdx/announcement/list`、`lcdx/announcement/item/{id}` | ✅ | 分页 page(从0)/size/type 与后端一致；删除走主站 `api/admin/announcement/{id}`（⚠️-1） |
| 4 | 公告编辑（admin） | `/announcements/edit`（**路由不存在**） | announcements/edit/edit.component.ts | POST `api/admin/announcement`（主站） | ❌ | D1：导航目标无路由 → 跳 /not-found |
| 5 | 登录 | `/sign-in` (LoginGuard) | sign-in、auth/authentication.service.ts | POST `lcdx/login` | ✅ | 已单独审计（含 admin token EULA 修复），一行带过 |
| 6 | 注册 | `/sign-up` (LoginGuard) | sign-up、authentication.service.ts | GET `lcdx/register_start/{qq}`、POST `lcdx/register_confirm/{qq}` | ✅ | 已单独审计 |
| 7 | 一次性登录 | `/onetime-sign-in` | onetime-sign-in.component.ts | GET `lcdx/onetime-v2/{token}` | ✅ | 链路匹配（后端 Ok(JsonConvert.SerializeObject) 双重序列化，Angular 按 JSON 解析兼容） |
| 8 | NetCode 绑卡 | `/netcode-bind` (AuthGuard) | netcode-bind.component.ts | GET `lcdx/bind/{userName}/{netCode}` | ✅ | 方法+路径一致；92001 判定一致 |
| 9 | Banned 页 | `/banned` | banned.component.ts | GET `api/account/status`（主站，经 AccountAccessService） | ✅ | 静态页+主站状态接口 |
| 10 | NotFound | `/not-found`、`**` | not-found.component.ts | — | ✅ | 静态页 |
| 11 | mai2/profile | `/mai2/profile` (canMatch AuthGuard) | maimai2-profile | `api/game/maimai2/profile` 等（主站） | ⚠️ | ⚠️-1 主站接口不在审计仓库 |
| 12 | mai2/rating | `/mai2/rating` | maimai2-rating | 主站 | ⚠️ | 同上 |
| 13 | mai2/recent | `/mai2/recent` | maimai2-recent | 主站 | ⚠️ | 同上 |
| 14 | mai2/photos | `/mai2/photos` | maimai2-photos | 主站 | ⚠️ | 同上 |
| 15 | mai2/dxpass | `/mai2/dxpass` | maimai2-dxpass | 主站 | ⚠️ | 同上 |
| 16 | mai2/circle | `/mai2/circle` | maimai2-circle | 主站 | ⚠️ | 同上 |
| 17 | mai2/festa | `/mai2/festa` | maimai2-festa | 主站 | ⚠️ | 同上 |
| 18 | mai2/servermissions | `/mai2/servermissions` | maimai2-server-missions | 主站 | ⚠️ | 同上 |
| 19 | mai2/pointexchanges | `/mai2/pointexchanges` | maimai2-point-exchanges | 主站 | ⚠️ | 同上 |
| 20 | mai2/songlist | `/mai2/songlist` | maimai2-songlist | 本地 IndexedDB（database 模块） | ⚠️ | 数据来自预载，无 HTTP 链路 |
| 21 | mai2/rival | `/mai2/rival` | maimai2-rival | 主站 | ⚠️ | 同 ⚠️-1 |
| 22 | mai2/kop 排行 | `/mai2/kop` | maimai2-kop-ranking.component.ts | GET `lcdx/kop/rank` | ✅ | 后端返回裸数组（无 ApiResponse 包装），前端亦按裸数组处理，一致；字段 PascalCase→camelCase 默认序列化匹配 |
| 23 | mai2/setting（含引继） | `/mai2/setting` | maimai2-setting.component.ts | GET `lcdx/mergeRegistry/{user}/{cardId}`、POST `lcdx/mergeRegistry/request/{user}/{cardId}`、GET `lcdx/getBindAccessCode/{luid}`、POST `lcdx/add|removeAccessCode/{user}` | ✅ | mergeRegistry 已单独审计确认；DTO currentAccessCode/accessCode 字段一致；安全问题见 D2/D5 |
| 24 | mai2/cabinets 机台状态 | `/mai2/cabinets` (CabinetManageGuard) | maimai2-cabinets.component.ts | GET `lcdx/cabinet/controllable|info|players|delivery|dlprog/...` | ✅ | 全部端点逐个核对匹配 |
| 25 | mai2/cabmode 机台控制 | `/mai2/cabmode` (CabinetManageGuard) | maimai2-cabmode.component.ts | POST `lcdx/cabinet/mode|reboot|lcset|level` | ✅ | DTO 字段（userName/nickName/mode/enable/key/val/level）与后端 PascalCase DTO 大小写不敏感匹配 |
| 26 | mai2/remotecontrol | `/mai2/remotecontrol` (CabinetManageGuard) | maimai2-remote-control.component.ts | POST `lcdx/cabinet/command`、GET `lcdx/cabinet/result/{user}/{requestId}` | ✅ | 匹配；轮询 2s×30；Remoteware 行为见 ⚠️-3 |
| 27 | mai2/locks 记录与授权 | `/mai2/locks` (CabinetAdminGuard) | maimai2-locks.component.ts | GET `lcdx/cabinet/locks|grants/{user}`、POST/DELETE `lcdx/cabinet/grants` | ✅ | DELETE 带 body（deleteLcdx）与后端 [FromBody] 匹配 |
| 28 | Keychip 管理页 | **无路由** | keychip/keychip.component.ts | `api/user/keychip*`（主站） | ❌ | D3：组件已声明但无路由无模板引用，不可达（死代码） |
| 29 | Cards 页 | **无路由** | cards/cards.component.ts | 主站 | ❌ | 同 D3 |
| 30 | Profile 页 | **无路由** | profile/profile.component.ts | 主站 | ❌ | 同 D3 |
| 31 | Admin 页 | **无路由** | admin/admin.component.ts | 主站 | ❌ | 同 D3 |
| 32 | contributors / password-reset / oauth-callback | **无路由** | 各组件 | — | ❌ | 同 D3（静态/主站遗留死代码） |

## 二、缺陷明细

| # | 层/文件:行号 | 现象 | 级别 |
|---|--------------|------|------|
| D1 | 前端 announcements/announcements.component.ts:137 vs app-routing.module.ts:15-47 | admin 右键公告跳 `/announcements/edit`，路由表无此路径 → 被 `**` 重定向到 /not-found；EditComponent 成死代码 | P1 |
| D2 | 后端 LCDXNetUserApi.cs:80-92 | `getBindAccessCode/{currentAccessCode}` 无任何 token 校验（同文件 bind/mergeRegistry 均有 CheckTokenAsync），匿名可查绑定关系；另 :134/:148 `mergeRegistry/client/*` 亦无鉴权（疑为游戏客户端回调，需确认） | P1 |
| D3 | 前端 app.module.ts:121-128 vs app-routing.module.ts:15-47 | Keychip/Cards/Profile/Admin/Contributors/PasswordReset/OauthCallback 组件已声明但无路由、无模板引用（全库 grep 无 `<app-keychip>` 等使用），均不可达；其中 Keychip 页是机台 keychip/游戏版本管理入口，功能实际缺失 | P2 |
| D4 | 后端 LCDXNetAnnouncementApi.cs:24-63 vs 前端 dashboard.component.ts:173,192 / announcements.component.ts:71,106 | 前端所有公告请求带 `lang` 参数，后端 recent/list/item 均不接收 lang（Service 签名也无），多语言公告失效（恒返回默认语言） | P2 |
| D5 | 前端 maimai2-setting.component.ts:92,210,223 | 绑卡相关操作一律取 `currentUser.cards[0].luid`，而非 `defaultCard.luid`（同文件 :74-75 引继用的是 defaultCard）；多卡用户可能对错误的卡操作 | P2 |
| D6 | 后端 Program.cs:99 | `app.UseAuthorization()` 无对应 `AddAuthentication`，全站无 [Authorize]；鉴权完全靠各端点手工 `CheckTokenAsync`。属既定设计，但任何新端点漏写检查即匿名暴露（D2 即实例） | P2 |
| D7 | 前端 maimai2-setting.component.ts:208-234 | `lcdxBindAccessCode()` 两个 if 非互斥：currentAccessCode 非空且表单 touched 时会连发 remove+add 两个请求（当前因绑卡后表单 disable 难以触发，但属脆弱逻辑） | P2 |
| D8 | 后端 Program.cs:72 | CORS 白名单含 `https://localhost` 但不含 `http://localhost:4200`（ng serve 默认），本地前端直连后端会被 CORS 拦截（开发态可用 environment.ts 远端绕过） | P2 |

## 三、⚠️ 无法静态断定清单

| # | 项 | 需运行时验证的原因 |
|---|-----|---------------------|
| ⚠️-1 | 所有 `apiServer`（portal.naominet.live）端点：`api/user/me`、`api/user/profiles`、`api/user/keychip*`、`api/game/maimai2/*`、`api/auth/*`、`api/account/status`、`api/admin/*` | Rinnet 主站代码不在本审计仓库，端点存在性与 DTO 无法静态核对 |
| ⚠️-2 | LCDX 后端 L1 鉴权 `RinnetAdminService.CheckTokenAsync` | 运行时远程调用主站校验 token，行为依赖主站可用性与 token 语义 |
| ⚠️-3 | 远程控制全链路（RemoteControlService→Remoteware→机台） | 依赖外部 Remoteware 服务与机台心跳；result 轮询的 status 取值（pending/done/...）与前端 `'pending'` 字符串比较需运行时确认 |
| ⚠️-4 | 机台数据正确性（players 打码、delivery 版本、dlprog 终态清理） | 依赖 MySQL cll.net 库实时数据 |
| ⚠️-5 | TokenInterceptor 刷新走 `api/auth/refresh`（主站）而非 LCDX `lcdx/refresh` | 双端均有 refresh 端点，实际生效路径取决于主站会话语义；LCDX `lcdx/refresh`/`lcdx/signout` 当前无前端调用方（疑似死端点） |

## 四、总结

- 功能总数：32
- ✅ 15 项（含已单独审计的登录/注册/mergeRegistry）
- ❌ 6 项（D1 公告编辑断链；D3 七个组件不可达合并计 5 项）
- ⚠️ 11 项（mai2 主站功能 10 项 + songlist 本地数据）
- 最重要问题：
  1. **D2（P1）**：`lcdx/getBindAccessCode/{accessCode}` 匿名无鉴权，绑定关系可枚举泄露
  2. **D1（P1）**：公告编辑路由缺失，admin 公告管理功能实际断链
  3. **D3（P2）**：Keychip 等 7 个组件无路由不可达，Keychip 管理页功能缺失
