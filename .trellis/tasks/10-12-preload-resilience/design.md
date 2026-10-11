# 技术设计：游戏数据预载健壮性加固

> 对应 PRD `prd.md`，取证依据 `research/root-cause-forensics.md`。
> 状态：**设计稿，未实施**。凡涉及取值的参数均标注为「建议值」，需在实施前按 §10 的探针实测校正。

## 0. 设计目标

**根治**的定义：不是让故障变少，而是让这类故障**在架构上不可能表现为永久无响应**。

对应 §7 提出的三条叠加缺陷，方案分三个方向同时闭合：

| 缺陷 | 根治方向 | 落点 |
| --- | --- | --- |
| 启动链无界（无超时/重试/出口） | **有界化** | L1 请求层 + L2 存储层 |
| UI 把「未知」渲染为「进行中」 | **消除歧义** | L3 显式状态机 |
| 恢复只有「全清重来」 | **可增量续传 + 降级可用** | L4 meta 与任务队列 |

一句话：**任何一步都必须能失败；失败都必须可重试；重试都必须有尽头；有尽头就都必须有出口。**

## 0.5 L0 初始化生命周期修复（P0 — 直接根因，改动最小）

> 依据 `research/root-cause-forensics.md` §9。**这一层才是本次故障的直接根因**；L1–L4 是把同类问题彻底关死的结构性加固。

### 0.5.1 问题

`app.tsx:23-38` 的 `initializeApp()` 在**未登录时提前 `return`，却把 `initializationPromise` 赋值为一个「什么都没做」的已 resolve promise 并永久缓存**；而登录成功走 `SignInPage.tsx:65/94` 的 `navigate('/dashboard')` 属 **SPA 内导航**，`App` 不重挂载、`useEffect([])` 不重跑。于是：

```
未登录进入页面（如清过 Cookie/站点数据）
  → initializeApp() 提前 return，promise 被缓存
  → 用户登录（SPA 内导航到 /dashboard）
  → initializeApp() 永不再次执行 ⇒ checkDbUpdate() 永不调用
  → checkingUpdate 保持 null + preloadStates 为空
  → DashboardPage 命中 (loadingDatabase && downloading === 0) ⇒ 永久「检查更新」
```

**只有整页刷新才能恢复**——这正是「清缓存无效、刷新（或似乎勾了 Disable cache）就好」的真实机制。

### 0.5.2 修复设计（三层，建议全做）

**① 让 `initializeApp` 幂等可重入，未登录不污染单例**（`app.tsx`）

```ts
function initializeApp(): Promise<void> {
  if (!getAccount()) {                    // 未登录：不缓存「空初始化」
    initializationPromise = null;
    return Promise.resolve();
  }
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const status = await restoreAccess();
      if (status?.banned) { navigate('/banned'); return; }
      void checkDbUpdate();
      await loadUser();
    })().catch(() => { initializationPromise = null; });   // 失败同样不缓存
  }
  return initializationPromise;
}
```

**② 登录成功后显式触发**（`SignInPage.tsx` 两处 `navigate('/dashboard')` 之前）

```ts
void initializeApp();     // 幂等：已初始化则直接返回
await navigate('/dashboard');
```

**③ 页面自保：dashboard 入口兜底触发**（`DashboardPage.tsx`）

```ts
useEffect(() => {
  if (!getAccount()) return;
  if (checkingUpdate.get() === null) void checkDbUpdate();   // 幂等 guard，避免重复
}, []);
```

> ①③ 是纵深防御：① 修根因，③ 保证即使将来又出现「初始化没跑到」的路径，**进入 dashboard 本身也会自愈**。

### 0.5.3 配套 UI 消歧义（P0-2）

`checking === null` 与 `checking === 'checking'` 必须在视觉上分离，`DashboardPage.tsx:210/423` 的 `loadingDatabase && downloading === 0` hack 整体删除：

```tsx
{checking === null && <span className="text-secondary">{t('DashboardPage.NotStarted')}</span>}
{checking === 'checking' && ( /* 检查更新 + spinner */ )}
{checking === 'loading'  && ( /* 下载中 x/16 + spinner */ )}
{checking === 'completed' && ( /* ✓ 版本：{dbVersion} */ )}
{(checking === 'error' || checking === 'timeout') && ( /* ✕/⚠ + 原因 + 「重试」按钮 */ )}
```

