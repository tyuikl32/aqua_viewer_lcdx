# Design：KOP8th 预选全链路（v2，决策已落定）

Base branch `master` · Created 2026-10-10 · 关联 PRD `prd.md`

> v2 变更：用户已就 9 个开放问题给出决策（见 §0），本版据此改写；新增 event 解禁机制分析与
> N021 option 包落位方案。

---

## 0. 已确认决策（用户 2026-10-10）

| # | 决策 |
|---|---|
| D1 | **赛事定义来源 = A（录入）**，不做 BmDaemon 上报 |
| D2 | **`KopTournaments` 落 `cll.net`**；**所有迁移在 CLL.Net 用 EF 做**并 apply 到库 |
| D3 | **只配 6th（历史）+ 8th（当前）；7th 没开，不补** |
| D4 | **时区用 UTC 存储，自行换算展示**；业务口径按北京时间 |
| D5 | **计分对齐 SEGA：单 credit 内 3 曲合计**（不是跨 credit 取最好） |
| D6 | **BmDaemon 不改代码**（`kop6th/get` 路由与 contact type 11 保持原样） |
| D7 | **游戏包以 option 形式**放 `E:\SGImgTool\decrypt\SDEZ\1.70\N021`，按对应格式嵌套 |
| D8 | **12025 先用测试资源，仅测试，不同步到数据库 detail** |
| D9 | 有 trellis 的项目各自建任务（CLL.Net / LCDXNetApi / 前端） |
| D10 | **N1**：游戏内不做"我的成绩"（1.62 也没做过）——只保留前端展示 |
| D11 | **N3**：单 credit 的划分键 = **同一 `playlogId`**（不是 `orderId`，见 §3.1） |
| D12 | **N4**：`[lcdx]` 的设置**已有下发链路**（见 §4.1），BmDaemon 无需改代码 |
| D13 | **N5**：`N021/DataConfig.xml` 用户已补 |
| D14 | **N6**：与 `tmpNormalScoreIdList` **不冲突**（我们不启用特殊 ROM，该链为死代码） |

---

## 1. 目标链路

```
【赛事定义】LCDX 录入 KopTournaments (cll.net)
                    │
                    ├─ 当前启用届次 (20006) ──▶ playlog 上报按【单 credit】3 曲计分
                    │                                  └─▶ KOPRankings(UserId+TournamentId)
                    │
                    ├─ kop6th/get/{userId} ──▶ BmDaemon ── contact 11 ──▶ 机台内游戏
                    │
                    └─ lcdx/kop/{current,rank,my} ──▶ React 前端（标题 / 我的成绩 / 排行榜）

【游戏侧】option 包 N021 内补 event + scoreRanking(20006) ──▶ 游戏按 id 日期解禁 event
```

## 2. 数据模型

### 2.1 新表 `KopTournaments`

| 列 | 类型 | 说明 |
|---|---|---|
| `TournamentId` | int **PK** | 20004(6th) / **20006(8th)** |
| `KopNo` | int | 届次序号（6 / 8）——“kop 几” |
| `ShortName` | varchar(32) | `KOP6th` / `KOP8th` |
| `Name` | varchar(128) | `KING of Performai The 6th/8th` |
| `MusicId1/2/3` | int | 三曲 |
| `RequiredLevel` | int | 指定难度，**默认 3 = MASTER**（G14；`MusicDifficultyID.Master = 3`） |
| `OpenTime` / `CloseTime` | datetime(**UTC**) | 计分窗口 |
| `IsEnabled` | bool | 当前启用（唯一 true） |
| `CreatedAt` / `UpdatedAt` | datetime(UTC) | 审计 |

**种子**：
- `20004 / 6 / KOP6th / KING of Performai The 6th / 11223,11612,11746 / 2024-10-31~2024-12-08 / false`
- `20006 / 8 / KOP8th / KING of Performai The 8th / 11810,11745,12025 / 2026-10-28 22:00Z ~ 2026-11-23 14:59Z / **true**`
  （= JST 2026-10-29 07:00 ~ 2026-11-23 23:59）

### 2.2 `KOPRankings` 改造（用户指定做法）

