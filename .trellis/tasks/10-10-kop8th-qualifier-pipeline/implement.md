# Implementation plan — NOT STARTED（v2）

> **Status: planning only.** 用户要求"先设计方案，再建任务；等逻辑闭环再开工"。
> 本文件以下的任何步骤**均未落地**；`git status` 应显示本任务未产生源码改动。

执行原则（用户指定）：**几个项目环环相扣、一个一个做；每个环节做完即测试；边改边 commit（不 push）**。
决策见 `design.md` §0；开工前需确认 `prd.md` 的 N1–N6。

## 任务登记（D9：有 trellis 的项目各自建）

| 仓库 | 任务位置 | 状态 |
|---|---|---|
| 前端 `aqua_viewer_lcdx` | 本任务（umbrella） | planning |
| `LCDXNetApi` | `.trellis/tasks/10-10-kop8th-qualifier/`（已建，prd 已写） | planning |
| `CLL.Net` | `.trellis/tasks/README.md` 的「进行中」表 `T-kop8th`（已登记；该仓 trellis 为轻量变体，无 `scripts/task.py`） | planning |
| 游戏包 `N021` | 无独立 trellis，随本任务 S4 | planning |

## S0 — 开工门禁

- [ ] N1 "我的成绩"是否也要游戏内展示
- [ ] N2 `Score` 口径切换是否接受两届不同
- [ ] N3 单 credit 内 1~2 首是否计入
- [ ] N4 `MininumOpenEvent` 写在哪里、由谁下发
- [ ] N5 `N021/DataConfig.xml` 现状
- [ ] N6 与 `tmpNormalScoreIdList` 的冲突实测结论

## S1 — CLL.Net（先行，schema owner；对应 `T-kop8th`）✅ 已完成

**提交 `90a5563`（分支 `refactor`，未 push）；迁移已 apply 到 `cll.net` 并核验。**

- [x] S1.0 前置确认（G17）：上报门槛实为 `Setting.EnableNetworkBackup`（默认 true；`Is2078Modo` 硬编码恒真）
- [x] S1.1 EF 迁移 ①：建 `KopTournaments`（列见 `design.md` §2.1）
- [x] S1.2 EF 迁移 ②：`KOPRankings` 加 `KopNo`(int, nullable) + `DeluxScore`(ulong) → 回填 `KopNo=6`
- [x] S1.2b EF 迁移 ②b：加索引 `(TournamentId, Score)`
- [x] S1.3 EF 迁移 ③：主键 `UserId` → `(UserId, TournamentId)`；
      额外**去掉 `UserId` 的 AUTO_INCREMENT**（否则 `DROP PRIMARY KEY` 报 MySQL 1075）；改前整表备份
- [x] S1.4 实体/仓储：`KopTournamentRecord`、`IKopTournamentRepository`(+`GetEnabled`/`GetEnabledAsync`/`GetByIdAsync`)
- [x] S1.5 新增纯函数 `Services/KopScoreCalculator.cs`（`design.md` §9）
- [x] S1.5b `UserPlaylogService`：删硬编码三曲与 `20004`，改读当前启用届次；
      只升不降=(Score, DeluxScore) 字典序更大
- [x] S1.5c 单测：`tests/CLL.Net.Tests/KopScoreCalculatorTests.cs` **13 处**用例
- [x] S1.6 `CabinetRecordService.GetKopRanking` 届次化（读当前启用届次）
- [x] S1.7 `CountKopRankingsAboveScore` → `CountBetterThan(tid, score, delux, rankDate)`
- [x] S1.8 种子：迁移内**幂等** `INSERT ... ON DUPLICATE KEY UPDATE`，6th(不启用) + 8th(启用)
- [x] **迁移 apply 到 `cll.net`**（需显式 `--connection`；EF 设计时未取到 appsettings 的连接串）
- [x] **验收**：单测 **73/73 通过**、构建 0 error；库核验：复合主键生效、`UserId` 无 AUTO_INCREMENT、
      `KopTournaments` 2 行（20004 停用 / 20006 启用）、`KOPRankings` 36 行且 `KopNo` 全 6、
      备份表 `KOPRankings_bak_20261010` 36 行
- [x] **commit**（未 push）

> 迁移附带：改主键前整表备份 + 存量回填 `KopNo=6` + `RankDate` 口径修正（历史"北京时间当 UTC 存" → 真 UTC，减 8h）。
> 遗留：`KOPRankings_bak_20261010` 观察一段时间后可手工 DROP。
> ⚠️ 工具坑：`dotnet ef` 加 `--no-build` 会用旧程序集判定"最后一个迁移"，曾误删 `AddUuycOpsFieldsAndMd5RenameHash`；
> 已 `git checkout` 恢复。**改模型/加迁移后一律不带 `--no-build`。**

## S2 — LCDXNetApi（对应独立任务）

