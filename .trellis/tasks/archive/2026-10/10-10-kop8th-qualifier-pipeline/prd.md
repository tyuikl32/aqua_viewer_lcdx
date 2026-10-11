# KOP8th 预选全链路（event 读取 → 按届计分 → 前端成绩与排行榜）

Status: **方案设计完成，等待用户确认后开工**（`planning`）
Priority: P0 · Assignee: Xavior · Base branch: `master`
Created: 2026-10-10

## Background

LCDX 的 KOP 功能是 2024-10（KOP6th 期间）做的一次性投入，**从头到尾只有"预选排行榜"，从未做过决胜楽曲**：

| 时间 | 仓库 | 提交 | 内容 |
|---|---|---|---|
| 2024-10-30 | CLL.Net | `ad85712` | 建 `KOPRankings`；`UserReportController` +65（playlog 解析 → 挑 3 曲 → 合计達成率 → upsert） |
| 2024-10-31 | CLL.Net | `c29af11` | `CabinetRecordController` +52（`kop6th/get/{userId}`）；加 `RankDate` |
| 2024-11-17 | 前端 | `8afd31a` | `maimai2-kop-ranking` 组件（`lcdx/kop/rank`，前三奖牌），标题**硬编码 "KOP 6th"** |

因此现状的 3 首预选曲与赛事编号是**写死在代码里**的（= KOP6th 的），且没有任何"读取赛事定义"的逻辑。

官方 KOP8th（KING of Performai The 8th）在线预选：**2026-10-29(木) 07:00 ~ 11-23(月) 23:59 JST**，
maimai 课题曲 3 首：「ATLAS RUSH」(kanone) /「氷滅の135小節」(大国奏音) /「魔法仕掛けのファンタジア」(igel)。
预选期间打完前两首，可在 credit 结束解禁第三首。

## Goal

让 LCDX 能在**不硬编码**的前提下跑 KOP8th 预选，并且玩家可在前端看到自己的成绩与排行榜：

1. **读赛事定义**：系统能取得"当前进行的是哪届 KOP、3 首课题曲是什么、计分时间窗"。
2. **按届计分**：机台 playlog 上报后，按当前届次的 3 曲计算成绩并进榜，**多届数据互不干扰**。
3. **前端可看**：当前届次标题（动态）、**我的成绩**（总分 / 名次 / 三曲分项）、**排行榜**。

## Requirements

- R1 届次配置化：新增 `KopTournaments`（届次号 / 名称 / 3 曲 MusicId / 起止时间 / 启用状态），不再硬编码；**由 EF 迁移种子写入**。
- R2 按届隔离：`KOPRankings` 加 `KopNo` + `DeluxScore`，主键改 `(UserId, TournamentId)`，加 `(TournamentId, Score DESC)` 索引。
- R3 按届计分：**只算 MASTER（`Level==3`）**；**按 `playlogId` 分组**（不跨 playlog），组内 1~3 首合计；
  按 **`userPlayDate`** 判时间窗（闭区间）；**只升不降**。
- R4 并列排序：`Score` ↓ → `DeluxScore` ↓ → `RankDate` ↑。
- R5 查询接口：`lcdx/kop/current`、`lcdx/kop/rank?tournamentId=&limit=`（默认 30）、`lcdx/kop/tournaments`。**不做 `my`**。
- R6 前端：标题/时间窗动态；**届次切换**；不做"我的成绩"；i18n 双份同步。
- R7 游戏包：自造 KOP8th 的 `event` / `ScoreRanking020006` 定义并放进 option 包 `N021`。
- R8 单测：计分抽成纯函数 `KopScoreCalculator`，覆盖 §9.3 的 8 类用例。
- R9 全链路不残留硬编码常量；每仓库独立 commit（**不 push**）。

## Acceptance Criteria

- [ ] `KopTournaments` 含 6th / 7th / 8th 三届；8th 三曲 = `11810 / 11745 / 12025`。
- [ ] 同一玩家可同时持有多届 `KOPRankings` 记录，不再触发主键冲突。
- [ ] playlog 上报按"当前启用届次"计分，且时间窗外不计分。
- [ ] `lcdx/kop/current` / `rank` / `my` 三个端点行为符合 R4。
- [ ] 前端 KOP 页标题不再固定 "KOP 6th"，并显示我的成绩与排行榜。
- [ ] 机台包内自造的 `ScoreRanking020006` / `event` 使游戏侧出现 KOP8th 榜页与活动条目。
- [ ] 每仓库改动均提交（未 push），并附测试结果。