1. **新增列 `KopNo`（int, nullable）** —— 即"kop 几"。
2. **回填**：`UPDATE KOPRankings SET KopNo = 6 WHERE KopNo IS NULL;`（现存量全部属 6th）
3. **主键**：`UserId` → **`(UserId, TournamentId)`** 复合主键。
4. `TournamentId` 保持，与 `KopTournaments.TournamentId` 对应（**权威键**，G7）。
5. **新增列 `DeluxScore`（ulong）** —— 并列时的次级排序（G3）。
6. **新增复合索引 `(TournamentId, Score DESC)`** —— `CountKopRankingsAboveScore` 不再全表扫（G6）。

> ⚠️ 不改主键的后果（已验证）：换 `TournamentId` 时 `FindKopRankingAsync(userId,newId)` 查不到旧行 →
> `AddKopRanking` → 主键冲突 → `SaveChangesAsync` 抛异常 → **整批 playlog 上报失败**。

## 3. 计分口径（D5：对齐 SEGA）

官方规则（`maimai.sega.jp/kop8th/maimai`）：

- 名次按 **1 个 credit 内所选课题曲的達成率合计**；
- **跨 credit 的各曲最好成绩不参与合计**；
- 同分时比**合計でらっくスコア**，再同则比达成时间。

### 3.1 分组键 = `playlogId`（不是 `orderId`）—— 实证

- 游戏侧 `VOExtensions.ExportUserPlaylog()`（`Re_SDGB/Assembly-CSharp_LC_170/Net/VO/Mai2/VOExtensions.cs:1527`）：
  ```csharp
  result.playlogId = Singleton<NetDataManager>.Instance.GetLoginVO(index)?.loginId
                     ?? Singleton<NetDataManager>.Instance.GetGuestLogId(index);
  ```
  → **`playlogId` = 该局登录 id，一个 credit（一局连续游玩）内的各 track 共享同一个 `playlogId`**。
- 同一方法内 **`orderId` 从未被赋值**（全文件仅 102/144 别的方法置 0，`ExportUserPlaylog` 里保持默认 0）
  → `orderId` 在本代协议里不可作为 credit 键。
- 因此：**按 `playlogId` 分组**，且 `UserPlaylogRecord`（持久化实体）**已有 `PlaylogId` 列**，无需改表。

### 3.2 算法

1. 取当届 3 曲在该次上报中的记录；
2. **按 `playlogId` 分组**；
3. 每个 credit：`score = Σ(achievement)`（仅该 credit 内出现的课题曲），`tie = Σ(deluxscore)`；
4. 取 `score` 最大者（并列比 `tie`，再并列比上传顺序）；
5. 与库中既有值比较，**只升不降**（沿用现行为）。
- **Score 存储格式**：现有为 `Σ(achievement + (Level-3)*10000)`（LCDX 自造编码）。
  对齐官方建议改为 **`Σ(achievement)`**（達成率合计，万分比）；前端显示 `score/10000 %` 语义不变。
  ⚠️ 这会改变 6th 历史值的语义 → 6th 数据保留旧值（历史只读），8th 起用新口径。

## 4. event 解禁机制（回答"现在能否正常解锁"）

`LCDX_Mod/Assembly-CSharp.LCDX.mm/Patches/Manager/EventManagerEx.cs` 有 **三条分支**：

| 分支 | 条件 | 行为 |
|---|---|---|
| ① | `MininumOpenEventChn != 999999999 && !Is2078Modo` | `AddEventsAfterMinimum(events, MininumOpenEventChn, now)` —— **按 eventId 前 6 位（YYMMDD）解禁**，end 固定 `2029-01-01` |
| ② | `cacheLcMode && MininumOpenEvent != 999999999` | 同上，阈值用 `MininumOpenEvent` |
| ③ | 否则 | 走 `OperationManager.GetEventDataList()`（**主站** `GetGameEvent` 下发的 `startDate/endDate`） |

- 阈值来源：`mai2.ini` / `D:/mai2.ini` 的 **`[lcdx] MininumOpenEvent`**（`JbNetConfigStore.cs:248`），
  默认传入 **`999999999` = 关闭**。`JbNetConfigStore` 优先读 `D:/mai2.ini`，否则读 exe 同目录 `mai2.ini`。
- **现网实测**：`H:\Package\mai2.ini` **没有 `[lcdx]` 段**，`D:/mai2.ini` 不存在 → **走分支 ③（依赖主站）**；
  而主站 `GetGameEventHandler` 的 1.70 区间 `[260917011, 270305042)` 已覆盖 8th，故**主站若有 8th 记录即可解锁**。

