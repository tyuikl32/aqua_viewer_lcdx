# 提前开启 KOP8th 联调 —— 测试方案（2026-10-10）

> 目标：**不等 10-29**，现在就把 KOP 测试跑起来。
> 现状：CLL.Net / LCDXNetApi / 前端 **已部署并通过冒烟**；LCTitleServer / N021 **未分发**。

---

## 一、先回答三个问题

### Q1：游戏需不需要改动？

**游戏本体（DLL / 可执行）不用改。** 全链路是**数据 + TitleServer 驱动**的：

| 需要的东西 | 由谁提供 | 证据 |
|---|---|---|
| 知道"有哪些 KOP 赛事 / 窗口 / 三首曲 / 首局锁定" | **LCTitleServer 的 `GetGameTournamentInfoApi`** | 游戏 `ScoreRankingManager.UpdateData` 消费它（G21） |
| KOP 榜页签本身 | **N021 的 `scoreRanking/ScoreRanking020006/ScoreRanking.xml`** | `DataManager.LoadScoreRanking` 扫该目录，**不按日期/netOpenName 过滤**（已核） |
| 第三曲 12025 的资源 | **N021**（封面/音乐/MV/谱面） | — |
| 玩家名次 | CLL.Net `kop6th/get` → BmDaemon contact 11 | 已是纯代理，不用改（design §12） |

### Q2：TitleServer 下发就够了，还是还要装包？

**两个都要，不是二选一**：

- **TitleServer 下发** → 决定"游戏内会不会出现 The 8th 榜页"以及"第三曲会不会按首局锁解锁"
- **装 N021 包** → 决定"第三曲 12025 有没有资源"以及"榜页签数据存不存在"

### Q3：装上新的更新包就能测了吗？

**还不能。** 包只解决 Q1 里的两格；真正卡住"现在测"的是**时间门**（见第二节），
而且 **CLL.Net 的计分窗口现在还没开** —— 不调它，打歌也不会产生任何 KOP 成绩。

---

## 二、要调的"时间"：4 个门，只需动 3 个

| # | 门 | 位置 | 现值 | 要改成 | 谁做 |
|---|---|---|---|---|---|
| **1** | **计分窗口** | 生产库 `cll.net`.`KopTournaments` (TournamentId=20006) 的 `OpenTime` / `CloseTime` | `2026-10-28 22:00Z` ~ `2026-11-23 14:59Z` | `OpenTime` 提前到 **`2026-10-01 00:00Z`**（`CloseTime` 保持） | **我**（需你点头，生产库写） |
| **2** | **游戏内榜页窗口** | 机台上 LCTitleServer 的 `appsettings.json` → `KopTournamentInfo:IgnoreSchedule` | `false`（走官方窗口） | **`true`** → 窗口变 2019~2029 | **你**（改部署的配置，**不用重编译**） |
| **3** | **event 解禁** | N021 的 `event/event261029011`（**日期就写在 ID 前缀里**，XML 无日期字段） | 前缀 `261029` → 10-29 前不解禁 | 加一个前缀 ≤ 今天的调试 event（如 `261010011`）；**或**把机台时间改到 10-29 后 | 你定（见下"可选"） |
| **4** | **ScoreRanking 数据** | `scoreRanking/ScoreRanking020006` | **无日期门控**（`netOpenName` 不参与过滤） | **不用改** | — ✅ |

### 关于 #3：可以先不做

- event 主要驱动**お知らせ**，**KOP 榜页本身不依赖它**（#4 已核：榜页只依赖 scoreRanking 数据 + TitleServer）
- 想做的话有两条路：
  - **A. 加调试 event**：把 `event261029011` 复制成 `event261010011`（前缀 261010 = 今天）→ 需重新打包 N021
  - **B. 改机台系统时间** 到 2026-10-29 之后 → 1/2/3 全部门一起打开，**不用改任何数据/配置** ⚠️ 但机台时钟不真实（成绩时间戳/日志/TLS 全受影响）

> **权衡**：只测"榜页 + 计分 + 解锁"这三件事，**#1 + #2 就够了**，不必碰 event。

---

## 三、执行顺序

### 我这边（等确认）

1. **改计分窗口**（#1）：用一次性的 EF 测试脚本 UPDATE `KopTournaments(20006).OpenTime`
   - 改前记录原值、改后读回复核
   - **回滚**：`UPDATE KopTournaments SET OpenTime='2026-10-28 22:00:00' WHERE TournamentId=20006;`
2. 改完立刻用**线上 API 验证**：`GET /lcdx/kop/current` 的 `isOpen` 应从 `false` 变 **`true`** ✅

### 你这边

3. **LCTitleServer 分发到机台**：仓库代码已就绪（本地提交 `b79da6b`，**未推**），
   在机台的 `appsettings.json` 里把 `KopTournamentInfo:IgnoreSchedule` 设为 **`true`**
   （模块路径：`.github` 同级的 `Options/KopTournamentInfoOptions.cs`；移除方式也写在注释里）
4. **N021 打包 + 装机**（SGImgTool）
5. （可选）`CabinetSettings` 里给机台配 `[lcdx] MininumOpenEvent`（走日期解禁路线）

---

## 四、测试清单（按顺序，每步都有可观测结果）

| # | 步骤 | 期望 |
|---|---|---|
| 1 | 机台内 `curl 127.0.0.1:5266/Maimai2Servlet/GetGameTournamentInfoApi` | 200，`length=1`，含 `tournamentId=20006` |
| 2 | 网页 `GET /lcdx/kop/current` | `isOpen` = **true**（窗口改完后） |
| 3 | 游戏内进 ScoreRanking | 出现 **KING of Performai The 8th** 页签 + 三首曲；第三首（魔法仕掛けのファンタジア）**带锁** |
| 4 | 打前两首（ATLAS RUSH / 氷滅の135小節） | credit 结束后第三首**解锁**（首局锁规则，仅 MASTER 计） |
| 5 | 打完一个 credit（含 KOP 三曲）后在存档画面等上报 | CLL.Net 写 `KOPRankings(20006)` |
| 6 | 网页 `GET /lcdx/kop/rank` | 列出成绩（`rank`/`kopScore`/`deluxScore`/`tournamentId=20006`） |
| 7 | 游戏内 KOP 榜 | 显示该玩家名次（走 `kop6th/get` → contact 11） |
| 8 | （前端）刷新 `/mai2/kop` | 标题为 **KING of Performai The 8th**、状态 **未开始/进行中**、届次可切换 |

**前置检查（容易漏）**：`Setting.EnableNetworkBackup` 必须为 true 且 `JbManager.Is2078Modo` 为真
（G17）——否则该 credit **不上报**，KOP 永远无成绩。

---

## 五、回滚

| 项 | 回滚动作 |
|---|---|
| #1 计分窗口 | `UPDATE KopTournaments SET OpenTime='2026-10-28 22:00:00' WHERE TournamentId=20006;` |
| #2 LCTitleServer | 把 `IgnoreSchedule` 改回 `false` 并重启 |
| 测试产生的成绩 | `DELETE FROM KOPRankings WHERE TournamentId=20006;`（正式开赛前清一次） |

---

## 六、待你确认

1. **#1 我直接改？** 建议窗口 `OpenTime = 2026-10-01 00:00:00Z`（今天是 10-10，肯定覆盖），`CloseTime` 不动。
   ⚠️ 副作用：**从现在起打的成绩就会进正式榜** —— 开赛前记得用 §五 的清库语句清掉。
2. **#3 event 要不要一起做？**（做的话我加一个今天的调试 event；不做也不影响榜页/计分/解锁）
