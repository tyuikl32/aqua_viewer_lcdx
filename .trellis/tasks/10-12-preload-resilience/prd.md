# 游戏数据预载健壮性加固：有界请求、重试与终态收敛

## Goal

消除 dashboard「游戏数据」卡片**永久卡在「检查更新 Loading…」且无失败出口**的可复现故障（Edge 高频、Chrome 未复现），并把整条初始化/预载链从「无限等待」改造为「有界、可重试、必进终态、可增量续传」。

本轮交付**设计方案**（`design.md` + `research/root-cause-forensics.md`），**不实施代码改动**。

## Background

用户报障：Edge 有概率打开后卡在 dashboard 右侧「游戏数据 · 检查更新」转圈，一直拉不下来；换 Chrome 正常。用户已尝试清缓存与清 cookie，**无效**。

取证结论（详见 `research/root-cause-forensics.md`）：

- 卡点位于 `restoreAccess()` / `checkDbUpdate()` / `loadUser()` 三跳网络请求中的某一跳——三者**全部是裸 `fetch`，无 `AbortController`、无超时、无重试**。
- 关键铁证：用户清数据后重新访问，Edge 的 `IndexedDB` 与 `Service Worker` 目录 mtime 均推进（页面确实跑起来了），但 `https_lcdxnet.am-allnet.com_0.indexeddb.leveldb` **始终未生成** ⇒ `loadAll()` 从未执行 ⇒ 卡点早于 `loadAll()`；与 access_log 中**完全没有该请求**的记录一致。
- 结构性缺陷：`DashboardPage.tsx:423` 的判定 `checking === 'checking' || (loadingDatabase && downloading === 0)`，其中 `loadingDatabase = completed + error < 16`。**初始态（`checking=null`、`states={}`）本身就命中该条件**，因此「从未开始」「请求挂起」「IndexedDB 阻塞」三种本质不同的故障会渲染成**同一个视觉状态**，且没有任何失败出口。

## Requirements

### R0 初始化必须幂等可重入（P0 — 直接根因）
`app.tsx` 的 `initializeApp()` 在未登录时**不得**把「空初始化」结果缓存进 `initializationPromise`；已登录时重复调用必须幂等；登录成功（SPA 内导航）后必须确保 `checkDbUpdate()` 被执行；进入 dashboard 须有兜底触发。详见 `design.md` §0.5。

### R1 启动链必须有界
`restoreAccess()` → `checkDbUpdate()` → `loadUser()` 以及 `preload` 的全部请求，必须在有限时间内以成功或失败结终，**不得无限 pending**。

### R2 失败必须可重试，且重试有界
- 幂等 GET 失败（网络错误 / 超时 / 5xx / 429 / 408）自动重试，指数退避 + 抖动。
- 重试次数有上限；4xx 业务错误（401/403/404/422）**不得重试**（401 沿用既有单飞刷新语义）。
- 单 store 的重试不得与其他 store 的重试形成同相位脉冲（抖动保证）。

### R3 必须有显式终态，且 UI 可区分「未开始 / 进行中 / 失败 / 成功」
现有 `checking === 'checking' || (loadingDatabase && downloading === 0)` 条件必须被替换为显式状态机（含 `timeout` 态），任何路径都必须写入终态。

### R4 UI 必须提供人工恢复入口
终态为失败/超时时，卡片须展示失败原因与**「重试」按钮**；重试走**增量恢复**（只重跑未完成/失败任务），不得清空已完成数据。

### R5 IndexedDB 操作必须有界
`openDB` / `dbCount` / 升级操作必须带超时；`blocked`、`terminated` 事件必须有处理；超时后必须重置模块级 `dbPromise`，避免被污染的 promise 污染后续所有调用。

### R6 完整性判定不得依赖 `count > 0`
现 `loader()` 以 `dbCount(store) > 0` 判定「已有数据」，**部分写入会被误判为完整**。必须改为按版本 + 完成标记判定。

