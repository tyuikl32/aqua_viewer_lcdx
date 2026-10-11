# 根因取证：Edge 概率性卡在「游戏数据 · 检查更新」

> 取证日期 2026-10-12。全部结论基于**只读**观测：源码阅读、浏览器 profile 文件解析、服务器配置与日志读取、curl 实测。
> 未改动任何代码、配置或浏览器数据。

## 1. 现象

| 维度 | 观察 |
| --- | --- |
| 症状 | dashboard 右侧「游戏数据」卡片永久显示「检查更新」+ spinner，不推进、不报错 |
| 概率性 | 「有概率」出现，非必现 |
| 浏览器相关性 | Edge 复现，**Chrome 正常** |
| 用户尝试 | 清缓存 → 无效；清缓存 + cookie → **仍无效** |

## 2. 代码链路（含行号）

```
app.tsx:64  App 挂载 → useEffect
├─ app.tsx:67  registerSW()                       vite-plugin-pwa 注册器
└─ app.tsx:68  initializeApp()
   ├─ app.tsx:26  if (!getAccount()) return;      未登录直接终止整链
   ├─ app.tsx:28  await restoreAccess()           → api.get('api/account/status')
   ├─ app.tsx:33  void checkDbUpdate()            不 await，与 loadUser 并行
   └─ app.tsx:34  await loadUser()                → api.get('api/user/me')

checkDbUpdate()  preload.ts:74
├─ preload.ts:75  checkingUpdate.set('checking')  ← UI 进入「检查更新」
├─ preload.ts:77  await api.get('api/static/dbVersion')
├─ preload.ts:86  loadAll()                       仅当 state 含 'success'
└─ preload.ts:91  catch → loadAll(); set('error')  ← catch 永不触发时无出口

loadAll() → loader() ×16  preload.ts:34 / :40
├─ preload.ts:42  await dbCount(store)            ← 在返回前不写任何状态
├─ preload.ts:49  await api.get(url)              16 个 catalog
└─ preload.ts:54  await dbBulkAdd(store, data)

perform()  client.ts:121
└─ client.ts:132  await fetch(url, {method, headers, body})   ← 无 signal / 无超时
```

关键代码事实：

- `client.ts:121 perform()` 的 `fetch` **从未传入 `signal`**，也没有任何超时封装；`rawFetch`（:69）同样。
- `preload.ts:40 loader()` 在 `await dbCount(store)` **之前不设置任何状态**，所以该 store 在 `preloadStates` 中的值是 `undefined`。
- `DashboardPage.tsx:204` 的 `preloadStats`：
  ```ts
  const total = 16;                                  // 硬编码
  const downloading = values.filter(s => s === 'Downloading').length;
  const completed  = values.filter(s => s === 'OK').length;
  const error      = values.filter(s => s === 'Error').length;
  const loadingDatabase = completed + error < total;  // 关键
  ```
- `DashboardPage.tsx:423` 显示「检查更新」的条件：
  ```tsx
  {(checking === 'checking' || (preloadStats.loadingDatabase && preloadStats.downloading === 0)) && ( ... )}
  ```

## 3. 结构性缺陷：任何故障都伪装成同一个外观

`states` 初始为 `{}`，`checkingUpdate` 初始为 `null`。代入上式：

```
checking === 'checking'                      → false（是 null）
loadingDatabase = 0 + 0 < 16                 → true
downloading     = 0                          → true
⇒ 条件整体为 true ⇒ 渲染「检查更新」+ spinner
```

**即：页面初始态本身就显示「检查更新」。** 于是以下四种**本质不同**的情况会渲染出**完全相同**的画面，且都没有退出路径：

| # | 真实情况 | 状态表现 | 是否有出口 |
| --- | --- | --- | --- |
| A | `getAccount()` 为假，`initializeApp` 提前 return | `checking=null`, `states={}` | 无 |
| B | `restoreAccess()` 挂起 | `checking=null`, `states={}` | 无 |
| C | `checkDbUpdate()` 中 `dbVersion` 请求挂起 | `checking='checking'` | 无（`catch` 不会触发） |
| D | `loadAll()` 中 `dbCount` 挂起 | `checking='completed'`, `states={}` | 无 |

