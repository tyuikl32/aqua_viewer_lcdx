# 部署审计（2026-10-10）

> 范围：KOP8th 预选全链路（S1–S4 + G21）当前可部署性、依赖顺序与剩余缺口。

## 1. 各仓库状态

| 仓库 | 分支 | 本次相关提交 | 未推送 | 工作区 |
|---|---|---|---|---|
| `CLL.Net` | `refactor` | `90a5563`（计分/迁移）+ `4eff2d7`（任务记录） | 2 | 干净（仅 `.workbuddy/` 未跟踪） |
| `LCDXNetApi` | `main` | `8177ea8`（三个端点）※其上另有你的 `0bc7e96` | 3 | 干净 |
| `aqua_viewer_lcdx` | `master` | `555388c` + `0beb486`（页面/i18n）→ `2a4efd4` + `59b57a4`（文档） | 8 | 干净 |
| `LCTitleServer` | `upgrade/net11-runtime-async` | `b79da6b`（TEMP-KOP 模块） | 1 | 干净 |
| 游戏包 `N021` | 非 git 仓库 | 3 个新文件（未打包） | — | — |

我的提交均已被后续提交保留（`8177ea8` 仍是 `HEAD` 的祖先）。四个仓库**全部未 push** → 部署前需先 push。

## 2. ⚠️ 最重要发现：DB 已迁移，生产 CLL.Net 二进制还是旧的

- 迁移 `20261010084048_AddKopTournamentsAndPerTournamentRanking` **已 apply 到生产库 `cll.net`**（本次执行并核验）。
- 生产上运行的 CLL.Net **推测仍是旧二进制**：硬编码三曲 `11223/11612/11746` 与 `TournamentId=20004`。
  ⚠️ 我无法从本机核实服务器上的版本，**请确认是否已部署**；若未部署则下表后果成立。

**后果**：10-29 预选开始后，玩家打 8th 的三首课题曲**不会进 8th 榜**（旧代码只认 6th 的曲目），
`KOPRankings(20006)` 会一直是空的；网页榜也就没有数据。

**风险评估**：
- 旧二进制插入 `KOPRankings` 不带 `KopNo`（可空）与 `DeluxScore`（NOT NULL + 默认 0）→ 合法 ✓
- 旧二进制的 `FindKopRankingAsync(userId, 20004)` + EF 认为主键是 `UserId` → `UPDATE ... WHERE UserId=?`。
  只有当同一 `UserId` 存在**多届**行时才会命中多行；而 8th 行只可能由**新**二进制产生
  → 只要不同时混跑，旧二进制不会遇到多行更新 ✓
- 旧二进制写 `RankDate = UtcNow + 8h`（北京当 UTC），与迁移后的真 UTC 口径不一致 → 历史展示轻微偏差（可接受）

→ **结论：CLL.Net 必须在 2026-10-29 之前部署；越早越好（越早越不会漏算）。**

## 3. 依赖关系

```
CLL.Net ──────────────────► playlog 计分入榜   （独立，10-29 前必须）
LCDXNetApi ───► 前端        前端依赖 current / tournaments 两个新端点
LCTitleServer ──► 游戏内榜   独立（G21 模块）
N021 option 包 ─► 游戏内资源 独立（ScoreRanking 数据 + 12025 测试资源）
```

## 4. 推荐部署顺序（每步都不产生中间态故障）

1. **LCDXNetApi** —— 纯新增端点；`rank` 保持**裸数组 + 原字段名**，仅新增 `rank`/`deluxScore`/`kopNo`
   → 对现有前端零影响。**必须先于前端**。
   ⚠️ 若反过来（先前端）：`tournaments`/`current` 返回 404 → 页面进入 `selectedId = null` →
   显示"当前没有配置 KOP 届次"且**榜单消失**（这是唯一的顺序敏感点）。
2. **前端**（`npm run build` → 部署 `dist/`）。
3. **CLL.Net**（最迟 10-29；DB 已就绪）。
4. **LCTitleServer**（分发到各机台）。
5. **N021 option 包**（SGImgTool 打包 + 分发）。

2/4/5 彼此无依赖，可并行。

## 5. 可以先部署的

| 目标 | 可以先上？ | 理由 |
|---|---|---|
| **LCDXNetApi** | ✅ **可以，且应最先** | 纯加载项、无鉴权变更、`rank` 向后兼容 |
| **CLL.Net** | ✅ 可以 | 迁移已在库，上二进制是"补齐"；但**目标环境必须先 apply 迁移**，否则 `GetEnabledAsync` 查不到 `KopTournaments` → 整批 playlog 上报失败（被 catch → ReturnCode=0） |
| 前端 | ⏳ 等 LCDXNetApi | 否则榜单消失 |
| LCTitleServer / N021 | ✅ 可并行 | 互不依赖 |

## 6. 剩余缺口

| # | 项 | 阻塞 | 说明 |
|---|---|---|---|
| **M1** | **CLL.Net 生产二进制未更新** | 8th 计分 | 10-29 前必须；见 §2 |
| **M2** | LCDXNetApi / 前端未部署 | 网页榜 | 部署即得 |
| **M3** | **N021 未打成可分发 option 包** | 游戏内 ScoreRanking 数据 / 12025 | 你的 SGImgTool 步骤 |
| **M4** | **LCTitleServer 未分发到机台** | 游戏内 The 8th 榜 + 第三曲解锁 | 模块已就绪（smoke 22/22） |
| **M5** | `[lcdx] MininumOpenEvent` 是否 ≤ `261029011` | event お知らせ 解禁 | 你说"有人下发了"，我无法核实具体值；**要 10-29 才生效，不阻塞现在** |
| **M6** | **实机 E2E 未做** | 最终验收 | 打 3 曲 → 上报 → `KOPRankings(20006)` → 网页榜 / 游戏内榜 |
| **M7** | LCDXNetApi 三端点**未实网验证** | 部署信心 | 需起本地实例；该进程会启动 2 个后台服务（NetMQ 订阅 + 每 4 分钟刷新 Rinnet admin token，**会写生产库** `RinnetAdminTokens`）→ **未擅自启动** |
| **M8** | 四个仓库未 push | 部署前提 | —— |
| **M9** | `KOPRankings_bak_20261010` 备份表 | — | 观察一段时间后可 `DROP TABLE` |

## 7. 已核验（无风险项）

- 迁移已 apply 并核验：复合主键生效、`UserId` 无 AUTO_INCREMENT、`KopTournaments` 2 行正确、
  `KOPRankings` 36 行 `KopNo` 全 6、备份表 36 行
- CLL.Net 单测 **73/73**；构建 0 error
- 前端 `npm run build` **0 error**；`audit-i18n` 4 资源各 1290 key、`errors: []`
- LCTitleServer 构建 0 error；live smoke **22/22**（含两次调用响应逐字节一致）
- 新端点**无鉴权变更**（`app.UseAuthorization()` 无全局策略 → 默认匿名）
- 时间窗两侧都安全：CLL.Net 用 `OpenTime/CloseTime` 过滤、游戏侧按 `startDate..endDate` 自判

## 8. 一个"看着危险其实安全"的点

`KopTournaments` 里 8th 的 `IsEnabled = true` 在 10-29 前就已生效，会提前计分吗？
**不会** —— `KopScoreCalculator.Best` 以 `tournament.OpenTime/CloseTime` 过滤，10-29 前恒返回 `null`，
`UpdateKopRankingAsync` 直接 return。窗口外的 playlog 一律不计 ✓