新增 i18n 键（**四份**资源同时改：`src/i18n/{zh,en}.json` + `public/assets/i18n/{zh,en}.json`）：
`DashboardPage.NotStarted`、`DashboardPage.Retry`、`DashboardPage.CheckTimeout`、`DashboardPage.IdbBusy`。

### 0.5.4 本层验收

- [ ] **AC0-1**：清除该站点全部数据 → 冷加载（未登录）→ 登录 → 进入 dashboard，**卡片必须正常完成**，不得停在「检查更新」。（代码已落地；待人工运行时验证）
- [ ] **AC0-2**：卡住时按 F5（**不勾** Disable cache）必须恢复；不恢复即为未修好。（待人工）
- [x] **AC0-3**：`checking === null` 时有独立文案，不显示 spinner。（已实现，静态可证）
- [ ] **AC0-4**：连续进入 dashboard 两次，`checkDbUpdate` 只发起一轮 `dbVersion` 请求（幂等 guard 生效）。（守卫已落地；待人工计数验证）

> 实施记录与提交清单见 `implement.md`。

## 1. 架构总览

```
                    ┌─────────────────────────────────────┐
   app.tsx          │ L5 启动链（降级可用，不阻塞首屏）      │
                    └───────────────┬─────────────────────┘
                                    │
                    ┌───────────────▼─────────────────────┐
   preload.ts       │ L3 显式状态机 + L4 任务队列（增量）    │
                    └───────────────┬─────────────────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              │                                           │
   client.ts  ▼                              db.ts         ▼
   ┌────────────────────────┐      ┌──────────────────────────┐
   │ L1 有界请求            │      │ L2 有界存储              │
   │ fetchWithTimeout       │      │ openWithTimeout          │
   │ withRetry(退避+抖动)   │      │ blocked/terminated       │
   │ ApiError(可判定)       │      │ handle 代际守卫          │
   └────────────────────────┘      └──────────────────────────┘
```

## 2. L1 有界请求层（`src/lib/api/client.ts`）

### 2.1 前置重构：可判定的错误类型

**这是 R2 的硬前提。** 当前 `client.ts:105 handleErrorResponse` 抛的是**裸字符串**（`throw error;` 其中 error 为 `string`），调用方无法区分 5xx 与 4xx，重试白名单无从实现。

```ts
export type ApiErrorKind = 'http' | 'timeout' | 'network' | 'aborted';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly httpStatus?: number;   // HTTP 状态码
  readonly statusCode?: number;   // 业务码（body.status.code）
  readonly url: string;
  readonly attempts: number;
  constructor(init: { kind: ApiErrorKind; message: string; url: string;
                      httpStatus?: number; statusCode?: number; attempts?: number });
}
```

`handleErrorResponse` 改为返回 `ApiError` 而非抛字符串，**保留**其既有副作用：`ACCOUNT_BANNED` → `dispatchEvent('rinnet-account-access-error')` + `navigate('/banned')`；401 且有账号 → `clearAccount()` + `location.reload()`。

> 兼容性：`perform()` 的既有调用方全部只做 `.then/.catch`，不解析错误类型，因此改错误类型是**向后兼容**的；但 `catch` 中若曾 `String(error)` 展示给用户，需改为经 i18n 映射（R7）。

### 2.2 超时包装

```ts
const DEFAULT_TIMEOUT_MS = 15_000;   // 建议值

async function fetchWithTimeout(url: string, init: RequestInit,
                                timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const timeoutCtl = new AbortController();
  const timer = setTimeout(
    () => timeoutCtl.abort(new DOMException('request timeout', 'TimeoutError')),
    timeoutMs,
  );
  try {
    return await fetch(url, { ...init, signal: timeoutCtl.signal });
  } finally {
    clearTimeout(timer);
  }
}
```

要点：
- **超时必须转成 `reject`**，这是让上层 `catch`（`preload.ts:90`）重新可达的唯一手段。
- 若将来需要把外部 `signal` 与超时 `signal` 合并，用 `AbortSignal.any([a, b])`；**实施前须确认 `supportedBrowsers.ts` 的最低版本支持该 API**（Chrome 116+/Edge 116+），否则退化为手写桥接，不要引入 polyfill 依赖。
- 超时值取 **15 s**：`dbVersion` 实测 3.6–4.2 s（+抖动余量），catalog 大接口可单独放宽（见 §9 参数表）。

### 2.3 重试策略

