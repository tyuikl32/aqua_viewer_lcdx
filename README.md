# RinNET Portal — LCDX fork

RinNET 门户前端的 **LCDX 分支**。上游是 `RinNET-OpenSource/RinNET_frontend`；本 fork 在其基础上
做业务定制，并配套本仓库同级的 **`LCDXNetApi`**（ASP.NET Core）自建后端。

> **这不是上游 RinNET。** 部署目标是 `lcdxnet.am-allnet.com`。上游那台 `portal.naominet.live`
> 在本 fork 里是**被依赖的外部服务**，不是"我们的站点"——详见下面的架构说明。
> 上游同步原则见「分支模型」一节。

技术栈：**React 19 + Vite 8 + TypeScript 7 + Tailwind v4 + shadcn/ui + Bootstrap 类名**。

---

## 架构：三块，别搞混

```
  ┌──────────────────────────────────────────────┐
  │  RinNET 主站                                  │
  │  https://portal.naominet.live                │
  │  上游作者的服务器，代码不在任何本地仓库         │
  │  提供 /api/auth/signin、/api/user/*、          │
  │       /api/game/maimai2/* 等游戏数据接口       │
  └──────────────────────────────────────────────┘
        ▲                              ▲
        │ ①后端调它                     │ ②浏览器直连它
        │  登录 / EULA / 管理员 token    │  取游戏数据
        │                              │
  ┌─────┴────────────────────┐   ┌─────┴──────────────────┐
  │ LCDXNetApi（本仓同级目录） │   │ 前端（本仓库）           │
  │ lcdxnet.am-allnet.com    │◄──│ lcdxnet.am-allnet.com   │
  │ 只提供 lcdx/* 路由        │③  │ 生产与后端同域           │
  │ 机台/权限/公告/引继/远程控制│   │                        │
  └──────────────────────────┘   └────────────────────────┘
        │
        ▼
  MySQL（ip.am-allnet.com） · 远控服务（at.am-allnet.com）
```

**要点：LCDX 后端不管游戏数据。** 游戏档案、Rating、歌曲列表那些页面是浏览器**直连 RinNET 主站**
拿的；`LCDXNetApi` 只负责机台管理、权限、公告、引继这些自建业务（路由统一 `lcdx/*`）。

前端里对应两个 API 客户端（`src/lib/api/client.ts`）：

| 客户端 | 指向 | 用途 |
|---|---|---|
| `api` | `API_SERVER = '/'`（dev 由 Vite 代理转发） | RinNET 主站接口 |
| `lcdx` | `VITE_LCDX_API_SERVER`（dev 直连 `lcdxnet.am-allnet.com`；生产同域 `/`） | LCDX 自建业务接口 |

### 所以 `portal.naominet.live` 不能删

它是**三层真实依赖**，三处都在用：

1. **后端** — `LCDXNetApi/appsettings.json` → `TitleSettings.RinnetHost`，被
   `LoginRegisterService.cs`（登录走 `/api/auth/signin`）、`EulaService.cs`、
   `RinnetAdminTokenService.cs` 消费。
2. **前端浏览器** — 游戏数据页直连。
3. **前端 dev 代理** — `vite.config.ts` 把 `/api` 与 `/Maimai2Servlet` 转发过去，
   否则 `npm run dev` 连登录都做不到。

唯一"死掉"的相关配置是 UI-parity 套件那条 hosts 记录（见「测试」）。

---

## 本地开发

域名必须与生产一致：**OAuth 回调地址、CDN referer 校验都依赖它**，且后端认证链路会打
`portal.naominet.live`。所以本地要把该域名解析到本机。

首次配置：

1. **hosts**：把 `127.0.0.1 portal.naominet.live` 加入
   `C:\Windows\System32\drivers\etc\hosts`
   （Windows 11 24H2+ 会拦截脚本写入，推荐用 PowerToys 的 Hosts File Editor 手动编辑）。
2. **证书**：`npm run gen:cert` 生成自签证书（SAN 含 `portal.naominet.live` / `localhost` /
   `127.0.0.1`），然后导入信任：
   ```
   certutil -addstore -user Root ssl\portal.naominet.live.crt
   ```
3. `npm ci`
4. `npm run dev` → <https://portal.naominet.live>

