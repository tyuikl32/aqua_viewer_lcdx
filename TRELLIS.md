# AquaViewer (lcdx) — Trellis 项目文档

> 本文档是对 `aqua_viewer_lcdx` 仓库的完整理解（"加载"产物），用于在进入开发前快速建立全局心智模型。
> 维护者：由代码静态分析生成，随代码演进需同步更新。

## 1. 项目定位

**AquaViewer For RinNET (lcdx 变体)** 是街机服务器 **RinNET**（Aqua 的衍生分支）的 Web 前端。

- 仓库目录名 `aqua_viewer_lcdx` 中的 **lcdx** 指向一套独立的「lcdx」后端（`lcdxnet.am-allnet.com`），承担公告、NetCode 绑定、KOP 排名、maimai2 AccessCode 绑定，以及一条独立的登录/注册链路。
- 主数据后端为 RinNET 主站（开发环境 `https://portal.naominet.live/`，生产同源 `/`）。
- 许可证：AGPL-3.0。

## 2. 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Angular 16（Ivy，独立模块，PWA via `@angular/service-worker`） |
| UI | Bootstrap 5 + `@ng-bootstrap/ng-bootstrap` 15、`@ng-icons/bootstrap-icons` |
| i18n | `@ngx-translate/core` 15 + HttpLoader，语言文件 `src/assets/i18n/{en,zh}.json` |
| 本地存储 | `ngx-indexed-db`（IndexedDB，离线缓存游戏静态数据） |
| HTTP | `HttpClient` + 三个拦截器（Token / Error / Loading） |
| 监控 | `aegis-web-sdk`（腾讯 APM，spa pv + 接口/资源测速） |
| 工具 | `crypto-js`、`marked` + `dompurify`、`cropperjs`、`compare-versions`、`ngx-pagination` |
| 构建/质量 | Angular CLI、TSLint、Karma+Jasmine、Protractor(e2e)、Commitizen |
| TypeScript | `>=4.9.3 <5.1` |

## 3. 双后端架构

项目同时依赖两个后端，这是理解全局的关键。`ApiService`（`src/app/api.service.ts`）统一封装：

```
get/post/put/delete  → environment.apiServer      (RinNET 主站)
getLcdx/postLcdx     → environment.lcdxApiServer  (lcdx 后端)
```

### 3.1 主站 apiServer（RinNET / Aqua 衍生）

负责账号体系、游戏存档、钥匙芯片、游戏静态库。典型端点：

| 域 | 端点 |
|---|---|
| 认证 | `api/auth/signin`、`api/auth/signup`、`api/auth/resetPassword`、`api/auth/getVerifyCode`、`api/auth/getResetPasswordCode`、`api/auth/signin/oauth2/:code/:type` |
| 用户 | `api/user/me`、`api/user/profiles`、`api/user/checkUsernameAvailability`、`api/user/checkEmailAvailability` |
| 钥匙芯片 | `api/user/keychip`、`api/user/keychip/trustKeychip` |
| 管理 | `api/admin/users/loginas/:username`（管理员以他人身份登录） |
| 静态库版本 | `api/static/dbVersion` |
| 游戏数据 | `api/game/ongeki/data/{card,chara,music,skill,trophy}List`、`api/game/chuni/v2/data/{music,character,trophy,nameplate,sysvoice,mapicon,frame,avatar,symbolChatInfo}`、`api/game/maimai2/data/musicList` |

### 3.2 lcdx 后端 lcdxApiServer

独立服务，路径前缀均为 `lcdx/`。最近一次提交（`9c798dc 更换lcdxApiServer`）把开发地址从 `lcdxnet.sys-all.com.cn` 切到 `lcdxnet.am-allnet.com`。

| 域 | 端点 | 调用方 |
|---|---|---|
| 公告 | `lcdx/announcement/recent`（带 `lang`、`index`）、`lcdx/announcement/:id` | Dashboard、Announcements |
| 登录 | `lcdx/login`（账密）、`lcdx/onetime-v2/:token`（一次性令牌） | sign-in、onetime-sign-in |
| 注册 | `lcdx/register_start/:email`、`lcdx/register_confirm/:qq`（QQ 号注册） | sign-up |
| 绑定 | `lcdx/bind/:username/:netCode`（NetCode 绑定）、`lcdx/getBindAccessCode/:luid`、`lcdx/addAccessCode/:username`、`lcdx/removeAccessCode/:username` | netcode-bind、maimai2-setting |
| 排名 | `lcdx/kop/rank` | maimai2-kop-ranking |