```ts
export interface RetryPolicy {
  retries: number;        // 建议 2（共 3 次尝试）
  baseDelayMs: number;    // 建议 500
  maxDelayMs: number;     // 建议 8_000
  jitterRatio: number;    // 建议 0.5（±50%）
}
```

退避公式（**必须带抖动**，否则 16 个并发任务会在同一时刻集体重试）：

```
delay_i = min(baseDelayMs × 2^i, maxDelayMs) × (1 - jitterRatio × rand())
```

可重试判定（白名单，默认拒绝）：

```ts
function isRetryable(e: unknown): boolean {
  if (!(e instanceof ApiError)) return e instanceof TypeError;  // TypeError ≈ 网络失败
  if (e.kind === 'timeout' || e.kind === 'network') return true;
  if (e.kind === 'aborted') return false;                        // 主动取消不重试
  const s = e.httpStatus ?? 0;
  return s === 408 || s === 429 || (s >= 500 && s <= 599);
}
```

**明确不重试**：`400 / 401 / 403 / 404 / 422`。其中 401 由既有「单飞刷新 + 重试一次」通道处理，**不得**进入外层重试，否则会形成 401 风暴。

### 2.4 与 401 刷新通道的分层

```ts
async function perform(...) {
  return withRetry(async (attempt) => {          // ← 最外层：网络级重试
    let resp = await fetchWithTimeout(url, init); // ← 最内层：单次带超时
    if (resp.status === 401 && !isRefreshCall) {  // ← 中间层：业务级刷新（现有逻辑）
      await refreshAccessToken(account);
      resp = await fetchWithTimeout(url, init);
    }
    ...
    if (!resp.ok) throw handleErrorResponse(...);
    return parsed;
  }, policy);
}
```

### 2.5 可选：熔断（建议不进首期）

若同一 origin 连续失败超过阈值（如 10 次 / 30 s 窗口）则短路一段时间。**首期不做**——退避 + 上限已足以消除风暴，熔断会引入新的状态与误判风险。

## 3. L2 有界存储层（`src/lib/db/db.ts`）

### 3.1 现状缺陷

`db.ts:175 getDb()` 的 `dbPromise` 是**模块级单例**：一旦某次 `openDB` 因 `blocked` 永久 pending，**后续所有 `getDb()` 都会拿到同一个 pending promise**，且没有任何重置路径。这是「幽灵挂起」的机制来源。

### 3.2 设计

```ts
export function resetDbHandle(): void { openEpoch++; dbPromise = null; }

async function openAquaDb(timeoutMs = 8_000): Promise<IDBPDatabase<AquaDB>> { /* 带超时的 openDB */ }

export function getDb(): Promise<IDBPDatabase<AquaDB>> {
  if (!dbPromise) {
    const epoch = ++openEpoch;
    dbPromise = openAquaDb().catch((e) => {
      if (epoch === openEpoch) dbPromise = null;   // 代际守卫：只清自己那一代
      throw e;
    });
  }
  return dbPromise;
}
```

三条必须写对的细节：

1. **超时**：用 `Promise.race([openDB(...), timeoutAfter(timeoutMs)])`，超时抛 `ApiError(kind:'timeout')` 或专用 `DbTimeoutError`。
2. **重置**：失败/超时后清 `dbPromise`，否则一次失败会永久污染。
3. **代际守卫**（`openEpoch`）：防止「旧超时回调」清掉「新一代已建立的 promise」。超时后原 `openDB` 仍可能稍后 resolve，产生第二个连接；代际守卫保证不会误清，且重复连接由浏览器自行复用，可接受。

### 3.3 `blocked` / `terminated`

```ts
openDB(DB_NAME, DB_VERSION, {
  upgrade,
  blocked() {
    // 另一个同源上下文持有旧版本连接。本页面无法强关它。
    // 策略：上报可读状态 → 让上层在 ~8s 超时后进入失败终态，提示用户关闭其他标签页。
    onDbBlocked();
  },
  blocking() {
    // 本页面正在阻塞别人升级：主动 close，避免成为别人的阻塞源。
    void getDb().then((db) => db.close());
  },
  terminated() {
    resetDbHandle();   // 浏览器强制断开：清置，下次重开
  },
});
```

> `idb` 封装的 `openDB` **不会自动处理 `blocked`**，必须显式提供，否则就是默认的无限等待。