## Key Facts（已核实，作为设计输入）

- SEGA 赛事编号（`A000/scoreRanking/ScoreRanking0200xx`）：
  `20003`=The 5th · **`20004`=The 6th** · `20005`=The 7th · **8th 应为 `20006`**。
- CLL.Net 现有硬编码 `TournamentId=20004` 与三曲 `11223/11612/11746` **正是 The 6th 的**
  （ScoreRanking020004 的 `<MusicIds>`）。
- `netOpenName` = 预选开始日：020004=`Net241031`、020005=`Net251030` → **8th 应为 `Net261029`**。
- 主站 `RinNET_backend.GetGameTournamentInfoHandler` **故意返回空**；`GetGameEventHandler` 从
  `maimai2_game_event(id,type,start_date,end_date,enable)` 按版本区间下发，1.70 区间已覆盖 8th 时间窗。
- 游戏包 `A000/event/*/Event.xml` 与 `maimai2_game_event` **都不含曲目**；
  **曲目只在 `ScoreRanking0200xx` 的 `<MusicIds>`**。
- 三曲 ID：**ATLAS RUSH = 11810**（music011810）· **氷滅の135小節 = 11745**（music011745）·
  **魔法仕掛けのファンタジア = 12025**（用户提供；**本包内 `music012025` 不存在**）。

## 决策（用户 2026-10-10 已定，详见 `design.md` §0）

赛事来源 = **A 录入** · 迁移全在 **CLL.Net** 用 EF 做并 apply · 只配 **6th + 8th**（7th 不补）·
时间**用 UTC 存**、业务按北京时间 · 计分**对齐 SEGA：单 credit 内 3 曲合计** ·
**BmDaemon 不改代码** · 游戏包以 **option 形式**落 `E:\SGImgTool\decrypt\SDEZ\1.70\N021` ·
`12025` 仅测试、**不入库 detail** · 有 trellis 的项目各自建任务。

## Open Questions（v2.2）

| # | 状态 | 说明 |
|---|---|---|
| N1 | ✅ 关闭 | 游戏内不做"我的成绩"（1.62 也没做过），只保留前端 |
| N2 | ✅ 关闭 | **采用 (a)**：8th 起用官方 `Σ達成率`；6th 历史值保留旧公式，接受两届同列含义不同 |
| N3 | ✅ 关闭 | credit 划分键 = **同一 `playlogId`** |
| N4 | ✅ 关闭 | `[lcdx]` 设置经 BmDaemon 进程内下发，BmDaemon 不改 |
| N5 | ✅ 关闭 | `N021/DataConfig.xml` 已补 |
| N6 | ✅ 关闭 | 与 `tmpNormalScoreIdList` 无冲突（不启用特殊 ROM） |
| N7 | ✅ 关闭 | **代码已实现**：`JbNetConfigStore.UpdateConfig()` 读 `BMDaemon.Settings.SettingIni`（native P/Invoke），不落文件 |
| **N8** | ⬜ 待确认 | 单 credit 内只打 1~2 首课题曲，是否也计入榜（官方：计所选曲合计） |

## 逻辑链缺口（G1–G20，决议见 `design.md` §8；上行链路实证见 §10）

- **已完成决议**：G1 迁移种子 · G2 **不做"我的成绩"** · G3 做（加 `DeluxScore`）·
  G4 ⚠️修正为 **`userPlayDate`**（`playDate` 只有日期且带 7 点逻辑日偏移）· G5 保持 30 · G6 加索引 ·
  G7 维持 · G8 不管 · G9 游戏主动请求（不改）· G10 后置 · G11 记但不跨 playlog ·
  G12 纯函数 + 11 类单测 · G13 做届次切换 · **G14 只算 MASTER**
- **新增**：G15 届次列表 = 有数据的 ∪ 当前启用 · G16 旧公式对 MASTER 成绩与新公式数值一致
- **上行链路新发现**：**G17** 上报前置开关（`EnableNetworkBackup` + `Is2078Modo`，部署须确认）·
  **G18** 仅 credit 结束上报（中断即丢，与官方一致）· **G19** `userId` 全程 uint（隐含 ID < 2^32）·
  **G20** `playlogId` 哨兵 `1` 被替换为合成值（仍可作分组键）

## Notes

- 本任务**明确不做**决胜楽曲：不碰 `SpecialRomManager` / `lckop` / `LCDX_Mod`。
- 详细技术设计见 `design.md`；执行顺序见 `implement.md`。