### R7 不得回退既有契约
- 保留 Bootstrap 类名契约；不得引入 shadcn/Tailwind 式重写。
- 新增用户可见文案必须进 i18n **四份**资源（`src/i18n/{zh,en}.json` + `public/assets/i18n/{zh,en}.json`），zh/en 键集必须完全一致。
- 异步回调用 `translate()`，渲染作用域用 `t()`；`notice()` 调用点不得出现硬编码字符串。
- 不得改动 `src/features/{chuni,ongeki}/`（功能冻结）。

## Non-Goals

- 不修改服务器 nginx 配置（本轮已确认服务端健康：`/api/static/dbVersion` 稳定 3.6–4.2s、目录页 TTFB 71ms、`error.log` 干净、`limit_conn` 未启用）。
- 不引入 HTTP/3 相关变更（已证伪：两浏览器对该 origin 均无 Alt-Svc 记录，实际未启用 h3）。
- 不改 SW 的缓存策略（`/api/*` 本就不被 SW 拦截，已确认 `sw.js` 仅注册 `precacheAndRoute` + `NavigationRoute`）。

## Acceptance Criteria

- [ ] **AC0-1 冷启动+登录必达成**：清除该站点全部数据 → 冷加载（未登录）→ 登录 → 进入 dashboard，卡片必须完成，不得停在「检查更新」。（代码已落地 `dc21368`+`c62726b`；运行时验证待人工）
- [ ] **AC0-2 刷新可恢复**：卡住时按 F5（**不勾** Disable cache）必须恢复。（行为性判据；待人工）
- [x] **AC0-3 未开始态可区分**：`checking === null` 时有独立文案，不显示 spinner。（`b0e74c7` 已分离分支，静态可证）
- [ ] **AC0-4 初始化幂等**：连续进入 dashboard 两次，只发起一轮 `dbVersion` 请求。（in-flight 守卫已落地 `c62726b`；请求计数待人工）
- [ ] **AC1 挂起必然终结**：在「指定接口永久无响应」条件下，UI 必须 ≤30s 离开「检查更新」，进入 `error`/`timeout` 终态，不得无限转圈。
- [ ] **AC2 终态可区分**：未开始 / 进行中 / 失败 / 成功四态在 UI 上互不相同；「从未开始」不再渲染为「检查更新」。
- [ ] **AC3 重试有界且有效**：接口先失败 2 次后恢复 → 第 3 次成功；持续 500 → 重试次数恰好等于策略上限后停止并标记 Error。
- [ ] **AC4 不重试 4xx**：401 不产生重试（保持单飞刷新语义）；404 直接失败。
- [ ] **AC5 增量恢复**：16 项中 1 项失败后点「重试」，仅该 1 项重新发起，其余 15 项数据不清空、不重下。
- [ ] **AC6 IndexedDB 有界**：`openDB` 被阻塞（另一标签页持有旧连接）时 ≤10s 进入失败终态并给出可读提示，后续重试可正常打开。
- [ ] **AC7 完整性判定正确**：写入一半后中断，再次进入时该 store 被判为**未完成**并重新拉取（而非因 `count>0` 跳过）。
- [ ] **AC8 构建通过**：`npm run build`（`tsc -b && vite build`）通过——本仓库唯一可用的自动化门禁（无 ESLint 配置）。
- [ ] **AC9 i18n 合规**：`node scripts/audit-i18n.mjs` 通过；新增键在四份资源中齐备且 zh/en 一致。
- [ ] **AC10 回归无退化**：定向运行 `playwright.lcdx.config.ts` 相关 spec，按失败产物判据为空（注意：该套件不覆盖 `/mai2/recent`；fixture 需 `dbVersion` 带 `state:'success'` 才会触发 `loadAll()`）。

## Notes

- 取证证据：`research/root-cause-forensics.md`；技术设计：`design.md`。
- 只读探针产物（落在 gitignore 的 `.artifacts/`）：`diag-quic.mjs`（浏览器 QUIC/Alt-Svc 状态解析）。
- 已知外部事实：Edge `User Data` 2726.6 MB / Chrome 222.9 MB；Edge 该 origin 的 IndexedDB 与 CacheStorage 均不存在；Edge `ScriptCache` 同时残留 `sw.js` 与 Angular 时代的 `ngsw-worker.js`。
- 本任务创建时使用 `--no-start`，**未切换** trellis 活跃任务（当前活跃仍为 `10-11-login-success-toast-shape`）。