**结论**：**不需要改 `LCDX_Mod` 代码**。两条路任选：
- **路线 ②**（推荐，自主可控）：在机台 `mai2.ini`（或 `D:/mai2.ini`）加
  `[lcdx]` → `MininumOpenEvent = 26010100`（≤ `261029011` 即可）→ 包里的 `event261029011` **按日期自动解禁**，
  end=2029-01-01，**不依赖主站**。
- 路线 ③：往主站 `maimai2_game_event` 插 8th 记录。

### 4.1 `[lcdx]` 设置的下发链路（N4 实证）

`JbNetConfigStore` 读的是**文件**，但该文件的 `[lcdx]` 段是**服务端下发**的（用户确认"有人下发了"）：

```
CLL.Net  DB 表 CabinetSettings (CabinetSettingRecord / Keychip+Key+Value+Enabled)
        │  组装成 [lcdx] ini 文本
        ▼
GetConfigController → GetConfigResponse.settings
        ▼
BmDaemon  RuntimeContactMessageService.cs:29-31
        message.Add(5, { ["config"] = config.settings })      ← contact type 5
        （OptionsPrepareSequence.cs:50-52 亦 enqueue "GameSetting"）
        ▼
机台内游戏 ← contact type 5 → 应用到配置 → JbNetConfigStore 读到 [lcdx] MininumOpenEvent
```

- BmDaemon 侧只**解析** `highfps` / `fps` 自用（`LcdxSettingsParser.cs`），其余键**原样透传**。
- **结论**：BmDaemon **不需要改代码**；要启用日期解禁，只需在 `CabinetSettings` 里给机台配一条
  `MininumOpenEvent = 26010100`。
- ⚠️ **待实测**：contact type 5 的 config 是否真能被 `JbNetConfigStore`（读文件的那条）看到 ——
  若不能，退路是把该键直接写进随包分发的 `mai2.ini`。

## 5. 游戏包落位（D7/D8）

**位置**：`E:\SGImgTool\decrypt\SDEZ\1.70\N021\`（option 包根，与 `A000` 同构的数据类别目录）

```
N021/
├─ DataConfig.xml                ← 已存在/待确认
├─ AssetBundleImages/{Jacket,Jacket_s}/   ← 已存在（测试用 12025 封面）
├─ MovieData/002025.dat                   ← 已存在
├─ SoundData/music002025.acb|awb          ← 已存在
├─ music/music012025/012025_03.ma2        ← 已存在（测试谱面，**不入库 detail**）
├─ event/                                 ← 【新增】按 A000 同构
│   ├─ event261029011/Event.xml           ← KOP8th オンライン予選紹介
│   └─ event261029051/Event.xml           ← ScoreRanking KOP8th(ID:20006)
└─ scoreRanking/                          ← 【新增】
    └─ ScoreRanking020006/ScoreRanking.xml