Vite dev server 通过代理保持与生产一致的**同源拓扑**：

- `/api` → `http://aqua.naominet.live`（**上游正式服，只读使用**；写操作仅限测试账号自身资源）
- `/Maimai2Servlet` → 同上（maimai2 头像上传走原始 servlet 路径）

LCDX 业务接口不走这两个代理 —— `.env.development` 里 `VITE_LCDX_API_SERVER` 直连
`https://lcdxnet.am-allnet.com/`。

### 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器（HTTPS，443 端口） |
| `npm run build` | `tsc -b` 类型检查 + `vite build` 打包 |
| `npm run preview` | 预览构建产物（继承 dev 的 HTTPS 配置） |
| `npm run test:lcdx-regression` | **本 fork 真正在用的**离线浏览器回归套件（见「测试」） |
| `node scripts/audit-i18n.mjs` | i18n 资源审计（四份 catalog + 插值变量 + 字面量 key） |
| `npm run gen:cert` | 生成本地自签证书 |

⚠️ **`npm run lint` 不可用** —— 仓库里没有 ESLint 配置，`eslint` 也不是声明依赖。

---

## 分支模型

| 分支 | 角色 |
|---|---|
| `master` | 主线。**当前仍指向旧 Angular 代码**，等待 React 版的最终采纳 |
| `legacy-angular` | 旧 Angular 代码的永久保留点，不要动 |
| `backup` | **上游 `RinNET_frontend` main 的镜像。只读，不要往上提交** |
| `test/lcdx-react-port-audit` | React 移植工作分支，最终 `master` 会 reset 到它 |

同步上游的流程：`git fetch upstream --prune` → 更新 `backup` → 把增量**按意图移植**到工作分支。

### 一条铁律：与上游对齐优先于本地整洁

**上游文件不要为了"顺手修一下"而改。** 每次本地改动都会变成下次上游同步的合并负担。

- 上游的 React 代码**保留 Bootstrap 类名**（`card` / `row` / `col` / `form-select` /
  `badge text-bg-*` / `page-heading`…），LCDX 页面**不要**改写成 shadcn/Tailwind 风格。
- 明知道有问题的上游文件，如果**在本 fork 里不生效**，就**留着别删**（例如 UI-parity 套件）——
  删了下次同步还得再改一遍。改成在文档里标注状态。
- 唯一的例外是**用户可见文案必须本地化**（见下）。

---

## 兼容性约定（用户无感切换）

与旧版 Angular 实现共享的存储，**键名/结构完全一致**：

- `localStorage`：`currentAccount`、`currentUser`、`colorTheme`、`lang`、`dbVersion`、
  `oauth_state`、`chusanMusicDb`
- `sessionStorage`（iframe 夺舍）：`impersonatedAccount`
- `IndexedDB`：库 `Aqua` v6，16 个 object store（游戏静态数据缓存）
- 主题属性：`<html data-theme="legacy|liquefy" data-color-scheme="dark|light">`；
  `data-bs-theme` 仅作为 Bootstrap 兼容输出

i18n 资源有两份副本，**必须同步**：`src/i18n/{zh,en}.json`（权威，被代码引用）与
`public/assets/i18n/{zh,en}.json`（PWA 静态副本）。

---

## 测试

| 套件 | 命令 | 状态 |
|---|---|---|
| **LCDX 离线回归** | `npm run test:lcdx-regression` | ✅ **有效**。起一个隔离的本地 HTTP Vite server（`127.0.0.1:5187`，无代理），fixture 拦截所有 `/api/` 与 `/lcdx/` 请求并屏蔽其他 origin。需要本机装有 Chrome（`channel: 'chrome'`），端口 5187 空闲。**不需要 hosts 或证书。** 用假凭据，不做真实后端写入 |
| 上游 UI-parity | `npm run test:ui-parity` | ⛔ **本 fork 不可用，且刻意保留** |

### 关于 UI-parity 套件（不可用，别修别删）

它的用途是拿**旧 Angular 产物**和 React 新版做逐像素/逐行为比对。那条基线路径是
`../aqua_viewer/dist/aqua-viewer/browser` —— **fork 之后这个目录不存在**
（`ls ../aqua_viewer` → not found），`scripts/serve-legacy-baseline.mjs` 开头的前置断言
会直接抛 `Legacy parity prerequisite is missing`，所以是**启动即失败**，不是偶发问题。