这是本次故障「看起来一直卡在同一处」的直接原因，也是**可观测性缺陷**：不加埋点无法从 UI 区分 A/B/C/D。

## 4. 浏览器侧客观事实（Edge vs Chrome）

| 检查项 | Edge | Chrome |
| --- | --- | --- |
| `IndexedDB/https_lcdxnet.am-allnet.com_0.indexeddb.leveldb` | **不存在** | **存在**（10-11 20:24） |
| CacheStorage（真实目录 `232e5cfc…`） | 无该 origin 目录 | 存在，但 8 个 cache **全部为 2026-08-23/24 的陈旧残留**，10 月无任何写入 |
| `User Data` 体积 | 2726.6 MB | 222.9 MB |
| `Cache_Data` / `Code Cache` / `Service Worker` / `IndexedDB` | 365.2 / 299.0 / **426.2** / 292.9 MB | 51.3 / 11.7 / 5.1 / 7.9 MB |
| IndexedDB origin 目录数 | 213 | 11 |
| `Network Persistent State` | 102.6 KB（`servers` 500 条） | 20.8 KB（86 条） |
| 扩展数 | 20 | — |
| `ScriptCache` 残留注册 | `sw.js` + `workbox-9c191d2f.js`（含哈希）+ **`ngsw-worker.js`（Angular 旧版）** | — |

**决定性观测**：用户清数据后重新访问 —— Edge 的 `IndexedDB` 目录 mtime 推进到 **01:01**、`Service Worker` 目录 **01:00**（证明页面确实启动并运行了 SW），但 `https_lcdxnet.am-allnet.com_0.indexeddb.leveldb` **依然未被创建**。

`openDB('Aqua', 6)` 只在 `loadAll()` → `loader()` → `dbCount()` 路径上被间接触发，而 `loadAll()` 只在 `dbVersion` 成功返回后才调用。库文件从未生成 ⇒ **代码从未走到 `loadAll()`** ⇒ 卡点必定早于它。这排除情况 D，把范围收敛到 **A / B / C**。

## 5. 服务器侧客观事实

| 项 | 结果 | 判读 |
| --- | --- | --- |
| `/api/static/dbVersion` 响应时间（服务器侧 ×10） | 3.58 / 3.59 / 3.59 / 3.62 / 3.62 / 3.64 / 3.66 / 3.67 / 3.89 / 4.18 s | 常态即 ~4s，**非偶发挂起** |
| 上游 `portal.naominet.live` 直连 ×5 | 3.63–4.15 s | 慢在上游（EdgeOne CDN），不是本站 nginx |
| 目录页 TTFB（直连） | 71 ms | 服务器健康 |
| 1.5 MB JS 下载 | 0.29 s（5.2 MB/s） | 带宽正常 |
| `lcdxnet.am-allnet.com.error.log` | 空 | 无服务器侧错误 |
| `limit_conn` | 未启用（仅定义了 zone） | 排除连接数限制 |
| `proxy.conf` 全局 `proxy_cache` | 存在但无 `proxy_cache_valid`；实测 `/lcdx/cabinet/global-players` 两次均 `x-cache: MISS` | 当前未被缓存 |
| access_log（00:02–00:41，14 行） | 只有 `/api/auth/refresh`、`/lcdx/cabinet/global-players`；**无 `/api/static/dbVersion`** | 支持「请求未发出/未到达」 |

## 6. 已排除的假设