```

**内容模板**（照 `A000` 的 020005 / 251030011）：

- `scoreRanking/ScoreRanking020006/ScoreRanking.xml`：
  `<name><id>20006</id><str>KING of Performai The 8th</str>` · `eventText=KOP8th告知` ·
  `netOpenName=Net261029` · `<MusicIds> 11810 / 11745 / 12025` · `FileName=UI_Tab_Kop`
- `event/event261029011/Event.xml`：`<name><id>261029011</id><str>261029_01_1：KOP8th オンライン予選紹介</str>` · `alwaysOpen=false`
- `event/event261029051/Event.xml`：`<name><id>261029051</id><str>261029_05_1：ScoreRanking KOP8th(ID:20006)</str>`

> N011（官方 option 样例）的顶层类别为 `AssetBundleImages / DataConfig.xml / MovieData / SoundData /
> information / map / mapBonusMusic / mapTreasure / music / musicGroup / title` —— 说明 option 可承载任意
> 数据类别目录；`event` / `scoreRanking` 与 `information` 同构。

## 6. 逐仓库改动（D9：各自建 trellis 任务）

### 6.1 `CLL.Net`（先行）
1. EF 迁移 ①：建 `KopTournaments`；② `KOPRankings` 加 `KopNo`（nullable）并回填 `=6`；③ 主键改 `(UserId, TournamentId)`
2. 实体 `KopTournamentRecord`；`KOPRankingRecord` 组合键 + `KopNo`
3. 仓储 `IKopTournamentRepository`（当前启用届次）/ `IKopRankingRepository`（按 (user, tournament)）
4. `Services/UserPlaylogService.cs`：删硬编码（L34/39/44 三曲、L135/155 的 20004）→
   取当前届次 → **按 `orderId` 分组** → 三曲合计 → 时间窗（UTC 换算）→ upsert
5. `CabinetRecordService.GetKopRanking`：`tournamentId` 参数化
6. `CountKopRankingsAboveScore(score, tournamentId)`：加届次过滤
7. 种子：6th（`IsEnabled=false`）+ 8th（`true`）

### 6.2 `LCDXNetApi`
1. `GET lcdx/kop/current` → 当前启用届次元数据
2. `GET lcdx/kop/rank?tournamentId=&limit=` → 按届次；`limit` 默认 **30**（G5：不对齐官方 200）
3. `GET lcdx/kop/tournaments` → 可切换届次列表（供 G13 前端切换）
   - **取「有榜数据的届次」∪「当前启用届次」**（G15）：若严格只列"有数据的"，
     8th 开赛首日榜为空 → 前端拿不到当前届次
4. ~~`lcdx/kop/my`~~ **取消**（G2：不做"我的成绩"）
5. `KOPRankingRecord` 主键/`DeluxScore` 同步；`KopTournamentRecord` 只读映射

### 6.3 前端 `aqua_viewer_lcdx`
1. 标题/时间窗取自 `lcdx/kop/current`（去掉写死的 "KOP 6th"）
2. **届次切换**（G13）：用 `lcdx/kop/tournaments` 列表 + `rank?tournamentId=` 拉历史榜
3. **不做**"我的成绩"卡片（G2）。若要在榜中突出自己：用已返回列表里的 `userId` 就地匹配高亮，**不新增端点**
4. i18n 双份同步（`src/i18n/*` 与 `public/assets/i18n/*`）

### 6.4 游戏包 `N021`
见 §5。**只做测试资源，不 push 到数据库 detail。**

## 7. 待确认 / 已关闭

| # | 状态 | 说明 |
|---|---|---|
| N1 | ✅ 关闭 | 游戏内不做"我的成绩"，只保留前端（D10） |
| N2 | ✅ 关闭 | **采用 (a)**：8th 起 `Score = Σ達成率`（官方口径），6th 历史值保留旧公式，接受两届同列含义不同 |
| N3 | ✅ 关闭 | 分组键 = `playlogId`（D11，§3.1 有实证） |
| N4 | ✅ 关闭 | 下发链路已定位（§4.1）；只需配 `CabinetSettings`，BmDaemon 不改 |
| N5 | ✅ 关闭 | `N021/DataConfig.xml` 用户已补 |
| N6 | ✅ 关闭 | 与 `tmpNormalScoreIdList` 不冲突（D14） |
| N7 | ✅ 关闭 | **代码已实现，无需文件**：`JbNetConfigStore.UpdateConfig()` 读 `BMDaemon.Settings.SettingIni`（`Assembly-CSharp.LCDX.mm/Manager/JbNetConfigStore.cs:116`），而该属性是 **native P/Invoke**（`BMDaemon.NET/Settings.cs:12` → `Settings_getSettingIni`）。即 `[lcdx]` 由 BmDaemon 进程内直达，不落文件 |

## 8. 逻辑链缺口（G1–G14，用户已逐条拍板）

| # | 决议 | 落地做法 |
|---|---|---|
| **G1** | 由我出改法 | **在 EF 迁移里写幂等种子**（不用 `HasData`，沿用本仓"注释 + `migrationBuilder.Sql`"风格）：`INSERT INTO KopTournaments (...) VALUES (...) ON DUPLICATE KEY UPDATE ...`，写入 6th + 8th。未来新增届次 = 再加一条迁移（或运维直接跑等价 SQL）。管理端 API 后置 |
| **G2** | **不做"我的成绩"** | 原版（1.62）本来就**只有排行榜、没有"我的成绩"**。故 **`lcdx/kop/my` 取消**；`KOPRankings` 无需三曲分项列 |
| **G8** | 不管 | 既然无"我的成绩"，12025 的歌名不需要在 LCDX 侧呈现（游戏内由数据包提供） |
| **G3** | **做** | `KOPRankings` 加 `DeluxScore`(ulong)；名次比较顺序 = `Score` ↓ → `DeluxScore` ↓ → `RankDate` ↑（先达成者优先） |
| **G4** | 用 playlog 的时间字段 | ⚠️ **修正**：用 **`userPlayDate`**（完整时间 `yyyy-MM-dd HH:mm:ss.f`），**不是 `playDate`** —— 后者只有日期且带"07:00 前算前一天"的逻辑日偏移（`TimeManager.cs:72-82`） |
| **G5** | **保持 LCDX 现状（30）**，不对齐官方 200 | `lcdx/kop/rank` 默认 30，保留 `limit` 参数以便需要时调 |
| **G6** | 按我的推荐做 | **加复合索引 `(TournamentId, Score DESC)`**（`CountKopRankingsAboveScore` 每次全表 count，届次化后过滤面变小但仍需索引）。同时给 `(TournamentId, DeluxScore)` 留观察，暂不加 |
| **G7** | 没问题，维持 | `TournamentId` 为权威键；`KopNo` 仅作展示/可读 |
| **G9** | 解释：**游戏主动请求** | BmDaemon 监听 Contacter socket 的 `ContactType.RequestUserTournament` → 才调 `ProcessUserTournamentAsync`（`RuntimeCommandHandler.cs:68-71`）。播放日志同理走 `ContactType.UserPlaylog` → `ReportUserPlaylogAsync`。**均为被动响应，无需改** |
| **G10** | 不操心，后置 | —— |
| **G11** | **记，但不跨 playlog 计算** | 同一 `playlogId` 内**出现几首就合计几首**（1~3 首都算）；**绝不跨 playlog 相加** |
| **G12** | 解释 + 我设计 | 见 §9.3 |
| **G13** | **做** | 前端加届次切换；需新增 `GET lcdx/kop/tournaments`（列出可切换届次） |
| **G14** | ✅ **只算 MASTER** | 过滤 `Level == 3`（`MusicDifficultyID.Master = 3`；Basic0/Advanced1/Expert2/**Master3**/ReMaster4/Strong5）。`KopTournaments` 增 `RequiredLevel` 列（默认 3）以便将来灵活 |
| **G15** | 届次列表口径 | `lcdx/kop/tournaments` = **「有榜数据的届次」∪「当前启用届次」**；若严格只列"有数据的"，8th 开赛首日榜为空会导致前端拿不到当前届次 |
| **G16** | `Score` 口径的意外发现 | 旧公式 `Σ(ach + (level-3)×10000)` 中 **MASTER(level=3) 的权重恰好为 0** → 对纯 MASTER 成绩，**旧值与新公式 `Σach` 数值一致**；两届差异只出现在混入非 MASTER 的历史数据里（旧代码不按难度过滤） |
| **G17** | 上报前置开关（部署前提） | playlog 上行要求 `Setting.EnableNetworkBackup`（`Setting.cs:17` 默认 **true**，仅"版本探测失败回退"时被置 false）**且** `JbManager.Is2078Modo`（LC 模式）。二者缺一则该 credit 不上报 → KOP 无成绩。**部署时须确认** |
| **G18** | 上报时机 = credit 结束 | 只在 `DataSaveMonitor.Initialize`（存档画面）触发；credit 中途崩溃/断电 → 该 credit 丢失。**与官方一致，可接受** |
| **G19** | `userId` 全程 uint | `DataSaveMonitorEx` 里 `uint userId = (uint)userData.Detail.UserID`，而 `UserDetail.UserID` 是 **ulong**；下游 `Report.UploaserPlaylog(uint,…)` → native 也是 uint。**隐含假设 LCDX 用户 ID < 2^32**。若将来 ID 超界会截断。属 `LCDX_Mod` 范围，本次不动，仅记录 |
| **G20** | `playlogId` 可能是合成值 | `DataSaveMonitorEx:46-53`：当 `playlogId == 1`（哨兵）时替换为 `userId*1000 + GetNowUnixTime()`，同一 credit 内共享。**仍是 credit 唯一键**，且不同 userId 不碰撞 → 可安全用作分组键 |
| **G21** | 🔴 **游戏内 KOP 榜与第三曲解锁依赖主站的 `GetGameTournamentInfo`，而它现在返回空** | 见 §11。**网页端不受影响**；但游戏内不会出现 The 8th 榜，官方"打两首解锁第三首"也不会生效 |