**刻意保留，不删**：这些文件（`playwright.parity.config.ts`、`tests/ui-parity/**`、
`scripts/{serve-legacy-baseline.mjs,add-hosts.ps1}` 及三个 npm script）**归上游所有**，
删掉只会在每次上游同步时再改一遍。它是**惰性的**：不在构建链、不在 CI
（`.github/workflows/deploy-test-server.yml` 只跑 `npm ci` + `npm run build`）、不进 `dist/`。

另：这些 spec 大半是 `chuni-*` / `ongeki-*` 页面，而这两个游戏在本 fork 里**已冻结**
（与上游对齐、本地不改），即使跑起来也不产生可执行结论。

**后端测试**：`dotnet test LCDXNetApi.slnx`（cwd = `LCDXNetApi`）。⚠️ **不要从 Bash 工具跑
`dotnet`**（已知环境损坏，见 `dotnet-windows-env-fix` skill）。

---

## 目录

```
src/
  main.tsx           # createRoot、installTheme()、夺舍引导
  app.tsx            # providers + 一次性启动（restoreAccess/loadUser）
  router.tsx         # createBrowserRouter 路由表 + 守卫
  pages/             # 应用级页面
    auth/            # SignIn / SignUp / PasswordReset / OauthCallback / OnetimeSignIn
  features/          # 按游戏/业务域划分
    mai2/            # maimai2 页面、DTO、页面级 CSS
    chuni/           # 冻结，见「游戏覆盖范围」
    ongeki/          # 冻结
  components/
    ui/              # shadcn/ui 原语（Radix，视为生成代码）
    shared/          # 跨功能组件（Pagination、BModal）
    shell/           # AppShell、Toasts、LoadingBar、ConfirmDialog
    theme/           # ThemeMenu
  lib/               # 框架无关逻辑（原 Angular services）
    api/client.ts    # `api` + `lcdx` 两个 fetch 客户端
    auth/            # account / access / auth / oauth / webauthn / impersonation
    db/              # IndexedDB（Aqua v6）访问 + 预加载
    store.ts         # createStore / useStore
    i18n.ts, message.ts, menu.ts, nav.ts, theme.ts, user.ts, botPermission.ts, …
  i18n/{zh,en}.json  # 打包的 i18n 资源（权威）
  styles/
    globals.css      # 入口；重建 --bs-* 令牌
```

> ⚠️ **CSS 是全局的。** React 没有 Angular 的组件样式隔离，组件 CSS 进的是全局作用域 ——
> 类名必须全局唯一，并按页面加前缀（例如 `cabinet-select*`）。跨页共用规则是刻意共享的。

### 游戏覆盖范围

**LCDX 部署只启用 maimai2**：侧栏只有 maimai2 分组（见 `src/lib/menu.ts`）。

`chuni/`（ChuniV2，约 27 个文件）与 `ongeki/` 的代码和路由**仍在仓库里**（直接敲 URL 可达），
但站内没有任何菜单/链接指向它们，普通用户触达不到。

**🚫 这两个游戏的功能一律不动** —— 不改代码、不补 i18n、不修 bug、不调样式、不重构。原因：
这部分要跟上游 `RinNET_frontend` 对齐，上游一更新这里就得跟着改，本地任何改动都会变成
移植/合并负担。因此新规则只需在 **mai2 页面**落地并验证即可。

---

## 用户可见文案必须本地化

后端 `status.message` 是英文，**禁止**直接透传给用户。所有成功/失败提示走 i18n：

```ts
notice(t('Key'));                              // 成功
notice(t('Common.OperationFailed'), 'warning'); // 通用失败
```

新增 key 时 `zh.json` / `en.json` **两份都要加**，且 `src/i18n/` 与 `public/assets/i18n/`
两份副本**必须同步**。用 `node scripts/audit-i18n.mjs` 校验。

---

## 许可证

本项目采用 GNU Affero General Public License v3.0 或更高版本（AGPL-3.0-or-later）授权。
完整许可条款见 [LICENSE](LICENSE)。
