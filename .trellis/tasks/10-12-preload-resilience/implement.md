# 实施记录（L0 / P0）

> 状态：**代码已落地并通过构建**；AC0-1/AC0-2 属运行时行为，**待人工验证**。
> 本轮只实施 `design.md` §0.5 的 **L0**（直接根因），L1–L4 结构性加固**未开工**。

## 1. 提交清单（未 push）

| # | commit | 摘要 | 文件 |
| --- | --- | --- | --- |
| 1 | `dc21368` | `fix(app): keep initializeApp re-enterable after SPA login` | `src/app.tsx` |
| 2 | `c62726b` | `fix(auth): run the game-data check on every login path` | `src/lib/auth/auth.ts`、`src/lib/db/preload.ts` |
| 3 | `b0e74c7` | `fix(dashboard): stop rendering "checking update" when nothing started` | `src/pages/DashboardPage.tsx`、`src/i18n/{zh,en}.json`、`public/assets/i18n/{zh,en}.json` |

分支：`master`。**未 push**。工作区遗留的前序脏文件（`10-11` 任务的 prd/forensics、`src/styles/theme/liquefy.css`）**未纳入任何一笔提交**。

## 2. 三处改动的对应关系

### 2.1 根因修复 —— `src/app.tsx`

```ts
function initializeApp(): Promise<void> {
  if (!getAccount()) {
    initializationPromise = null;      // ← 不再缓存「空初始化」
    return Promise.resolve();
  }
  if (!initializationPromise) {
    initializationPromise = (async () => { ... })().catch(() => {
      initializationPromise = null;    // ← 失败也不缓存，允许重试
    });
  }
  return initializationPromise;
}
```

### 2.2 登录路径补齐 —— `src/lib/auth/auth.ts`

`procLoginResp` 是全部 8 个登录入口（`loginLcdx` / `login` / `loginWithTotp` / `loginAs` / `loginWithOAuth` / `loginLcdxOnetime` / `signUp` / `signUpLcdx`）的**唯一汇聚点**，原先只做 `setAccount → restoreAccess → loadUser`，缺口在此。已补 `void checkDbUpdate()`。

### 2.3 幂等守卫 —— `src/lib/db/preload.ts`

`checkDbUpdate` 现有**三个触发点**（App 初始化、登录补齐、dashboard 兜底）。新增 `checkInFlight` 守卫，防重复拉取 `dbVersion` 与叠加多轮 `loadAll`。

### 2.4 UI 消歧义 + 兜底 —— `src/pages/DashboardPage.tsx`

- 删除 `loadingDatabase && downloading === 0` 这一「未开始冒充进行中」的分支；
- `checking === null` → 独立文案「暂未开始」；
- 新增入口兜底 effect：`checkingUpdate.get() === null` 时补触发一次（依赖 §2.3 的守卫保证安全）；
- 新增 i18n 键 `DashboardPage.NotStarted`（四份资源同步）。

## 3. 本轮验证结果

| 项 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npx tsc -b` | ✅ exit 0 |
| i18n 审计 | `node scripts/audit-i18n.mjs` | ✅ `errors: []`，四份键数均为 **1291** |
| 生产构建 | `npm run build` | ✅ exit 0，PWA precache 47 entries |

> 本仓库无 ESLint 配置，`npm run build` 是唯一可用的自动化门禁；**不得声称 lint 覆盖**。

## 4. 待人工验证（运行时）

- [ ] **AC0-1** 清除站点全部数据 → 冷加载（未登录）→ 登录 → 进入 dashboard，卡片必须正常完成。
- [ ] **AC0-2** 卡住时按 **F5（不勾 Disable cache）** 必须恢复 —— 这是区分「缓存问题」与「初始化单例问题」的判据。
- [ ] **AC0-4** 连续进入 dashboard 两次，`dbVersion` 只发起一轮请求。

以上需真实登录态，无法在本机自动化完成；建议部署到 `test-lcdxnet.am-allnet.com` 先验。

## 5. 未做 / 后续

- **L1**：`client.ts` 的 `fetchWithTimeout` + `withRetry`（含 `ApiError` 结构化重构）。
- **L2**：`db.ts` 的 `openWithTimeout` / `blocked` / `terminated` / `dbPromise` 代际守卫。
- **L3**：`UpdatePhase` 显式状态机（`loading` / `timeout` 终态 + 失败原因 + 「重试」按钮）。
- **L4**：`_meta` store、`DB_VERSION` 6→7、`retryFailed()` 增量续传。
- **L6/L7**：SW 自愈（注销 `ngsw-worker.js` 残留）、初始化链路埋点。
- **历史债**：`index.html` 的 `Cache-Control`、`assets/` 旧产物清理、SW precache 从未建立。