## 9. 计分设计（G3/G4/G11/G12）

### 9.1 纯函数化

把计分从 `UserPlaylogService` 里抽成 **纯函数**（无 IO、无 DbContext），便于单测：

```csharp
public static class KopScoreCalculator
{
    /// <returns>最佳 credit 的 (Score, DeluxScore, PlaylogId)，无有效成绩返回 null</returns>
    public static KopCreditScore? Best(
        IEnumerable<UserPlaylog> uploaded,   // 本次上报的全部曲目
        IReadOnlyList<int> tournamentMusicIds,  // 当届 3 曲
        DateTime openUtc, DateTime closeUtc);
}

public readonly record struct KopCreditScore(ulong PlaylogId, int Score, int DeluxScore);
```

### 9.2 算法（严格对应决议）

1. 过滤 `uploaded`：`MusicId ∈ tournamentMusicIds` **且 `Level == RequiredLevel`（3 = MASTER，G14）**
   **且** 时间落在 `[openUtc, closeUtc]`。
   - **时间字段必须用 `userPlayDate`**（`yyyy-MM-dd HH:mm:ss.f`，完整时间）→ 按机台本地时区转 UTC；
     解析失败时回退 `loginDate`（Unix 秒，无时区歧义）。
   - ⚠️ **不能用 `playDate`**：它是 `ToLogDateTime(…).ToString("yyyy-MM-dd")` —— **只有日期**，
     而且带"**07:00 前算前一天**"的机台逻辑日偏移（`TimeManager.cs:72-82`）。