| 假设 | 证伪依据 |
| --- | --- |
| **HTTP/3 / QUIC 挂起** | 两浏览器的 `Network Persistent State` 中，该 origin **均无 `alternative_service` 记录**（仅有 `supports_spdy`），`broken_alternative_services` 均为 0 ⇒ 实际从未启用 h3。经系统代理时 Chromium 默认不使用 QUIC。 |
| **Service Worker 拦截该请求** | `sw.js` 仅注册 `precacheAndRoute`（清单无 `/api/*`）与 `NavigationRoute`（仅 `mode==='navigate'`）；`/api/static/dbVersion` 两者皆不匹配。已含 `cleanupOutdatedCaches()`。 |
| **服务器配置（缺 Cache-Control / h3 / 连接限制）** | 上述静态资源缓存头问题真实存在，但与本故障无因果；服务器响应时间稳定、日志干净。 |
| **浏览器「关闭时清除站点数据」** | 两浏览器 `Preferences` 中均无 `clear_browsing_data_on_exit` 键。 |
| **`/api/` 反代被 nginx 代理缓存污染** | 实测 `X-Cache: MISS`，且无 `proxy_cache_valid`。 |
| **清缓存能修复** | 用户实测「清缓存 + cookie 后仍不行」；且清空 IndexedDB 会让恢复路径更长，与结论反向一致。 |

## 7. 机理分析：三条缺陷叠加

**不是单一 bug，而是三个叠加的设计问题：**

1. **启动链无界**（`app.tsx:28/33/34` + `preload.ts:42/49/77` + `client.ts:132`）
   三跳网络请求与 IndexedDB 操作全部无超时。任一处进入 pending，其上层 `await` 永不返回，`catch` 永不执行 —— **失败出口在物理上不存在**。

2. **UI 把「未知」渲染为「进行中」**（`DashboardPage.tsx:210/423`）
   `completed + error < 16` 把「什么都没开始」判定为「正在加载」。这既掩盖了真实状态，也让任何故障都不可诊断。

3. **恢复路径只有「全清重来」**（`preload.ts:68 reload()`、`preload.ts:82`）
   `clearDb()` + `window.location.reload()` 丢弃全部已完成数据。失败一次代价极高，且没有增量续传，用户唯一的自愈手段是手动清站点数据。

**为什么 Edge 更容易中招**：Edge 该 origin 的站点数据（IndexedDB / CacheStorage）不存在，因此每次进入都走「新建库 → 16 store 全空 → 全量下载」的**最长路径**；叠加其 2.7 GB 的 profile（SW 缓存 426 MB、20 个扩展），磁盘 I/O 与 SW 启动窗口都更长，暴露在无界等待下的概率显著高于 Chrome（后者已有完整 `Aqua` 库，`dbCount` 立即返回非 0，16 项瞬间全 `OK`）。

**关于 §3 表 A/B/C 的取舍**：现有证据（IndexedDB 目录未生成 + 日志无该请求）只能确定卡点在 `loadAll()` 之前。A（未登录提前 return）与 B（`restoreAccess` 挂起）与 C（`dbVersion` 挂起）在现有观测下**不可区分** —— 这本身就是 R3/AC2 要修的可观测性缺陷。三者都以「无界等待」为共同根因，因此**加固方案对三者同等有效**，无需先确定具体是哪一种才能开工。

## 8. 未决问题与验证方法

| 未决问题 | 验证方法 |
| --- | --- |
| 卡点究竟是 A / B / C 中哪一个 | Edge 打开 dashboard → F12 Network：观察 `api/account/status`、`api/static/dbVersion`、`api/user/me` 三者谁是 `Pending`；同时在 Application → IndexedDB 看 `Aqua` 是否出现 |
| 请求是「未发出」还是「发出后挂起」 | Network 面板 Timing 分栏：`Stalled`/`Queueing` ⇒ 未发出（连接层）；`Waiting (TTFB)` ⇒ 已发出（服务端/链路） |
| SW 启动窗口是否是诱因 | 在 `edge://serviceworker-internals/` 注销该 origin 的注册后复测；对比 Pending 是否消失 |
| 清站点数据后是否可复现 | 已测：不可靠修复，复现仍在 |

以上验证应在**实施加固前**由用户在生产 Edge 上执行一次，用于固化 §7 的机理判断；即便不做，加固方案（见 `design.md`）也覆盖全部三种情形。

---

## 9. 第六轮（用户补充线索后）：最终根因 —— SPA 生命周期缺陷

### 9.1 用户补充的关键线索