> 注意：`TokenInterceptorService` **只对 `apiServer` 前缀的请求附加 `Authorization` 头**，lcdx 请求当前不携带本站 token——lcdx 有自己的鉴权与会话模型（登录后返回的 token 同样写入 `AccountService`）。

## 4. 目录结构（src/app）

```
app/
├─ app.component.*            根组件：侧栏 Offcanvas、标题拼接、SW 更新、初始化
├─ app.module.ts              根模块（聚合所有功能模块 + 拦截器 + 图标 + i18n）
├─ app-routing.module.ts      顶级路由
├─ api.service.ts             双后端 HTTP 封装 + loading 状态
├─ user.service.ts            当前用户（localStorage + api/user/me）
├─ menu.service.ts            游戏侧栏菜单（目前仅 maimai2）
├─ language.service.ts       语言切换
├─ theme.service.ts           Auto/Light/Dark 主题
├─ message.service.ts        全局消息（notice/toast）
├─ status-code.ts             统一响应状态码枚举
├─ auth/                      认证与守卫
│  ├─ account.service.ts      token 存储（currentAccount）
│  ├─ authentication.service.ts  登录/注册/改密（主站 + lcdx 双链路）
│  ├─ auth-guard.service.ts      已登录才放行
│  ├─ login-guard.service.ts     未登录可访问（已登录则跳转）
│  ├─ admin-guard.service.ts     管理员守卫
│  └─ *-interceptor.service.ts   Token/Error/Loading 拦截器
├─ dashboard/                登录后首页：档案/钥匙芯片/公告/数据库下载进度
├─ home/                     未登录首页
├─ sign-in/ sign-up/ onetime-sign-in/ oauth-callback/ password-reset/ profile/
├─ netcode-bind/             无卡时绑定 NetCode（Dashboard 自动跳转）
├─ cards/ keychip/           卡号与钥匙芯片管理
├─ importer/                存档导入
├─ database/                 preload.service.ts：IndexedDB 静态库预加载
├─ announcements/            公告列表 + 编辑（含 edit/、announcement 组件）
├─ contributors/ admin/ not-found/ message/ toasts-container.component.ts
├─ model/                    ApiResponse / Page / PropertyEntry
├─ util/                     管道与工具（formatnumber、to-date、ordinal、full-width、debounce、array-utils）
└─ sega/                     游戏模块（见第 6 节）
```

## 5. 路由与守卫

顶级路由（`app-routing.module.ts`），`data.disableSidebar` 控制是否隐藏侧栏：

| path | 组件 | 守卫 | 备注 |
|---|---|---|---|
| `''` | Home | — | 未登录首页，无侧栏 |
| `dashboard` | Dashboard | AuthGuard | 登录后中心页 |
| `announcements` | Announcements | AuthGuard | |
| `mai2` | Maimai2Module（懒加载） | canMatch AuthGuard | 唯一懒加载游戏模块 |
| `sign-in/up`、`onetime-sign-in`、`netcode-bind`、`oauth-callback`、`password-reset` | 各自组件 | LoginGuard（部分） | 无侧栏 |
| `not-found` | NotFound | — | |
| `**` | → `/not-found` | | |

> Ongeki / Chunithm V2 模块在 `AppModule` 中**直接 import**，未在顶级路由注册路径——它们通过 Dashboard 内的卡片或子路由进入（`ongeki.routing.ts`、`v2.routing.ts` 定义各自子路由 `RouterModule.forChild`）。仅 `maimai2` 走 `loadChildren` 懒加载。

### 各游戏子路由

- **maimai2** (`/mai2/*`)：profile、setting、recent、rating、photos、dxpass、servermissions、pointexchanges、kop、circle、festa、songlist、rival
- **ongeki**：profile、recent、song、battle、rating、card/gallery、card、rival、musicRanking、userRanking、settings
- **chunithm v2 (Chusan)**：profile、rating、recent、song、character、rival、userRanking、setting、userbox、`song/ranking/:id/:level`（单曲分数排名）

## 6. 游戏模块（src/app/sega）

三个 SEGA 街机游戏的玩家自助查询/管理界面：