2. **按 `PlaylogId` 分组**（G11：不跨 playlog）。
3. 组内**按 `MusicId` 去重取最大 `Achievement`**（防同 credit 重复选中同一首被重复相加）。
4. 组内：`Score = Σ(achievement)`（出现 1~3 首都算），`DeluxScore = Σ(deluxscore)`。
5. 跨组取 `Score` 最大者；并列比 `DeluxScore`；再并列比组内最早 `playDate`。
6. 与库中既有值比较：`(Score, DeluxScore)` 字典序更大才更新（**只升不降**），同时刷新 `RankDate`。

> 6th 历史值沿用旧公式（N2 决议 a），仅 8th 起走本算法。

### 9.3 G12：单元测试设计（`tests/CLL.Net.Tests`）

纯函数可直接测，用例：

| 用例 | 输入 | 期望 |
|---|---|---|
| 单 credit 三曲 | 同一 `playlogId` 3 条（MASTER） | `Score = Σ达成率` |
| 单 credit 两曲 | 同一 `playlogId` 2 条（MASTER） | 计入，`Score = Σ2`（G11） |
| 拆成三个 playlog | 3 条各不同 `playlogId` | **不求和**；取单条最大者 |
| 两 credit 各三曲 | 两组 | 取较好的那组 |
| 同 credit 重复同曲 | 同 `playlogId` 同 `MusicId` ×2 | 只算一次（取最大） |
| **非 MASTER 成绩** | 同 credit 含 EXPERT(2) / Re:MASTER(4) | **被剔除**，不计入（G14） |
| 窗口外 | `userPlayDate` 早于 `openUtc` | 忽略 |
| 窗口边界 | 恰好 `== openUtc` / `== closeUtc` | 闭区间，计入 |
| 时间字段回退 | `userPlayDate` 不可解析 | 用 `loginDate` 判定 |
| 同分不同 delux | Score 相同、DeluxScore 不同 | 取 DeluxScore 大者 |
| 全同 | Score/Delux 全同 | 取 `userPlayDate` 早者 |

外加**幂等/只升不降**用例：先写低分再报高分可更新，反序不更新。

### 与"读 event"的关系（澄清）

- **机台侧**"开始打预选" = option 包 `N021` 里的 `event` + `scoreRanking` 被装载 + `MininumOpenEvent` 阈值生效 → **游戏自己按日期解禁**。
- **LCDX 侧**计分/展示 = `KopTournaments`（手录）+ playlog 计分 + 前端展示。
- **两者解耦**：游戏内没有 8th 榜页也不影响 LCDX 计分；反之亦然。时间对齐点只有一个：**届次窗口**。

## 10. playlog 上行链路（2026-10-10 逐段实证）