- [ ] S2.1 `GET lcdx/kop/current`（R5）
- [ ] S2.2 `GET lcdx/kop/rank?tournamentId=&limit=`（R5，缺省当前届次，`limit` 默认 30）
- [ ] S2.3 `GET lcdx/kop/tournaments`（R5 / G13 / **G15：有数据的届次 ∪ 当前启用届次**）
- [ ] S2.4 ~~`lcdx/kop/my`~~ **不做**（G2）
- [ ] S2.5 `KOPRankingRecord` 主键 + `KopNo`/`DeluxScore` 同步；`KopTournamentRecord` 只读映射
- [ ] **验收**：端点实数据各打一次（201/6th 与 20006/8th 各一次）；编译 0 警告 0 错误
- [ ] **commit**（不 push）

## S3 — 前端 aqua_viewer_lcdx ✅ 已完成

- [x] S3.1 `Maimai2KopRankingPage.tsx`：标题取届次 `shortName`，副行显示全名 + 期间 + 状态徽章
- [x] S3.2 **届次切换**（G13）：`lcdx/kop/tournaments` → `form-select`（仅 >1 个届次时显示）；
      切换时请求 `rank?tournamentId=`
- [x] S3.3 **不做**"我的成绩"卡片（G2）
- [x] S3.4 i18n：4 份资源同步；`Maimai2.KopPage.Title` 由写死的 `"KOP 6th"` 改为中性回退值 `"KOP"`；
      新增 `Edition` / `Period` / `StatusOpen` / `StatusUpcoming` / `StatusClosed` / `NoTournament`
- [x] **验收**：`npm run build` **0 error**（`tsc -b && vite build`，5.88s）;
      `node scripts/audit-i18n.mjs` → 4 资源各 **1290 key**、`errors: []`
- [x] **commit**（未 push）

> 兼容性：`rank` 仍按裸数组解析（`unwrap()` 同时兼容信封形态）；空态区分"无届次"与"该届无数据"。
> 时间展示用浏览器本地时区（中国即北京时间），后端输出带 `Z` 的 UTC 串 → 不会再有 8 小时偏差。

## S4 — 游戏包 `N021`（option 形式）✅ 文件已建；⚠️ 发现 G21

**已创建**（`E:\SGImgTool\decrypt\SDEZ\1.70\N021`，UTF-8 无 BOM + CRLF，与 `A000` 模板一致）：

- [x] S4.1 `scoreRanking/ScoreRanking020006/ScoreRanking.xml`
      id=20006 / `KING of Performai The 8th` / `isSpecial=true` / `eventText=KOP8th告知` /
      `netOpenName=Net261029` / MusicIds=`11810(ATLAS RUSH)`·`11745(氷滅の135小節)`·`12025(魔法仕掛けのファンタジア)` /
      `genreNameTwoLine` / Color `191,151,30`（历代同色） / `FileName=UI_Tab_Kop`
- [x] S4.2 `event/event261029011/Event.xml`（`261029_01_1：KOP8th オンライン予選紹介`，infoType=0，alwaysOpen=false）
- [x] S4.3 `event/event261029051/Event.xml`（`261029_05_1：ScoreRanking KOP8th(ID:20006)`）
- [x] S4.4 `DataConfig.xml` 已存在（version 1.70.2，用户补）

**校验**：三文件 XML 良构（Python ElementTree 解析通过，root 标签正确）；与 `A000/020005` diff 后
**仅**届次/曲目/netOpenName/eventText/genreName 有差异，结构完全一致。

**两处记录在案**

1. SEGA 自己的 event 文案把 ID 写成 `20003`（6th 与 7th 都是 `ScoreRanking KOP?th(ID:20003)`），
   与实际 ScoreRanking id（20004/20005）不符 —— 纯显示文案。我们写**正确的 `ID:20006`**。
2. 🔴 **G21（见 `design.md` §11）**：游戏内 KOP 榜与第三曲解禁由**主站 `GetGameTournamentInfo`** 驱动，
   而该接口硬编码返回空 → 仅放数据包文件**不足以**让游戏内出现 The 8th 榜。
   **网页端不受影响**（S1–S3 已满足原始需求）。需用户拍板走 A（改主站）还是 B（只保留网页榜）。

- [ ] S4.5（运维项，未动）`[lcdx] MininumOpenEvent` —— 决定 event お知らせ能否按 id 日期解禁。
      ⚠️ **当前 event id 前缀为 `261029`，即 2026-10-29 之前不会解禁**（`now < startDate` 会 skip）→
      这是**符合官方窗口的正确行为**；若要**提前测试**，需另加一组前缀 ≤ 今天的调试 event
      （例如 `event261010011`），或临时改机台时间。**未擅自添加。**
- [ ] **注意**：`12025` 仅测试，**不同步到数据库 detail**

## S5 — 端到端验证

- [ ] S5.1 机台单 credit 打 3 曲 → playlog 上报 → `KOPRankings(20006)` 有值且等于該 credit 合计
- [ ] S5.2 `kop6th/get/{uid}` 返回正确名次
- [ ] S5.3 前端：标题 / 我的成绩 / 排行榜 三者正确
- [ ] S5.4 6th 历史数据未被破坏

## 回滚点

- S1.3 主键迁移前：`CREATE TABLE KOPRankings_bak_20261010 AS SELECT * FROM KOPRankings`
- 每步一个 commit，逐步可退