## 4. L3 显式状态机（`src/lib/db/preload.ts` + `DashboardPage.tsx`）

### 4.1 状态定义

```ts
export type UpdatePhase = 'idle' | 'checking' | 'loading' | 'completed' | 'error' | 'timeout';
export type StoreState  = 'idle' | 'pending' | 'downloading' | 'ok' | 'error';
```

**`idle` 是新增的关键态**——它把「从未开始」从「进行中」中分离出来，直接修复 §3 的歧义缺陷。

### 4.2 状态流转

```
idle ──start──► checking
                  ├─(dbVersion ok, 版本未变)──────► loading
                  ├─(dbVersion ok, 版本提升)──────► loading（clear + 续传）
                  ├─(dbVersion 重试耗尽)──────────► loading（降级：用本地数据）
                  ├─(总预算 30s 到)───────────────► timeout
                  └─(IndexedDB 不可用)────────────► error

loading ──┬─(全部 ok)────────────► completed
          ├─(存在 error)─────────► error       （仍可点「重试」增量恢复）
          └─(总预算到)───────────► timeout
```

**关键设计决策**：`dbVersion` 失败**不再直接进入 error**，而是**降级进入 loading**——因为本地 IndexedDB 里可能已有完整数据。当前实现（`preload.ts:91`）虽也调 `loadAll()`，但同时把状态置为 `error`，导致「有本地数据可用」却被标记为失败。降级后：本地完整 ⇒ 直接 `completed`；本地缺失 ⇒ 由任务队列自行重试与续传。

### 4.3 总预算（`checkDbUpdate` 兜底）

```ts
const BUDGET_MS = 30_000;   // 建议值
await Promise.race([runUpdate(), after(BUDGET_MS).then(() => 'timeout')]);
```

**这是「必进终态」的最后一道保险**，独立于任何下层超时。即使下层全部失效，UI 也会在 30 s 内离开「检查更新」。

### 4.4 UI 映射（替换 `DashboardPage.tsx:210/423/431/443/453/463`）

| phase | 卡片渲染 | 可点「重试」 |
| --- | --- | --- |
| `idle` | 「暂未开始」+ 无 spinner | 是 |
| `checking` | 「检查更新」+ spinner | 否 |
| `loading` | 「下载中 completed/total」+ spinner | 否 |
| `completed` | ✓ 版本：{dbVersion} | 否 |
| `error` | ✕ 「下载失败 completed/total」+ 原因 | **是** |
| `timeout` | ⚠ 「检查超时」 | **是** |

`preloadStats.loadingDatabase = completed + error < 16` 这个 hack **整体删除**，改由 `phase` 与逐任务计数驱动。

## 5. L4 增量续传：meta store 与任务队列

### 5.1 数据模型（`DB_VERSION` 6 → 7）

新增 object store `_meta`，`keyPath: 'store'`：

```ts
interface StoreMeta {
  store: StoreName;
  dbVersion: number;     // 完成时的 catalog 版本（来自 dbVersion.major）
  count: number;         // 写入条数
  completedAt: number;   // epoch ms
  lastError?: string;    // 最近一次失败原因（便于诊断）
}
```

**完整性判定改为**：

```ts
const ok = meta && meta.dbVersion === currentVersion && meta.count === (await dbCount(store));
```

彻底取代 R6 指出的 `dbCount(store) > 0`。

### 5.2 迁移

`upgrade(db, oldVersion)` 中 `if (oldVersion < 7) db.createObjectStore('_meta', { keyPath: 'store' })`。
**旧库（v6 及以前）没有 meta 记录 ⇒ 全部视为「未完成」⇒ 会重新拉取一次**。这是**刻意的**：它同时修复了历史可能存在的「部分数据被判为完整」问题。代价是一次全量重下（用户已有数据的情况下约数十 MB，可接受）。

### 5.3 任务队列

```ts
export async function loadAll(opts?: { only?: StoreName[] }): Promise<void> {
  for (const { store } of LOADERS) storeStates.set(store, 'pending');   // ← 先置位
  await runWithConcurrency(LOADERS, CONCURRENCY, loadOne);              // 建议 CONCURRENCY = 4
}
```

`loadOne` 三重保证：