```
游戏 DataSaveMonitor.Initialize(monIndex, isActive)          ← credit 结束的存档画面
  │  条件：Setting.EnableNetworkBackup && JbManager.Is2078Modo   (G17)
  │  循环 i ∈ [0, GetScoreListCount())：
  │      playlog = userData.ExportUserPlaylog(monIndex, i)
  │      if (playlog.playlogId == 1) playlog.playlogId = userId*1000 + GetNowUnixTime()   (G20)
  │      playlog.userId = (uint)userData.Detail.UserID                                    (G19)
  ▼
JsonUtility.ToJson({ content: [ …本 credit 全部 track… ] })
  ▼
Report.UploaserPlaylog(uint userId, string json)      ← BMDaemon.NET/Report.cs → native
  ▼
contact ContactType.UserPlaylog = 22
  ▼
BmDaemon RuntimeCommandHandler: case ContactType.UserPlaylog
  → ContactCommandService.ReportUserPlaylogAsync(content)     ← 原样透传
  ▼
POST {CLL.Net} record/ReportUploadPlaylog   body = { content: [...] }
  → ReportUserPlaylog.Process([FromBody] UserPlaylogRequest)
  ▼
UserPlaylogService.ProcessPlaylogAsync → 筛曲/计时/计分 → KOPRankings
```

**由此得出的关键结论**

1. **一次上报 = 一个 credit**（`DataSaveMonitor` 是 credit 结束点）→「按 `playlogId` 分组」天然成立；
   保留该分组作为**防御**（万一将来一次消息含多 credit）。
2. **`userId` 由 mod 显式填入**（`playlog.userId = userId`），因为原版 `ExportUserPlaylog` 里是 `0uL`
   → CLL.Net 拿到的 userId **有效**，不会全部记到 0 号用户。
3. **2P**：`needDelay = monIndex != 0`（2P 延后 1s）→ **各玩家各报自己的 credit**，互不干扰。
4. **`playlogId` 语义**：正常为 `NetDataManager.GetLoginVO(index).loginId`；哨兵值 `1` 会被替换为合成值。
   两种情况都能唯一标识一个 credit。
5. **CLL.Net 侧入参**：`UserPlaylogRequest.Content` ↔ mod 的 `LcdxSerialization<T>{ content }` **字段名一致**。

**因此 §9 的算法可以简化表述**：单条消息内的 `content` 即一个 credit 的全部成绩，
「取该消息内 3 首课题曲的 MASTER 成绩求和」就是官方的"单 credit 内 3 曲合计"；
跨 credit 的"取最佳"由 DB 层的**只升不降**完成。

### 10.1 与 1.62 上报实现的对照（G17 核实）

| 维度 | 1.62（`ildiff/Assembly-CSharp_LC_162/Monitor/DataSaveMonitor.cs:46`） | 现在（`Patches/UI/DataSaveMonitorEx.cs`） | 结论 |
|---|---|---|---|
| 触发点 | `DataSaveMonitor.Initialize` | 同 | ✅ 一致 |
| 前置条件 | `userData != null && !IsGuest() && JbManager.Is2078Modo` | 多一条 `Setting.EnableNetworkBackup` | ⚠️ **多一个开关**（默认 true，仅版本探测失败回退时 false） |
| **userId 取值** | **`Detail.ActualUserId`**（= 原始 `_userId`，**绕开** mod 的 ID 映射） | **`Detail.UserID`** | ✅ **数值等价**（见下） |
| 组装 | `Serialization<T>{ content }` | `LcdxSerialization<T>{ content }` | ✅ 字段名相同 |
| 执行 | `Task.Run(SendPostRequestNew)`（async + 1s 延时） | `ThreadPool.QueueUserWorkItem` + `Thread.Sleep(1000)` | ✅ 行为等价 |
| 哨兵替换 | `playlogId == 1` → `userId*1000 + now` | 同 | ✅ 一致 |

**userId 等价的论证（重要）**

- 1.62 的 mod **源码级改写了 `UserDetail`**：
  ```csharp
  public ulong ActualUserId { get => _userId; }          // 原始值
  public ulong UserID { get { if (JbManager.Is2078Modo) { …userIdMap… return trueId; } return _userId; } }
  ```
  即 `UserID` 会经 `userIdMap` 映射，`ActualUserId` 才是原始值。1.62 **故意上传原始值**。
- 现在（1.70）的 mod **没有 `UserDetail` 补丁**，`UserID` 就是原版 `{ get; set; }`；且全 mod 中
  **无人写 `Detail.UserID`**，`userIdMap` 只被 `ChimeReaderManager.GetAccessCode()`（第 204 行）
  用来把 aimeId 换成 extId 拼访问码。
  → 现在的 `UserID` == 原始值 == 1.62 的 `ActualUserId` ✅ **两者上传的是同一个 ID**。

**残留说明（不影响本功能）**：1.62 的 `UserID`（映射版）被游戏其他逻辑使用；170 的 mod 未复刻该映射，
只把映射用于访问码拼接。若将来需要游戏内使用映射值，需补 `UserDetail` 补丁 ── 与本任务无关。