> 我刚刚关闭 Chrome，再次打开选择了还原页面，然后退出登录，再登录就卡住了。
> 用 DevTools 停用缓存秒正常，所以我一开始以为缓存坏了。

三条新事实，直接改写结论：

1. **Chrome 也能复现** ⇒ 与浏览器无关，「Edge 特有」的假设被推翻。
2. **触发序列是「还原页面 → 退出登录 → 再登录」** ⇒ 指向**会话与生命周期**，而非网络。
3. **「停用缓存后正常」** ⇒ 用户的归因（缓存）**是误判**，见 §9.4。

### 9.2 根因（代码级、确定性）

`app.tsx:20-38`：

```ts
let initializationPromise: Promise<void> | null = null;

function initializeApp(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      if (!getAccount()) return;          // ← 未登录时在此提前 return
      const status = await restoreAccess();
      if (status?.banned) { navigate('/banned'); return; }
      void checkDbUpdate();               // ← 唯一的调用点
      await loadUser();
    })();
  }
  return initializationPromise;           // ← 已 resolve 的 promise 被永久缓存
}
```

调用点唯一：`app.tsx:68` 的 `App` 组件 `useEffect(..., [])`。

**缺陷**：未登录时函数提前 `return`，但 `initializationPromise` **已被赋值且永不重置**。此后任何再次调用都直接返回那个「什么都没做」的 promise。

配合两处路由事实：

- `SignInPage.tsx:65/94` 登录成功走 **`await navigate('/dashboard')`** —— React Router 的 SPA 内导航，**`App` 组件不重新挂载**，`useEffect([])` **不重跑**。
- `router.tsx:80` `RequireAuth` 在未登录时 `<Navigate to="/" />`；`RequireGuest` 在已登录时把 `/sign-in` 弹回 `/dashboard`。

**故障序列**：

```
① 未登录状态进入页面（典型成因：清了 Cookie 及网站数据 → localStorage 账号被清）
   ⇒ App 挂载 ⇒ initializeApp() ⇒ getAccount()=null ⇒ return
   ⇒ initializationPromise 被赋值为「已 resolve 的空 promise」并永久缓存

② 用户完成登录 ⇒ navigate('/dashboard')（SPA 内）⇒ App 不重挂载
   ⇒ initializeApp() 不会再被调用 ⇒ checkDbUpdate() 永远不会执行

③ DashboardPage 读到 checkingUpdate = null、preloadStates = {}
   ⇒ loadingDatabase = 0+0 < 16 = true，downloading = 0
   ⇒ 命中 DashboardPage.tsx:423 的条件 ⇒ 永久渲染「检查更新」+ spinner

④ 无论怎样退出登录、再登录（都是 SPA 内导航），该状态都不变
   ⇒ 只有整页刷新才能重置 initializationPromise ⇒ 现象「永不自愈」
```

### 9.3 与全部既有铁证的逐条吻合

| 铁证 | 本根因的解释 |
| --- | --- |
| `https_lcdxnet.am-allnet.com_0.indexeddb.leveldb` 始终未生成 | `loadAll()` 从未被调用（`checkDbUpdate` 从未执行）⇒ `openDB` 从未发生 |
| access_log 完全没有 `/api/static/dbVersion` | 该请求**从未发出** |
| `checkingUpdate` 停在初始值导致卡片显示「检查更新」 | §9.2 ③ |
| 清 Cookie 后仍然不行（甚至更稳定复现） | 清 Cookie **正是**「未登录进入」路径的制造者 |
| Chrome / Edge 都复现 | 纯逻辑缺陷，与浏览器无关 |
| 「有概率」 | 取决于进入页面时是否已登录 |
| 关闭再打开、还原页面后出现 | 还原页面 = 一次完整的「冷加载」，正是 ① 的入口 |

**注意**：`account.ts` 用的是 `localStorage`（`currentAccount`）而非 Cookie，因此 Chrome「清除浏览数据 → Cookie 及其他网站数据」会连带清掉账号 —— 这就是「清了反而更糟」的成因。

### 9.4 为什么「停用缓存」看起来有效 —— 归因误判