```ts
async function loadOne({ store, url }) {
  try {
    storeStates.set(store, 'downloading');                       // 1. 进入即置位
    const meta = await getMeta(store);
    if (meta?.dbVersion === currentVersion) { storeStates.set(store, 'ok'); return; }
    const data = await withRetry(() => api.get(url), catalogPolicy(store));
    await dbBulkAdd(store, data);
    await putMeta(store, { ...meta, dbVersion: currentVersion, count: data.length, completedAt: Date.now() });
    storeStates.set(store, 'ok');
  } catch (e) {
    storeStates.set(store, 'error');                             // 2. 任何路径都有终态
    await putMeta(store, { lastError: describe(e) });            // 3. 失败原因落盘，供诊断
  }
}
```

并发上限 **4** 的理由：16 个并发大请求同时经过浏览器连接池与本地代理是新引入的压力源，收敛并发可显著降低「排队 + 超时」的组合概率。

### 5.4 增量恢复入口

```ts
export function retryFailed(): Promise<void> {
  const failed = LOADERS.filter(l => storeStates.get(l.store) === 'error').map(l => l.store);
  return loadAll({ only: failed });
}
```

**取代** `preload.ts:82` 的 `clearDb() + reload()`。UI 的「重试」按钮绑定它。

## 6. L5 启动链（`src/app.tsx`）

现状：`restoreAccess()` 与 `loadUser()` 仍是无界 await，且 `restoreAccess()` 挂起会让 `checkDbUpdate()` **永不执行**。

两层处理：

1. **给三跳各自加上界**（§2 的 `fetchWithTimeout` + 重试即自动生效，无需改 `app.tsx` 逻辑）。
2. **`initializeApp` 内部顺序解耦**：`checkDbUpdate()` 目前排在 `restoreAccess()` 之后，被其阻塞。建议改为二者并行启动、各自独立收敛：
   ```ts
   void checkDbUpdate();                                  // 不再依赖 restoreAccess 完成
   const status = await restoreAccess();
   if (status?.banned) { navigate('/banned'); return; }
   await loadUser();
   ```
   > 注意副作用边界：`restoreAccess()` 可能因封禁而导航，`checkDbUpdate()` 的降级路径只读本地数据、不发鉴权请求，因此并行启动是安全的。**实施时需确认 `checkDbUpdate` 不依赖 `accessStatusStore`。**

**不做的事**：不建议把 `checkDbUpdate()` 移出 `useEffect` 到 `requestIdleCallback` 或路由层——那会改变 `dashboard` 首屏的既有语义，收益不抵回归面。

## 7. L6 Service Worker 自愈（建议纳入，可分期）

Edge 的 `ScriptCache` 中同时残留 `sw.js` 与 Angular 时代的 `ngsw-worker.js`，属迁移遗留。建议在 `registerSW()` 之前加一次体检：

```ts
const regs = await navigator.serviceWorker.getRegistrations();
for (const r of regs) {
  const url = r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? '';
  if (url && !url.endsWith('/sw.js')) await r.unregister();   // 注销非当前 SW（如 ngsw-worker.js）
}
```

同时保留 `registerSW({ immediate: false })`（现状），避免注册窗口与首屏请求竞争。

**风险**：误注销会短暂失去离线能力（下次加载自动重装）。建议仅在检测到非 `sw.js` 注册时执行，并记录日志。

## 8. 可观测性（低成本、高价值）

在 `_meta.lastError` 之外，建议把「卡在哪一步」显式化，直接消除 §3 的四种情形不可区分问题：

- `checkDbUpdate` 在每个阶段边界写一条 `updateTrace: { at: number; stage: UpdatePhase; detail?: string }` 到内存 store，失败时随 UI 展示（或写入 `localStorage` 供用户截图上报）。
- UI 的失败态展示 `stage`，用户截图即可定位是 A/B/C/D 哪一种。

## 9. 参数表（建议值，待探针校正）

| 参数 | 建议值 | 依据 |
| --- | --- | --- |
| `DEFAULT_TIMEOUT_MS` | 15 000 | `dbVersion` 实测 3.6–4.2 s，留 3× 余量 |
| `CATALOG_TIMEOUT_MS` | 30 000 | catalog 体积可达数 MB，需放宽 |
| `DB_OPEN_TIMEOUT_MS` | 8 000 | IndexedDB 本地操作正常 <100 ms，8 s 已足够判定阻塞 |
| `retries` | 2（共 3 次尝试） | AC3 |
| `baseDelayMs` / `maxDelayMs` | 500 / 8 000 | 退避曲线 0.5→1→2→…封顶 8 s |
| `jitterRatio` | 0.5 | 打散 16 任务的重试相位 |
| `CONCURRENCY` | 4 | 降低连接池与代理压力 |
| `BUDGET_MS`（总预算） | 30 000 | AC1 的 ≤30 s 硬保证 |