**另**：`JbManager.Is2078Modo => true`（`JbManager.Core.cs:20` 硬编码）→ 该条件恒真，
故 **实际门槛只剩 `Setting.EnableNetworkBackup`**（默认 true）。

## 11. 游戏内 KOP 榜的数据来源（G21，2026-10-10 实证）

### 11.1 结论：驱动源是**主站**，不是数据包

`Re_SDGB/Assembly-CSharp_LC_170/Manager/ScoreRankingManager.cs:UpdateData()`：

```csharp
GameTournamentInfo[] list = Singleton<OperationManager>.Instance.GetGameTournamentInfoDataList();  // ← 主站
foreach (var info in list) {
    if (startDate > playBaseTime || playBaseTime > endDate) continue;      // 时间窗来自 info
    var sr = DataManager.Instance.GetScoreRanking(info.tournamentId);      // 去数据包找同名 ScoreRanking
    if (sr == null) continue;
    if (rankingKind == 0 || rankingKind == 1) {
        seq.FileName = sr.FileName; seq.GenreColor = sr.Color; seq.GenreName = sr.genreNameTwoLine;
        // 注意：曲目清单取 info.gameTournamentMusicList，**不是** sr.MusicIds
        foreach (var m in info.gameTournamentMusicList)
            seq.MusicInfoList.Add(new ScoreRankingMusicInfo { MusicID = m.musicId, IsLock = m.isFirstLock });
        enableRankings.Add(sr.GetID(), seq);
    }
}
```

- `OperationManager.GetGameTournamentInfoDataList()` → `_operationData.GameTournamentInfos`
  → 来自 `_downloadData` / `_dataDownloader` = **主站 `GetGameTournamentInfo` 的响应**。
- 而 `RinNET_backend/.../GetGameTournamentInfoHandler.java` **硬编码返回 `length: 0` 空列表**。
  → **`enableRankings` 恒为空**。
- 代码里那句 `where EventManager.IsOpenEvent(x.Value.eventName.id)` 的结果被 `_ =` 丢弃，**不参与过滤**；
  `netOpenName` 在 `ScoreRankingManager` 中**未被使用**（仅各 Data 类的属性定义）。
  → 所以**游戏内榜的显示与 `netOpenName` 无关，只看主站 info**。

### 11.2 连带影响：第三曲解禁也走同一条链

`ScoreRankingManager.GetUnlockMusicList(monitorId)`：遍历 `enableRankings`，把 `IsLock == true` 的曲
（= `gameTournamentMusic.isFirstLock == true`）作为待解锁项；当该 credit 内**所有非锁定课题曲都被打过**时返回它们。
即官方"打前两首 → credit 结束解禁第三首"的判定完全依赖 `enableRankings`。

→ 主站 info 为空 ⇒ **游戏内无 The 8th 榜，且 12025 不会被这条规则解禁**
（调试包 `mai2.ini` 的 `[Debug] AllOpen=1` 仍可让所有曲可玩）。

### 11.3 与网页端的关系

| 环节 | 依赖 | 现状 |
|---|---|---|
| event お知らせ（活动条目） | 数据包 `event/` + `EventManagerEx` 的 **id 日期解禁** | ✅ 与主站无关，10-29 起自动出现 |
| ScoreRanking 数据 | 数据包 `scoreRanking/` | ✅ 已补 `ScoreRanking020006` |
| **游戏内 KOP 榜 / 第三曲解禁** | **主站 `GetGameTournamentInfo`** | 🔴 **主站返回空 → 不生效** |
| **LCDX 网页榜 / 计分** | CLL.Net + LCDXNetApi | ✅ 已完成（S1/S2/S3） |

### 11.4 选项

- **A**：改主站 `RinNET_backend` 的 `GetGameTournamentInfoHandler`，在 1.70 且窗口内返回 KOP8th 的 info：
  `tournamentId=20006`、`startDate/endDate`、`rankingKind=1`、
  `gameTournamentMusicList=[{11810,isFirstLock:false},{11745,false},{12025,true}]`。
  → 游戏内出现 The 8th 榜 + 官方解锁行为。**属改主站（另一个项目/远端部署）**。
- **B**：不动主站 → 游戏内无 KOP 榜；玩家仍可正常游玩 3 曲（调试包全开）。
  **我们的原始需求（前端看成绩+排行榜）已由 S1–S3 满足**。