- **maimai2**（舞萌 DX）：子模块最多，含圈子(festa/circle)、服务器任务(servermissions)、点数兑换(pointexchanges)、KOP 在线预选、DX Pass、相册、对手。最近多个提交聚焦于此（server missions & item exchange、festa 全圈排名等）。设置页支持 AccessCode 增删（经 lcdx 后端）。
- **ongeki**（音击）：含卡牌画廊、战斗点、新 rating 计算（`new-rating.service.ts`）、各类排名。
- **chunithm/v2**（中二节奏 Chusan）：profile/rating/recent/song/character/rival/userRanking/setting/userbox，含单曲分数排名。静态库最丰富（music/character/trophy/nameplate/sysvoice/mapicon/frame/avatar/symbolChat）。

每个游戏模块自带 `model/`（数据模型）与 `*.routing.ts`。ongeki 另有 `util/`。

## 7. 认证与会话

- **AccountService**：`currentAccount = { tokenType, accessToken }`，持久化于 `localStorage['currentAccount']`，`BehaviorSubject` 广播。
- **UserService**：`currentUser` 持久化于 `localStorage['currentUser']`，登录后 `api/user/me` 拉取。`User` 含 `roles[]`、`cards[]`（含 `extId`/`luid`/`cardExternalList`/`default`）、`defaultCard`、`keychips[]`、`userTrustKeychips[]`、`games[]`、`oauth2s[]`。
- **登录路径**（`AuthenticationService`，全部经 `procLoginResp` 写入 Account 并触发 `userService.load(true)`）：
  1. 主站账密：`api/auth/signin`（可附 `oAuth2Token`）
  2. OAuth2：`api/auth/signin/oauth2/:code/:type`，回调在 `oauth-callback`
  3. 管理员代登：`api/admin/users/loginas/:username`
  4. lcdx 账密：`lcdx/login`
  5. lcdx 一次性令牌：`lcdx/onetime-v2/:token`（onetime-sign-in 页）
- **注册路径**：
  - 主站：邮箱验证码 `api/auth/getVerifyCode` → `api/auth/signup`
  - lcdx：QQ 号注册 `lcdx/register_start/:email` → `lcdx/register_confirm/:qq`（`373ee5b 修复了qq号无法注册的bug` 即此处）
- **三个 HTTP 拦截器**（顺序：Error → Loading → Token）：
  - `TokenInterceptorService`：仅当 `request.url.startsWith(apiServer)` 且本地有 token 时附加 `Authorization: <type> <token>`。
  - `ErrorInterceptorService`：统一错误处理。
  - `LoadingInterceptorService`：驱动 `ApiService.loadingState`（`BehaviorSubject<boolean>`），`AppComponent.loading$` 消费显示全局 loading。
- **守卫**：AuthGuard（需登录）、LoginGuard（仅未登录）、AdminGuard（管理员）。

## 8. 离线静态数据库（PreloadService）

`src/app/database/preload.service.ts` 用 IndexedDB 缓存游戏静态元数据，避免每次都拉取大列表：

- **15 个 object store**：ongeki（card/character/music/skill/trophy）、chusan（music/character/trophy/nameplate/sysvoice/mapicon/frame/avatar/symbolChat）、maimai2（music）。
- **版本控制**：登录后 `AppComponent.initializeApp` → `preLoad.checkDbUpdate()`，对比 `localStorage['dbVersion']` 与 `api/static/dbVersion` 的 `version.major`；版本升高则清库重载并刷新页面。
- **加载策略**（`loader<T>`）：store 已有数据→直接 `OK`；为空→从主站拉取后 `bulkAdd`，状态 `Downloading`→`OK/Error`。
- `Dashboard` 订阅各 store 状态，统计 `totalPreloadTaskCount` / 下载中 / 完成 / 错误，展示数据库下载进度。
- **触发时机**：仅当 `accountService.currentAccountValue` 存在时（已登录）才 check。

## 9. 主题、语言、PWA

- **主题**：`ThemeService`，三档 Auto/Light/Dark，根组件 `themes`。
- **语言**：`LanguageService.getCurrentLang()`，`APP_INITIALIZER` 中 `translateService.use(userLang)` 预热；语言切换会重载公告（Dashboard 订阅 `translate.onLangChange`）。
- **PWA**：`ngsw-config.json` 两个 assetGroup（app prefetch / assets lazy），一个 `api` dataGroup（`performance` 策略，`maxSize:0`/`maxAge:0s` → 实际不缓存接口，仅超时兜底 86400s）。`AppComponent` 订阅 `SwUpdate.available` 自动激活并刷新。浏览器兼容性由 `supportedBrowsers.ts`（browserslist-useragent-regexp 生成）在启动时检测，不兼容则提示。