DevTools 的 Disable cache 通常**伴随一次刷新**使用。而本故障的恢复条件恰好是**整页刷新**（重置模块级 `initializationPromise`，且刷新时已持有登录态，`initializeApp` 得以走完）。

**因此真正起作用的是刷新，不是禁用缓存。** 判定方法：卡住时**只按 F5、不勾 Disable cache** —— 若同样恢复，则与缓存无关。

### 9.5 本轮顺带确证的两处旁证（非根因）

1. **HTTP 缓存堆积多版本产物**：Chrome 的 `Cache/Cache_Data` 内含 6 个 `index-*` 版本（含当前的 `index-C2H2T8ha.js` 与旧的 `index-Cf5fOTVN.js`），Edge 含 **25 个**。这与服务器 `assets/` 保留两代产物、且 `index.html` 无 `Cache-Control` 有关。**但 HTTP 缓存中未发现 `index.html` 本体**（以 `themeFamily` 特征串反查无命中），故它不构成本次卡死的直接原因，属**待清理的历史债**。
2. **Service Worker 的 precache 从未建立**：Chrome 的 CacheStorage 下该 origin 只有 8 个 **2026-08-23/24** 的陈旧 cache（应为 Angular `ngsw` 时代残留，含 `api/game/...`、`api/user/profiles`、`assets/i18n/*.json` 条目），10 月无任何写入 ⇒ Workbox 的 `workbox-precache-v2-*` **不存在**。这意味着 `NavigationRoute` 绑定的 `index.html` 处理器始终未命中 → **每次导航都回退网络**，属性能损耗与状态不干净，但**不阻塞**。

> **修正说明**：本轮推翻了此前「该 origin 的 CacheStorage 分片不存在」的判断 —— 那是由于我把分片目录名误当作 `SHA1(origin)` 计算所致，真实目录名为 `232e5cfcd8a0a5660594d7d76c0d3f8a38d2339d`。结论本身（SW precache 为空）不变，但依据需按本节更正。

### 9.6 最终根因排序

| 级别 | 缺陷 | 位置 | 作用 |
| --- | --- | --- | --- |
| **P0** | `initializeApp` 未登录路径下缓存空 promise，且登录为 SPA 内导航 ⇒ `checkDbUpdate` 永不执行 | `app.tsx:20-38` | **直接根因** |
| **P0** | UI 把「从未开始」渲染为「检查更新」，无失败出口 | `DashboardPage.tsx:204/423` | 把缺陷伪装成永久加载 |
| **P1** | 初始化链与 preload 全部无超时/重试/终态 | `client.ts:132`、`preload.ts:42/49/77` | 放大因素：把「未执行」与「挂起」都变成永久态 |
| **P2** | 恢复路径只有 `clearDb()+reload()`，无增量续传 | `preload.ts:68/82` | 失败代价过高 |
| **P3** | `index.html` 无 `Cache-Control`、`assets/` 保留旧产物、SW precache 为空 | 服务器 / SW | 历史债，非本次直接成因 |

---

## 10. 上游对比：为什么上游「怎么测都没问题」，以及这不是 EdgeOne 的原因

### 10.1 提出的假设

> 上游是不是因为走 EdgeOne CDN，所以没这个问题？

**否。** EdgeOne 是 CDN，**不执行页面 JS**。而本故障的全部机制（`initializationPromise` 模块级单例、`navigate()` SPA 路由、`checkingUpdate` store）都发生在浏览器内，CDN 无从干预。唯一能通过 CDN 影响前端的途径是缓存/改写 HTML 与静态资源，而本故障不依赖资源内容。

### 10.2 对比方法与结果

本地上游工作副本：`E:/ALL.Net/RinNET_frontend`（`master`，HEAD `593510f`，同为 React 版）。

**三处关键实现，逐一相同：**