## 10. 测试策略

本仓库**无 ESLint**，唯一自动化门禁是 `npm run build`（`tsc -b && vite build`）。因此测试设计必须务实：

- **AC1 / AC2（挂起必然终结、终态可区分）**：写一次性探针（放 `.artifacts/`，已 gitignore），用 Playwright `page.route()` 把 `api/account/status` / `api/static/dbVersion` / `api/user/me` 分别设为「永不 fulfill」，断言 30 s 内出现终态文案。这是唯一能直接验证本故障的方法。
- **AC3 / AC4（重试行为）**：探针计数请求次数——先 500 两次再 200，断言总次数为 3；持续 500 断言次数 == 3；401 断言次数为 1。
- **AC5（增量恢复）**：让 1 个 catalog 接口 500，点「重试」后断言只有该 URL 被重新请求。
- **AC6（IndexedDB 阻塞）**：在页面内先 `indexedDB.open('Aqua', 6)` 持有一个不关闭的连接，再触发升级路径；断言 ≤10 s 失败而非挂起。
- **AC7（完整性判定）**：写入一半后中断，重新进入断言重新拉取。
- ⚠️ **既有套件注意**：`playwright.lcdx.config.ts` 的 fixture 必须让 `dbVersion` 带 `state:'success'`，否则 `loadAll()` 不触发（该坑已记在 `spec/frontend/quality-guidelines.md`）；该套件**不覆盖 `/mai2/recent`**，本任务的页面级验证需自建探针，不能以套件通过代替。

## 11. 兼容与风险

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 错误类型从 `string` 改为 `ApiError` | 调用方若曾 `String(error)` 展示，文案会变 | 全仓 grep `catch` 中直接展示错误的分支，改为 i18n 映射（R7） |
| `DB_VERSION` 6→7 触发全量重下 | 用户一次额外下载数十 MB | 刻意为之（修复 R6）；可在 UI 上显式提示「正在更新数据」 |
| 并发从 16 降到 4 | 首次全量耗时略增 | 以稳定性换时间；必要时可按 store 体积分级（大 store 单独限流） |
| SW 注销逻辑误伤 | 短暂失去离线可用 | 仅在 scriptURL 非 `/sw.js` 时注销；失败静默 |
| `AbortSignal.any` 兼容性 | 低版本浏览器报错 | 实施前核对 `supportedBrowsers.ts` 最低版本 |
| 无 lint、回归套件覆盖不全 | 静态缺陷可能漏网 | 依赖 `npm run build` + AC1–AC7 探针；不声称 lint 覆盖 |

## 12. 分期建议

**P0（第一步，先做，改动最小）**：**L0**。
- 只改 `app.tsx`（`initializeApp` 幂等化）+ `SignInPage.tsx`（2 行）+ `DashboardPage.tsx`（条件重写 + 自保 effect）+ i18n 四份。
- **不动 DB schema、不动网络层**，即可消除本次故障的直接路径。
- 验收 AC0-1 ~ AC0-4。

**首期（最小闭环）**：L0 + L1 + L3。
- 再叠加 `client.ts` 的超时与重试、`preload.ts` 的显式状态机。
- 满足 AC1–AC4、AC8–AC10，**不动数据库 schema**。
- 效果：永久卡死 → 必然有限失败 + 可手动重试。

**二期**：L2 + L4（+ L5 解耦）。
- 加 `db.ts` 有界化、`_meta` 与 `DB_VERSION` 迁移、增量续传。
- 满足 AC5–AC7，把「可靠」提升为「自愈」。

**三期（可选）**：L6 SW 自愈 + L7 可观测性 + 清理历史债（`assets/` 旧产物、`index.html` 的 `Cache-Control`、`ngsw` 残留缓存）。

## 13. 明确不做

- 不改服务器任何配置（本轮已确认服务端无问题）。
- 不改 SW 的缓存策略、不动 `vite.config.ts` 的 Workbox 配置。
- 不动 `src/features/{chuni,ongeki}/`（功能冻结）。
- 不引入新的状态管理库、不引入 polyfill 依赖、不重写为 shadcn/Tailwind。
- 不在首期做熔断器。