## 10. 构建与运行

```bash
npm run start        # ng serve --host 0.0.0.0 --port 443 （HTTPS 开发，ssl/ 在仓库内）
npm run build-prod   # ng build --configuration=production
npm run http         # http-server -p 8080 -c-1 dist/aqua-viewer （静态预览）
npm run commit       # commitizen 规范提交
npm run supportedBrowsers  # 重新生成 src/app/supportedBrowsers.ts
```

- `angular.json` 中 production 配置用 `fileReplacements` 把 `environment.ts` 换成 `environment.prod.ts`：
  - dev：`apiServer=https://portal.naominet.live/`、`lcdxApiServer=https://lcdxnet.am-allnet.com/`、`maiAssetsHost=https://rinnet.stehp.cn/`
  - prod：`apiServer='/'`、`lcdxApiServer='/'`（同源，依赖反向代理）、`maiAssetsHost=https://sdgb-dist.sys-all.com.cn/d/189/`
- `proxy.conf.json` 当前为空 `{}`（直连远端域名，无需代理）。

## 11. 近期演进脉络（git log）

最近提交集中在 **lcdx 整合** 与 **maimai2 功能扩展**：

- `9c798dc 更换lcdxApiServer` — lcdx 后端域名切换到 am-allnet.com
- `373ee5b 修复了qq号无法注册的bug` — lcdx QQ 注册链路
- `cbe67e6 改用XaCDN` — 资源 CDN 切换
- `b1dc075 feat(maimai2): implement server missions and item exchange`
- `95337b9 feat(maimai2): festa page show all circle rank`
- `01a03d6 feat(maimai2): improve ApiResponse and print message if api failed`
- `75db968 / 7d69842` 2026 版权年份

工作区当前有 `package.json` / `package-lock.json` 未提交改动。

## 12. 开发须知（load-bearing 约束）

1. **新增 lcdx 调用**用 `api.getLcdx/postLcdx`；新增主站调用用 `api.get/post/put/delete`。不要混用——Token 拦截器只覆盖主站。
2. **改路由**：maimai2 走 `loadChildren` 懒加载；ongeki/v2 在 `AppModule` 静态导入，其子路由靠各自 `*.routing.ts`。顶级 `**` 兜底到 `/not-found`。
3. **改用户字段**：`User` 接口被 `user.service.ts` 导出并被多处依赖；`localStorage['currentUser']` 与 `['currentAccount']` 是会话恢复依据，结构变更需兼容旧缓存或加清理。
4. **改静态库**：新增游戏静态数据时，需同步 `PreloadService.load()`、`clearDb()`、`Dashboard` 的状态订阅三处，以及 `ngsw`/IndexedDB schema。
5. **改环境地址**：同时改 `environment.ts` 与 `environment.prod.ts`；prod 用同源 `/`，部署侧需配反代把 `/lcdx/*` 转发到 lcdx 后端、`/api/*` 转发到主站。
6. **菜单可见性**：`MenuService.showItem` 依据 `DisplayCondition`（Always/AfterLogin/HasProfile/IsAdmin）与 `user.games`、`user.roles` 判定；新增游戏菜单需在此注册（目前仅 maimai2）。

## 13. 关键文件索引

| 关注点 | 文件 |
|---|---|
| 双后端封装 | `src/app/api.service.ts` |
| 认证全链路 | `src/app/auth/authentication.service.ts` |
| token 拦截边界 | `src/app/auth/token-interceptor.service.ts` |
| 当前用户/模型 | `src/app/user.service.ts` |
| 顶级路由 | `src/app/app-routing.module.ts` |
| 离线数据库 | `src/app/database/preload.service.ts` |
| 游戏菜单 | `src/app/menu.service.ts` |
| 仪表盘聚合 | `src/app/dashboard/dashboard.component.ts` |
| maimai2 路由 | `src/app/sega/maimai2/maimai2.routing.ts` |
| ongeki 路由 | `src/app/sega/ongeki/ongeki.routing.ts` |
| chunithm 路由 | `src/app/sega/chunithm/v2/v2.routing.ts` |
| 环境 | `src/environments/environment.ts` / `environment.prod.ts` |
| PWA | `ngsw-config.json` |
| 构建 | `angular.json`、`package.json` |