| 检查点 | 上游 | 本仓（修复前） |
| --- | --- | --- |
| `app.tsx` 的 `initializationPromise` 单例 + `if (!getAccount()) return` 位于 async 内部 | **相同** | 相同 |
| `procLoginResp` 是否调用 `checkDbUpdate` | **都没有** | 都没有 |
| `DashboardPage` 的条件 `checking === 'checking' \|\| (loadingDatabase && downloading === 0)` | **完全相同** | 相同 |

⇒ **上游带着一模一样的缺陷。**

**一处关键差异（这就是答案）：**

| 登录成功后的跳转 | 上游 | 本仓 |
| --- | --- | --- |
| `SignInPage.tsx` | **`window.location.reload()`**（:111 / :140 / :168） | `await navigate('/dashboard')`（:65 / :94） |
| `SignUpPage.tsx` | `window.location.reload()`（:184） | `await navigate('/dashboard')`（:103） |

### 10.3 时序推演

```
上游（reload 语义）：
  退出登录 -> logout().then(() => location.assign(''))   整页重载
  -> 未登录，initializeApp 提前 return（单例被污染）
  -> 登录成功 -> window.location.reload()               整页重载！
  -> 模块重新求值，initializationPromise 重置为 null
  -> 此时已登录 -> initializeApp 走完 -> checkDbUpdate() 正常执行  ✅ 缺陷被掩盖

本仓（SPA 语义）：
  退出登录 -> logout().then(() => location.assign(''))   同样整页重载
  -> 未登录，initializeApp 提前 return（单例被污染）
  -> 登录成功 -> navigate('/dashboard')                 SPA 内导航，App 不重挂载
  -> initializationPromise 仍是那个「已 resolve 的空 promise」
  -> checkDbUpdate() 永不执行 -> 卡片永久「检查更新」              ❌ 缺陷暴露
```

**上游的 `window.location.reload()` 每次都顺手重置了整个模块状态**，于是这个缺陷在上游**从未被触发过**。它属于**潜伏缺陷（latent defect）**：只要上游哪天把登录后的 reload 优化成 SPA 导航，就会立刻复现同一个故障。

### 10.4 拓展结论：本仓哪些模块级状态失去了 reload 兜底

上游用整页重载隐含地重置了所有模块级单例；本仓改走 SPA 导航后，这些单例的正确性不再有兜底。逐个核对本仓（与上游列同一份清单）：

| 单例 | 位置 | 是否自愈 | 判定 |
| --- | --- | --- | --- |
| `initializationPromise` | `app.tsx:20` | ❌（修复前） | **本次根因，已修（`dc21368`）** |
| `dbPromise` | `lib/db/db.ts:173` | ❌ 无重置路径 | **同类隐患**，正常路径不会坏；仅当 `openDB` 因 `blocked` 长期 pending 时污染后续全部 `getDb()`。属 design.md 的 **L2** |
| `refreshPromise` | `lib/api/client.ts:75` | ✅ `.finally` 重置 | 安全 |
| `loadPromise` | `lib/auth/access.ts:13` | ✅ `.finally` 重置 | 安全 |
| `loadPromise` | `lib/user.ts:37` | ✅ `.finally` 重置 | 安全 |
| `bootstrapPromise` | `lib/auth/impersonation.ts:31` | 需复核 | 夺舍场景，非本次范围 |
| `refreshTimer` / `navigateFn` / `nextId` / theme 状态 | 各处 | ✅ 由 effect 或纯递增管理 | 安全 |

⇒ **本仓真正无自愈的单例只有两个：`initializationPromise`（已修）与 `dbPromise`（列在 L2）。**

### 10.5 建议

1. **本仓**：保留 `navigate('/dashboard')` + L0 的幂等修复。这比上游的整页重载更快，且已消除缺陷；**不要**退回 `reload`。
2. **上游**：该缺陷是潜伏的，建议向上游提 issue/PR，至少把 `initializeApp` 幂等化（未登录不缓存单例）。这不是「本仓特有问题」，而是**上游也存在的定时炸弹**。
3. **移植约定（建议写入 spec）**：从上游移植时，凡上游依赖「整页 reload 重置」的模块级单例，若改为 SPA 导航，必须逐个重新审计是否需要显式重置。本次即为此类移植差异的直接后果。
