# 舞萌DX 机台管理 —— 设计文档 v3

> 状态：**设计定案（待实施）**。v1 的全部代码修改已回滚，两仓库工作区已还原。
> 本文档按 grill-me 对抗审查流程产出，已经五轮审查/审批迭代 + 第六轮实施前定案（open questions 全部确认），审查记录见 §11。
> 设计已全部定案，可进入实施。

---

## 1. 范围与边界

**全部新后端能力并入 LCDXNetApi（`E:\ALL.Net\Project_LCDX_NET\LCDXNetApi`），无例外。**

| 项目 | 本设计中角色 | 是否修改 |
|---|---|---|
| LCDXNetApi | 唯一新增 API 宿主（本设计全部 endpoint） | ✅ 修改（设计见 §6-§10） |
| aqua_viewer_lcdx | 前端页面（4 页重组） | ✅ 修改 |
| AllnetLiteGameUpsert (QQBot) | **零改动**。仅作为权限数据源（其 MySQL 库被只读访问）与命令语义参照 | ❌ |
| CLL.Net | **零改动**。运行时依赖：既有 `POST /remote/control`（HTTP）与 NetMQ PUB `:5556`（ZMQ socket） | ❌ |
| BmDaemon | **零改动**。Remoteware 指令终端（17 条既有指令） | ❌ |

## 2. 术语与关键标识（grill 规则 3：键格式必须显式）

| 标识 | 格式 | 例 | 用途 |
|---|---|---|---|
| `FullKeychip` | 16 字符含 `-`（主键） | `A69E-01A88888888` | Cabinets 主键；**除 AppDlReports/OptDlReports 外所有表的关联键** |
| `Keychip`（短） | `[NotMapped]` 派生：`FullKeychip.Remove(12,4).Replace("-","")` | `A69E01A888` | **仅** AppDlReports/OptDlReports 的 `Serial` 列。因是派生属性，SQL 内不可用，须内存计算后按值查询 |
| `NickName` | 任意字符串（如 `fm1`） | `fm1` | 用户输入的机台定位符 |
| `QQNumber` | long | — | 用户唯一标识（LCDXUserV2Records 主键；bot Users 主键） |
| `UserName` | `LCDX{36进制}` | `LCDXabc12` | 前端登录名（RinNET 体系）；QQNumber 经 LCDXUserV2Records 反查 |

机台定位规则（与 bot 一致）：`NickName == 输入` 精确匹配 → 失败再 `FullKeychip.Contains(输入)` → 仍失败返回 94041。

## 3. 数据模型

### 3.1 用户 ↔ 机台授权关系（一对多，重新设计：脱离 bot 库）

> 审批复批（第四轮）：不再依赖 QQBotDbContext/bot 库；用户单元 = LCDXUserV2（QQNumber 标识保留）；身份记录 = LCDXMember；用户↔keychip 对应单独重新设计如下。

**关系声明**：一个用户（QQNumber）可管理**多台**机台（1:N）。新表 `LCDXCabinetGrants`（cll.net 库）承载授权，**替代**原"只读 bot 库 CabManageRecords"方案——bot 库零依赖。

```
LCDXUserV2Records (cll.net, 既有)         Cabinets (cll.net, 既有)
   QQNumber (PK) ──────────┐                  ┌───────── FullKeychip (PK)
      ▲                    │                  │ ▲
      │ 1:1 (可选行)        ▼                  ▼ │ N:1
LCDXMembers (cll.net, 新)              LCDXCabinetGrants (cll.net, 新)
[QQNumber PK | Permission | …]        [Id PK | QQNumber | FullKeychip | Enabled | …]
   身份记录（谁的管理员）                  授权记录（谁可用哪台，一行=一条授权）
```

三张新表全部在 cll.net 库（含 §3.3 UserRemoteLocks），LCDXNetApi 只连一个数据库。

**LCDXMembers（身份记录）**：
- 语义：`LCDXMembers` 中存在行 = 该 QQ 是"成员"；`Permission` 沿用数值语义（≥10 管理员）。**无行 = 普通用户（Permission=0）**——普通用户无需登记。
- 主键 `QQNumber`，逻辑上 1:1 指向 LCDXUserV2Records（不强制外键，与库内既有风格一致）。

**LCDXCabinetGrants（授权记录，用户↔keychip 的对应）**：
- 语义：一行 = "该 QQ 获得该机台的管理授权"（1:N 的物理载体）；`(QQNumber, FullKeychip)` 唯一约束（修正 bot CabManageRecords 无约束的松散模型）。
- `Enabled` 软吊销位（保留授权历史，便于审计追溯）；`GrantedBy` 记录授权操作者 QQ。
- Web 端提供管理端点（EP-15..17，Admin）——自有表后不再依赖 bot 的 `cabrelation`。

**DDL（部署时手动执行，与 §3.3 一并）**：

```sql
CREATE TABLE IF NOT EXISTS `LCDXMembers` (
  `QQNumber` BIGINT NOT NULL,
  `Permission` INT NOT NULL DEFAULT 0,
  `AddedSince` DATETIME NOT NULL,
  `Note` VARCHAR(255) NULL,
  PRIMARY KEY (`QQNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `LCDXCabinetGrants` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,
  `QQNumber` BIGINT NOT NULL,
  `FullKeychip` VARCHAR(32) NOT NULL,
  `Enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `GrantedAt` DATETIME NOT NULL,
  `GrantedBy` BIGINT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UX_Grants_QQ_Keychip` (`QQNumber`, `FullKeychip`),
  KEY `IX_Grants_FullKeychip` (`FullKeychip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Bootstrap**：部署后需手工插入初始管理员（否则无人具备 Admin）——**已确认两名**（第六轮 Q3）：
```sql
INSERT INTO LCDXMembers (QQNumber, Permission, AddedSince) VALUES
  (3413607143, 10, NOW()),
  (2320812015, 10, NOW());
```
**历史数据迁移（可选，一次性）**：从 bot 库导出 `CabManageRecords` 个人 QQ 行插入 `LCDXCabinetGrants`（群号行不迁移，Web 端无群概念）。

### 3.2 权限模型

| 层 | 名称 | 判定 | 用途 |
|---|---|---|---|
| L1 | TokenAuth | `Authorization` 头 + 路径 `{userName}` → `IRinnetAdminService.CheckTokenAsync`（既有服务，经 RinNET `/api/user/me` 校验归属） | 所有端点前置；失败 401 |
| L2 | CabAuth | L1 + `userName→QQNumber`（LCDXUserV2Records）+ [`LCDXCabinetGrants` 存在 `(QQNumber, FullKeychip, Enabled=true)` **或** `LCDXMembers.Permission>=10`] | 普通用户功能 |

> Admin 为 L2 的隐式超集（第五轮 grill #25 修正）：§4 矩阵管理员列全 ✅，若无授权行的管理员被 L2 拦截则矩阵不成立。L2 判定 = 有 Enabled 授权行 **或** Permission≥10。
| L3 | Admin | L1 + `LCDXMembers.Permission >= 10` | 管理员功能 |

权限探测端点（`GET permission`，EP-01）一次性返回 `qqNumber + permission`，前端据此渲染角色功能区；入口探测端点（`GET manage-access`，EP-18）返回 `hasManage`（判定与 L2 同源：∃Enabled 授权行 ∨ Permission≥10），决定"机台管理"菜单组（页①②③）显隐。

#### 3.2.1 细分下放（第四轮审批引入）

普通用户（CabAuth）对两类功能只获得**白名单子集**，Admin 获得全量：

| 功能域 | 普通用户子集 | Admin 全量 |
|---|---|---|
| lcset（EP-10） | 仅 key `event`(→MininumOpenEvent) 一项（第六轮 Q1 定案：`chevent` **不**下放） | 全部 19 项 |
| Remoteware（EP-13） | 仅 `game-reboot`、`game-switch` 两条指令 | 全部 17 条 |

实现约束：
- 子集判断在**服务端白名单常量**中定义（`NormalLcsetSettings` / `NormalRemoteCommands`），前端仅做展示同步（下拉过滤），**安全边界在后端**——普通用户请求子集外 key/command → 94001 + 审计 failed（同 §5.3 语义）。
- 子集外请求的失败审计 Action 仍为 `lcset`/`rm`，Detail 注明"normal-user subset denied"。

### 3.3 新增表：`UserRemoteLocks`（机台操作记录，建在 cll.net 库）

**记录语义**：任何写操作（含 Remoteware 指令）**无论成功或失败均落一条记录**——失败尝试是暗箱操作排查的关键证据（grill 规则 5）。

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `Id` | BIGINT | PK, AUTO_INCREMENT | |
| `QQNumber` | BIGINT | NOT NULL, INDEX | 操作人（谁） |
| `FullKeychip` | VARCHAR(32) | NULL, INDEX | 目标机台（对哪个）；非机台操作为 NULL |
| `Action` | VARCHAR(64) | NOT NULL | 操作类型（§3.3.1 枚举） |
| `Params` | LONGTEXT | NULL | 请求参数（JSON 序列化；敏感值脱敏见 §3.3.2） |
| `Result` | VARCHAR(16) | NOT NULL | `success` / `failed` |
| `Detail` | LONGTEXT | NULL | 失败原因摘要 / 成功响应摘要（截断至 2000 字符） |
| `Time` | DATETIME | NOT NULL, INDEX | 操作时间（服务器本地时间） |

索引：`(QQNumber)`、`(FullKeychip)`、`(Time)`、复合 `(QQNumber, Time)`。

**DDL（部署时手动执行；LCDXNetApi 不引入迁移体系）**：

```sql
CREATE TABLE IF NOT EXISTS `UserRemoteLocks` (
  `Id` BIGINT NOT NULL AUTO_INCREMENT,
  `QQNumber` BIGINT NOT NULL,
  `FullKeychip` VARCHAR(32) NULL,
  `Action` VARCHAR(64) NOT NULL,
  `Params` LONGTEXT NULL,
  `Result` VARCHAR(16) NOT NULL,
  `Detail` LONGTEXT NULL,
  `Time` DATETIME NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_UserRemoteLocks_QQNumber_Time` (`QQNumber`, `Time`),
  KEY `IX_UserRemoteLocks_FullKeychip` (`FullKeychip`),
  KEY `IX_UserRemoteLocks_Time` (`Time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### 3.3.1 Action 枚举

| Action 值 | 触发端点 | 权限层 |
|---|---|---|
| `cabmode` | POST mode | CabAuth |
| `cabreboot` | POST reboot | CabAuth |
| `lcset` | POST lcset | CabAuth（子集）/ Admin（全量） |
| `cablevel` | POST level | Admin |
| `rm` | POST command | CabAuth（子集 2 条）/ Admin（全量 17 条）（Params.command 记具体指令名） |
| `grant-add` / `grant-remove` | POST/DELETE grants | Admin |

#### 3.3.2 审计失败语义（已审批确认：方案 A）

- **方案 A（已确认）**：审计写入失败 → 记 ILogger error 后放行业务。可用性优先。

**参数脱敏**：`lcset`/`command` 的 Params 中若含密码字段（`remote-*-with-user` 类指令的 `username|password|...` 结构），password 段以 `***` 替代后落库。

### 3.4 实体补全与新增（LCDXNetApi 侧，全部在 CllnetDbContext）

| 项 | 现状 | 改动 |
|---|---|---|
| `CabinetLevel` 枚举 | 6 值（Dead..Burn） | 补全为 8 值 + Recover：`Recover=-1, Dead=0, Cold=1, Cool=2, Warm=3, Hot=4, Burn=5, Develop=6, Special=7`（与 CLL.Net 对齐；列本就是 int，无迁移） |
| `Cabinet.IsSpecialMode` | bool | **改 int**（实际列为 int，需承载 0/4/10；全库无其他引用点） |
| `Cabinet` 实体缺 `GameType` | — | 不补。LC 模式文案由前端按 0/4/10 映射 |
| 新增 `UserRemoteLockRecord` + DbSet | — | 映射 §3.3 表 |
| 新增 `LCDXMemberRecord` + DbSet `LCDXMembers` | — | §3.1 身份记录（QQNumber PK / Permission / AddedSince / Note） |
| 新增 `LCDXCabinetGrantRecord` + DbSet `LCDXCabinetGrants` | — | §3.1 授权记录（唯一约束 QQNumber+FullKeychip / Enabled / GrantedAt / GrantedBy） |
| ~~QQBotDbContext~~ | — | **删除该设计**（第四轮审批：不再依赖 bot 库） |

## 4. 功能 × 权限矩阵

| # | 功能 | bot 对应 | 链路 | 普通（CabAuth） | 管理员（P≥10） |
|---|---|---|---|---|---|
| 1 | 设置 LC 模式（0/4/10） | cabmode | 写 cll.net.Cabinets.IsSpecialMode | ✅ | ✅ |
| 2 | 传统重启（设置/取消） | cabreboot | 写 Cabinets.IsRebooting（读即清，空闲时重启） | ✅ ⚠️差异① | ✅ |
| 3 | 查询机台状态 | cabinfo | 读 Cabinets + CabinetSettings | ✅ | ✅ |
| 4 | 查询上机人数 | dx几人 | 读 PlayRecords 时间窗 | ✅ | ✅ |
| 5 | 查询配信状态（delivery） | delivery | 读 AppDlReports + OptDlReports | ✅ | ✅ |
| 6 | 查询下载进度（dlprog） | dlprog | 读 DownloadRecords | ✅ | ✅ |
| 7 | Remoteware 指令（ZMQ socket） | rm | LCDXNetApi→CLL.Net `/remote/control`→NetMQ:5556→BmDaemon | ✅ 仅子集：`game-reboot`/`game-switch` | ✅ 全部 17 条 |
| 8 | 查看机台截图 | rm printscr | 同上，回执→图片 URL | ❌（printscr 不在子集） | ✅ |
| 9 | 设置 LC 功能 | lcset | 写 CabinetSettings | ✅ 仅子集：`event`（MininumOpenEvent） | ✅ 全部 19 项 |
| 10 | 更改机台级别 | （bot 无对应命令） | 写 Cabinets.Level（8 档） | ❌ | ✅ |
| 11 | 查询机台报错 | errrec | 读 GameErrors（7 天） | ❌ ⚠️差异② | ✅ |
| 12 | 查询机台操作记录 | （无） | 读 UserRemoteLocks | ❌ | ✅ |
| 13 | 管理 1:N 授权（grant 增删查） | cabrelation | 读写 LCDXCabinetGrants | ❌ | ✅ |

**与 bot 的权限差异（第四轮审批后重新归档）**：
- ① cabreboot：bot 为 Sudo+P5 → Web 下放 CabAuth 普通用户
- ② errrec：bot 有普通版 → Web 收紧 Admin
- ③ lcset / rm：不再整体划分，按 §3.2.1 细分子集下放（lcset→仅 `event`；rm→game-reboot/game-switch）
- ④ 权限与授权数据源全部迁至 cll.net 新表（LCDXMembers / LCDXCabinetGrants），bot 库零依赖

## 5. Remoteware 子系统详细设计（ZMQ socket）

### 5.1 链路总览

```
发送：前端 → POST lcdx/cabinet/command (EP-13, Admin)
      → RemoteControlService.Dispatch()
      → HTTP POST {ServerUrl}/remote/control
        body: { Token, TargetTopic:"CL-{FullKeychip}",
                SelfTopic:"CO-LCDXNET-{requestId}", Command, Message }
      → CLL.Net 校验 token → Channel → NetMQ PUB tcp://*:5556（4帧：Target|Self|Command|Message）
      → BmDaemon（SUB "CL-{keychip}"）执行 17 条指令之一

回执：BmDaemon POST {CLL.Net}/remote/client（AES 载荷，CLL.Net 侧解密）
      → CLL.Net 解密后 TargetTopic 以 "CO" 开头 → 明文 4 帧中转 NetMQ PUB :5556
      → RemoteReplySubscriberService（SUB 前缀 "CO-LCDXNET-"）
      → RemoteControlService 回执缓存 → 前端轮询 EP-13R
```

关键事实（grill 验证）：BmDaemon 的加密回执由 CLL.Net `/remote/client` 解密后**以明文帧重发**到 NetMQ（bot 的 Subscriber 收到的即明文），因此本子系统**不需要实现任何 AES 逻辑**。

### 5.2 配置（禁止硬编码，v1 的教训）

`appsettings.json` 新增节（敏感值可用环境变量覆盖）：

```json
"Remoteware": {
  "ServerUrl": "https://at.am-allnet.com",
  "HttpToken": "haochi123",
  "ZmqHost": "at.am-allnet.com",
  "ZmqPort": 5556,
  "ReplyTopicPrefix": "CO-LCDXNET-",
  "ReplyTtlSeconds": 300,
  "HttpTimeoutSeconds": 10,
  "ReconnectDelaySeconds": 5,
  "HeartbeatSeconds": 15
}
```

绑定 `RemotewareOptions`（Options 模式），全部参数运行时读取。

### 5.3 指令白名单与消息转义

- 全量白名单 17 条：`remote-cmd(-with-user)` / `remote-bat(-with-user)` / `remote-url-bat(-with-user)` / `printscr` / `remote-card` / `download` / `downloadpro` / `unzip` / `logsince` / `logsave` / `game-reboot` / `game-switch` / `game-force-reboot` / `ping`。
- **按角色子集（§3.2.1）**：Admin = 全量；普通（CabAuth）= `NormalRemoteCommands = { game-reboot, game-switch }`。**白名单外或子集外一律 94001，在产生任何外呼副作用之前拒绝；拒绝请求仍落审计（result=failed，Detail 注明 subset-denied）——被拒绝的尝试本身是可疑行为证据**。
- `Message` 转义：移植 bot `UnescapeUserInput`（`\n`→LF、`\t`→TAB、`\'`→`"`、`\\`→`\`，尾部孤立 `\` 保留）；空 message 以 `"~"` 占位（bot 同款，CLL.Net `[Required]` 不接受空串）。
- 前端下拉按 permission 过滤展示（普通 2 条 / Admin 17 条），无参指令禁用参数框；**前端过滤仅为 UX，安全边界在后端**。

### 5.4 调度流程（EP-13 内部）

顺序严格如下（先登记后外呼，杜绝回执竞态）：

1. 鉴权 L1 + 角色判定（Admin→全量白名单 / CabAuth→子集白名单并校验机台授权）+ 机台定位（NickName→FullKeychip）
2. 生成 `requestId` = Guid"N" 前 8 位 hex（32 bit 熵；仅用于 5 分钟内轮寻定位。EP-13R 凭 L1 + requestId 知识即凭证——普通用户也会调度子集指令，需要轮询结果；TTL 5min + 32bit 空间下暴力猜测不可行）
3. **预登记** pending 条目（`{status=pending, command, sentAt=now}`）写入 ConcurrentDictionary —— 必须先于 HTTP POST（若 POST 后才登记，快速回执可能先到导致 miss）
4. `HttpClient.PostAsync`（超时 = HttpTimeoutSeconds）
   - 非 2xx → 移除条目 + 审计 failed（detail=状态码）→ 95001
   - 异常（超时/DNS）→ 移除条目 + 审计 failed（detail=ex.Message 截断）→ 95001
5. 审计 success（params：`{command, message(脱敏), requestId}`）
6. 返回 `{requestId}`

### 5.5 回执接收（RemoteReplySubscriberService）

**线程模型（grill：NetMQ socket 非线程安全）**：SubscriberSocket 由后台循环线程独占，全生命周期不跨线程共享；与服务层通信仅经线程安全的 `StoreReply`。

生命周期：
1. `ExecuteAsync` 循环：创建 socket → `Options.HeartbeatInterval=15s / TcpKeepalive=true`（bot 同款）→ `Connect(tcp://{ZmqHost}:{ZmqPort})` → `Subscribe(ReplyTopicPrefix)`
2. 接收循环：`TryReceiveFrameString(1s)` 拉取；**帧契约**：恰好 4 个 UTF-8 帧 `[targetTopic, selfTopic, command, message]`（对照 CLL.Net PublisherBackgroundService：SendMoreFrame×3 + SendFrame）
3. 帧不足 4（在 500ms 窗口内）→ log Warning，丢弃本组（ZMQ multipart 不保证跨消息重组，错位丢弃是唯一安全策略）
4. `targetTopic.StartsWith(prefix)` 否则忽略；提取 id；`StoreReply(id, command, message)`
5. 异常 → log Error → 延迟 ReconnectDelaySeconds 后整套重建（socket Dispose + 重连 + 重订阅）
6. 停机：CancellationToken 取消 → 循环退出 → socket Dispose

**慢加入者（slow-joiner）语义**：ZMQ PUB/SUB 下，刚连接的订阅者会错过订阅生效前的消息。后果：极快回执（<1s）可能丢失 → 该请求最终 timeout。这是链路固有属性（bot 同样存在），以 timeout UX 兜底，不做重试。

### 5.6 回执缓存与结果读取（EP-13R）

- 存储：`ConcurrentDictionary<string, RemoteReplyEntry>`；Entry 更新采用**整体替换**（构造新对象后索引器赋值），避免部分字段撕裂读
- `StoreReply`：条目存在 → 替换为 done 条目；**不存在（已过期/重启丢失）→ log Information 后丢弃，不复活**（防止旧回执污染新会话）
- 读取：查不到 → 94041；查到：
  - pending 且 `now - sentAt > TTL` → 返回 `status=timeout`
  - done 且 `command==printscr && message` 非空 → 计算 `imageUrl={ServerUrl}/remote/download/{HttpToken}/{message}`（读取时计算，存储保持原始文件名）
- 清理：每次 Dispatch 时顺带清扫超 TTL 条目（懒清理；条目仅在 Dispatch 时创建，总量有界，无需后台定时器）

### 5.7 失败与边界矩阵

| 场景 | 行为 | 用户可见 |
|---|---|---|
| CLL.Net 返回非 2xx / HTTP 超时 | 条目移除 + 审计 failed + 95001 | 发送失败提示 |
| BmDaemon 离线 | 调度成功，无回执 | 轮询至 timeout |
| 慢加入者丢帧 | 同上 | timeout |
| LCDXNetApi 重启 | pending 全部丢失 | 轮询 94041 → 前端映射为 timeout 提示 |
| requestId 碰撞（32bit） | 覆盖旧条目 + Warning 日志（5min 窗口内概率可忽略） | 无感 |
| 过期 id 的迟到回执 | 丢弃 + Info 日志 | 无 |
| 并发多管理员 | 各自独立 requestId，字典并发安全 | 无 |

### 5.8 约束与已知限制（需审批知悉）

1. **单实例约束（第六轮 Q4 已确认接受）**：ZMQ SUB 与回执缓存均为进程内。若 LCDXNetApi 多实例部署 + LB 轮询 EP-13R，回执可能落在非调度实例 → 94041。**本期约束单实例运行**；多实例需共享存储（Redis 等），超出本期范围。作为补偿，实现必须**遵循 ASP.NET Core DI 设计规范、妥善管理对象生命周期**（见 §9.1）
2. **审计粒度 = 调度级**：`rm` 审计记录"已派发"（含 requestId）；指令的真实执行结果仅在 5 分钟 TTL 内经 EP-13R 可查，**不回写审计表**（第六轮 Q5 定案：回执 message 不落库）
3. **imageUrl 暴露 HttpToken**：截图 URL 内嵌 token（`/remote/download/haochi123/…`），与 bot 行为一致；仅 Admin 可见该 URL。**第六轮 Q6 已确认接受**
4. **部署前置**：LCDXNetApi 出站放行 `{ServerUrl}:443` 与 `{ZmqHost}:{ZmqPort}`（TCP）

### 5.9 可观测性

| 事件 | 级别 |
|---|---|
| 调度成功（含 requestId/command/keychip） | Information |
| 回执到达（id/command） | Information |
| 过期回执丢弃 / 前缀不匹配 | Information |
| 帧不完整 / requestId 碰撞 | Warning |
| HTTP 失败 / Subscriber 异常重连 | Error |

## 6. Endpoint 规范（全部在 LCDXNetApi，前缀 `lcdx/cabinet`）

通用约定：
- 响应统一 `ApiResponse<T>`：`{ status:{code,message}, time, data }`；成功 code=92001
- 所有端点失败鉴权返回 HTTP 401（token 无效）；L2/L3 权限不足返回 HTTP 200 + code=94001（与既有控制器一致）
- 所有 `{userName}` 为路径段，`Authorization: Bearer {lcdx accessToken}` 头必带
- 时间格式 ISO-8601 字符串；`page/size` 分页参数默认 `1/20`

### 6.1 权限与机台清单

**EP-01 `GET lcdx/cabinet/permission/{userName}`**
- 鉴权：L1
- 数据源：`LCDXMembers`（无行 = permission 0）
- 响应 data：`{ qqNumber: long, permission: int }`
- 错误：401
- 副作用：无

**EP-18 `GET lcdx/cabinet/manage-access/{userName}`**（入口探测：是否有任何机台管理权限，第五轮新增）
- 鉴权：L1
- 判定：与 §3.2 L2 同源——`LCDXCabinetGrants` 存在 `(QQNumber, Enabled=true)` 行 **或** `LCDXMembers.Permission>=10` → `hasManage=true`（Admin 为隐式超集，无授权行也为 true）
- 响应 data：`{ "hasManage": true, "permission": 0 }`
- 错误：401
- 副作用：无
- 用途：前端"机台管理"菜单组（页①②③）显隐——无任何授权且非 Admin 的登录用户 → false → 入口隐藏。与 EP-01 分工：EP-01=角色（permission，驱动子集过滤/管理区），EP-18=能力（是否有任何可管机台）

**EP-19 `GET lcdx/cabinet/controllable/{userName}`**（可操控机台清单 = L2 可通过机台全集，第五轮新增）
- 鉴权：L1
- 数据源：`Permission>=10` → `Cabinets` 全表（含未设 NickName 的）；否则 → `LCDXCabinetGrants`（`QQNumber==该QQ && Enabled==true`）join `Cabinets`
- 响应 data：`CabinetSummary[]`：
  ```json
  [{ "nickName": "fm1", "fullKeychip": "A69E-...", "locationName": "…",
     "isSpecialMode": 0, "level": 3, "isRebooting": false, "lastOnline": "…" }]
  ```
- 错误：401；LCDXUserV2Records 无此用户 → data 为空数组（不暴露存在性）
- 副作用：无
- 用途：页①②③机台下拉的**统一**数据源（普通=授权投影，Admin=全量超集）

> 第五轮 #26：原 EP-02（授权投影）/ EP-03（Admin 全量）已分别并入 EP-19 的普通/Admin 分支，**编号废弃、不复用**；前端不再做"Admin 切换全量"的双端点分支。

### 6.2 查询类（CabAuth：EP-04~07；Admin：EP-12、EP-14）

**EP-04 `GET lcdx/cabinet/info/{userName}/{nickName}`**
- 鉴权：L2
- 响应 data：
  ```json
  { "nickName": "fm1", "locationName": "…", "level": 3, "isSpecialMode": 0,
    "isNoGui": false, "isRebooting": false, "lastOnline": "…", "lastError": "…",
    "currentMemoryUsage": 0, "currentSinmaiMemoryUsage": 0, "pagefileMessage": "…",
    "settings": [ { "settingName": "ForceBypassCloseShop", "settingValue": "1" } ] }
  ```
  （settings = CabinetSettings 中 `Keychip==FullKeychip && Enabled==true`）
- 错误：401 / 94001（无授权）/ 94041（机台不存在）
- 副作用：无

**EP-05 `GET lcdx/cabinet/players/{userName}/{nickName}`**
- 鉴权：L2
- 响应 data：
  ```json
  { "nickName": "fm1", "locationName": "…",
    "halfHour": {"players":3,"plays":5}, "oneHour": {"players":5,"plays":9},
    "twoHour": {"players":8,"plays":15},
    "playing": [ {"userId":123,"userName":"张*","lastPlayDate":"…"} ] }
  ```
- 数据源：`PlayRecords`（`Keychip==FullKeychip`，近 2h）；`playing` = 15 分钟窗口去重 UserId；人名按 `Cabinet.ShowHiddenName` 决定打码（首尾保留中间 `*`）
- 错误：同 EP-04

**EP-06 `GET lcdx/cabinet/delivery/{userName}/{nickName}`**（配信状态）
- 鉴权：L2
- 数据源：`AppDlReports`/`OptDlReports`，键 = **短 Keychip（Serial 列，§2 派生规则，内存计算后查询）**
- 响应 data：
  ```json
  { "app": { "rfState":1, "deliveryTitle":"…", "currentVersion":"…", "deliveryVersion":"…",
             "totalSize":0, "downloadedSize":0, "startTime":"…", "releaseTime":"…" },
    "option": { "rfState":1, "deliveryTitle":"…", "deliveryVersion":"…",
                "totalSize":0, "downloadedSize":0, "startTime":"…", "releaseTime":"…" } }
  ```
  （app/option 任一不存在时该字段为 null；startTime/releaseTime 由 Unix 秒转换）
- 错误：同 EP-04

**EP-07 `GET lcdx/cabinet/dlprog/{userName}/{nickName}`**（下载进度）
- 鉴权：L2
- 数据源：`DownloadRecords`，键 = **FullKeychip**
- 响应 data：
  ```json
  { "items": [ { "fileName": "SDGB_A001_….encryptedVhd", "progress": 5050,
                 "progressText": "50.5%", "reportDate": "…" } ] }
  ```
- progressText 服务端映射：`10000→Done`、`-1→Error`、`-2→HashError`、`-3→Incomplete`、其余 `x/100.0%`；`progress<0 || >=10000` 且 reportDate 超 1 天的记录不返回
- 错误：同 EP-04

**EP-12 `GET lcdx/cabinet/errors/{userName}/{nickName}`**（Admin）
- 鉴权：L3
- 数据源：`GameErrors`（`Keychip==FullKeychip`，`ExceptionDate >= now-7d`，按时间倒序）
- 响应 data：`{ "items": [ { "errorlogFilename": "…", "exceptionDate": "…" } ] }`
- 错误：401 / 94001 / 94041

**EP-14 `GET lcdx/cabinet/locks/{userName}`**（操作记录查询，Admin）
- 鉴权：L3
- 请求（query）：`page`、`size`、可选过滤 `targetQQ`(long)、`fullKeychip`、`action`、`since`、`until`（ISO 时间）
- 响应 data：
  ```json
  { "total": 123, "items": [ { "qqNumber": 10001, "fullKeychip": "A69E-…",
      "action": "cabmode", "params": "{\"mode\":4}", "result": "success",
      "detail": null, "time": "…" } ] }
  ```
- 排序：Time 倒序
- 错误：401 / 94001

**EP-15 `GET lcdx/cabinet/grants/{userName}`**（授权清单，Admin）
- 鉴权：L3
- 请求（query）：`fullKeychip?`、`qqNumber?`（过滤）
- 响应 data：`{ "total": n, "items": [ { "qqNumber": 10001, "fullKeychip": "A69E-…", "enabled": true, "grantedAt": "…", "grantedBy": 10000 } ] }`
- 数据源：`LCDXCabinetGrants`（含 Enabled=false 行，便于审计追溯）
- 错误：401 / 94001

**EP-16 `POST lcdx/cabinet/grants`**（新增授权，Admin）
- 请求：`{ "userName": "LCDX…", "targetQQNumber": 10001, "nickName": "fm1" }`
- 校验：targetQQNumber 必须存在于 LCDXUserV2Records（94001 否则）；机台定位规则同 §2；`(QQNumber, FullKeychip)` 已存在且 Enabled=true → 94001；已存在但 Enabled=false → 恢复（Enabled=true，更新 GrantedAt/GrantedBy）
- 响应 data：`{ "granted": true }`
- 副作用：写 LCDXCabinetGrants；审计 `grant-add`（params：`{targetQQNumber, fullKeychip}`）
- 错误：401 / 94001 / 94041

**EP-17 `DELETE lcdx/cabinet/grants`**（吊销授权，Admin）
- 请求（query 或 body）：`{ "userName": "LCDX…", "targetQQNumber": 10001, "nickName": "fm1" }`
- 语义：**软吊销**（Enabled=false，不物理删除——保留授权历史）
- 响应 data：`{ "enabled": false }`
- 副作用：写 LCDXCabinetGrants；审计 `grant-remove`
- 错误：401 / 94001 / 94041（无此授权记录）

### 6.3 写操作类

**EP-08 `POST lcdx/cabinet/mode`**（CabAuth）
- 请求：`{ "userName": "LCDX…", "nickName": "fm1", "mode": 4 }`
- 校验：`mode ∈ {0,4,10}`（1/2/3 为禁用模式，94001）；跟踪查询写 `Cabinets.IsSpecialMode`
- 响应 data：`{ "isSpecialMode": 4 }`
- 副作用：写 Cabinets；审计 `cabmode`
- 错误：401 / 94001（无授权或非法 mode）/ 94041

**EP-09 `POST lcdx/cabinet/reboot`**（CabAuth）
- 请求：`{ "userName": "LCDX…", "nickName": "fm1", "enable": true }`
- 语义：`enable=true` 置 `IsRebooting=true`——机台**下次心跳读到即清零并在空闲时重启**（读即清，一次性）；`enable=false` 取消未触发的重启标记
- 实现：跟踪查询（bot 的 AsNoTracking+SaveChanges 是 bug，不复刻）
- 响应 data：`{ "isRebooting": true, "message": "机台将在下次心跳（空闲时）自动重启" }`
- 副作用：写 Cabinets；审计 `cabreboot`
- 错误：401 / 94001 / 94041

**EP-10 `POST lcdx/cabinet/lcset`**（CabAuth 子集 / Admin 全量）
- 请求：`{ "userName": "LCDX…", "nickName": "fm1", "key": "bd", "val": "1" }`
- 鉴权：L2（机台授权校验同 EP-08）
- 校验：key ∈ settingPair 19 项；**普通用户额外限制 key ∈ `NormalLcsetSettings = {event}`**（→MininumOpenEvent，第六轮 Q1 定案：仅此一项，`chevent` 不下放），子集外（含 `chevent`）→ 94001 + 审计 failed（Detail=subset-denied）；非法 key → 94001 且 message 附该角色可用 key 列表
- 实现：映射到真实 SettingName（如 bd→ForceBypassCloseShop）；查 `CabinetSettings(Keychip==FullKeychip && SettingName==映射名)`：无则 Insert（Enabled=true），有则更新 SettingValue（跟踪查询）
- 响应 data：`{ "settings": [ …同 EP-04.settings 刷新后全量… ] }`
- 副作用：写 CabinetSettings；审计 `lcset`（params 记 `{key, val}`）
- 错误：401 / 94001 / 94041

**EP-11 `POST lcdx/cabinet/level`**（Admin）
- 请求：`{ "userName": "LCDX…", "nickName": "fm1", "level": 4 }`
- 校验：`level ∈ {-1,0,1,2,3,4,5,6,7}`（Recover/Dead/Cold/Cool/Warm/Hot/Burn/Develop/Special）
- 语义警告（响应携带）：CLL.Net 配信过滤为 `cab.Level >= item.Level`，**级别越低可收到的配信越少**
- 响应 data：`{ "level": 4, "levelName": "Hot", "warning": "级别越低可收到的配信内容越少" }`
- 副作用：写 Cabinets；审计 `cablevel`
- 错误：401 / 94001（非法档位或非 Admin）/ 94041

**EP-13 `POST lcdx/cabinet/command`**（CabAuth 子集 / Admin 全量，Remoteware）
- 请求：`{ "userName": "LCDX…", "nickName": "fm1", "command": "ping", "message": "" }`
- 鉴权：Admin → 全量白名单 17 条；普通 → L2（机台授权）+ 子集白名单 `{game-reboot, game-switch}`（§5.3，白名单/子集外 94001 且审计 failed）；message 走 §5.3 转义规则
- 内部流程：严格按 §5.4 顺序（先登记后外呼）
- 响应 data：`{ "requestId": "ab12cd34" }`（发送成功即返回，结果走 EP-13R 轮询）
- 副作用：外呼 CLL.Net `/remote/control`；审计 `rm`（params 记 `{command, message(脱敏), requestId}`，with-user 类指令密码脱敏）
- 错误：401 / 94001 / 94041 / 95001（CLL.Net 拒绝或网络失败——此失败也落审计，result=failed）

**EP-13R `GET lcdx/cabinet/result/{userName}/{requestId}`**（L1；requestId 知识即凭证，普通用户也可轮询自己调度的子集指令）
- 响应 data：
  ```json
  { "status": "pending | done | timeout",
    "command": "ping", "message": "2026-… Pong!",
    "imageUrl": null }
  ```
  （`command=="printscr"` 且 done 时 imageUrl 非空；status=timeout 表示 5min TTL 内无回执）
- 错误：401 / 94001 / 94041（requestId 不存在或已过期）

## 7. 错误码表（新增沿用既有约定）

| code | HTTP | 含义 |
|---|---|---|
| 92001 | 200 | 成功 |
| 94001 | 200 | 参数非法 / 权限不足（message 区分）/ 禁用的操作值 |
| 94041 | 200 | 目标不存在（机台 / requestId） |
| 95001 | 200 | 上游失败（CLL.Net 不可达等） |
| 95000 | 200 | 内部错误 |
| — | 401 | token 无效/缺失（沿既有 Unauthorized 文案） |

## 8. 前端设计（aqua_viewer_lcdx，4 页）

| 页 | 路由 | 内容 | 权限 |
|---|---|---|---|
| ① 机台管理 | `mai2/cabinets` | 机台下拉（EP-19）+ 四卡片：机台状态（EP-04，含已启用设置）/ 上机人数（EP-05）/ 配信状态（EP-06）/ 下载进度（EP-07，状态徽标 Done/Error/HashError/Incomplete/x%）+ 手动刷新 + 30s 自动刷新开关 | CabAuth（菜单经 EP-18 hasManage 门控；空列表兜底提示） |
| ② 机台控制 | `mai2/cabmode` | 机台下拉；普通区：LC 模式卡（别名→场所→模式→提交，模式未变禁用提交）+ 传统重启卡（二态按钮：isRebooting=true 时「取消重启」否则「设置重启」，设置需二次确认）+ LC 功能卡（普通用户仅显示 `event` 一项，Admin 显示全部 19 项；值输入+提交，成功后刷新设置列表）；管理区 `permission>=10` 显隐：机台级别卡（8 档下拉带说明文案+当前级别+提交+配信警告） | 普通/管理分区 |
| ③ 远程控制 | `mai2/remotecontrol` | 机台下拉（EP-19：普通=授权机台，Admin=全量，无需切换）+ 指令下拉**按角色过滤**（普通 2 条：game-reboot/game-switch；Admin 17 条，各带参数格式提示）+ 参数框 + 发送；requestId 轮询 EP-13R（2s 间隔，上限 30 次）；文本 `<pre>` 展示、printscr `<img>` 展示（仅 Admin 可发 printscr）；会话记录（内存态）。菜单对 hasManage=true 用户可见（EP-18 探测，不再 P10 限定） |
| ④ 操作记录与授权 | `mai2/locks` | 卡A 操作记录（原设计）：过滤器（操作人/机台/操作类型/时间范围）+ 分页表格：时间/QQ/操作/机台/参数(JSON 折叠)/结果徽标/详情。卡B 授权管理（EP-15..17）：授权表格（QQ/机台/状态/授权时间/操作人）+ 新增授权表单（QQ+机台下拉）+ 吊销按钮（二次确认） | P≥10 |

支撑改动：`BotPermissionService`（登录后 EP-01 + EP-18 加载，BehaviorSubject 携带 `permission + hasManage`）；`ApiService.getLcdxAuth/postLcdxAuth/deleteLcdxAuth`（注入 Authorization 头）；菜单 4 项（Cabinets/CabinetControl/RemoteControl 为 AfterLogin 且 hasManage=true（EP-18），Locks 带 `requiredBotPermission:10`）；i18n zh/en 全量词条。前端展示层不显示 QQ 号与 FullKeychip 明文（用 NickName/LocationName；页④授权管理因管理需要显示目标 QQ 号，属 Admin 专用例外）。

## 9. LCDXNetApi 内部结构（设计，非实现）

| 新增件 | 职责 |
|---|---|
| `Database/CllnetDbContext.cs` 改动 | §3.4（枚举/IsSpecialMode/三新实体：UserRemoteLockRecord、LCDXMemberRecord、LCDXCabinetGrantRecord） |
| `Services/MemberAuthService.cs`（+接口） | userName→QQNumber（LCDXUserV2Records）→permission（LCDXMembers）；授权 FullKeychip 集合（LCDXCabinetGrants, Enabled）；grant 增/吊销逻辑（EP-16/17 复用）。**替代原 BotAuthService（bot 库依赖已移除）** |
| `Services/RemoteControlService.cs` | §5.4 调度 + §5.6 回执缓存（ConcurrentDictionary 整体替换，懒清理） |
| `Services/Hosted/RemoteReplySubscriberService.cs` | §5.5 NetMQ SUB（单线程独占 socket、心跳/重连、4 帧契约、不完整帧丢弃） |
| `Configures/RemotewareOptions.cs` | §5.2 配置绑定（Options 模式，禁止硬编码） |
| `Services/RemoteAuditService.cs` | §3.3 落库（含脱敏与失败语义 A） |
| `Services/CabinetPolicy.cs`（静态或服务） | 白名单常量与子集判定：`AllowedModes{0,4,10}`、`AllowedLevels[-1..7]`、`RemoteCommands(17)`、`NormalRemoteCommands{game-reboot,game-switch}`、`LcsetKeys(19)`、`NormalLcsetKeys{event}`（chevent 不在子集，第六轮 Q1） |
| `Controllers/LCDXNetCabinetApi.cs` | EP-01、EP-04..EP-17（含 13R）、EP-18/EP-19（EP-02/03 已并入 EP-19，编号废弃不复用） |
| `Models/DTOs/CabinetDtos.cs` | 全部请求/响应 DTO |
| `LCDXNetApi.Tests`（新 xUnit 测试工程） | §12 单元测试 |
| `Program.cs` / `appsettings.json` / `csproj` | DI 注册（MemberAuthService、RemoteControlService、RemoteAuditService、HostedService）；appsettings +`Remoteware` 节（**不再有 QQBotDatabase 连接串**）；解决方案 +测试工程；NuGet +NetMQ 4.0.4.2 |

### 9.1 DI 生命周期规范（第六轮 Q4 要求：单实例运行下仍须按 ASP.NET Core DI 规范管理生命周期）

| 组件 | 注册方式 | 生命周期依据 |
|---|---|---|
| `RemoteControlService` | `AddSingleton<IRemoteControlService, RemoteControlService>` | 回执缓存（ConcurrentDictionary）必须跨请求存活；本身**不持有** DbContext/HttpClient 等短命依赖 |
| `RemoteReplySubscriberService` | `AddHostedService`（Singleton 语义） | socket 由后台线程独占（§5.5），生命周期绑定 Host：`StartAsync` 启动循环线程，`StopAsync` 触发 CancellationToken → 循环退出 → socket Dispose；StopAsync 幂等（重复调用无副作用） |
| `MemberAuthService` / `RemoteAuditService` | `AddScoped` | 依赖 `CllnetDbContext`（Scoped），随请求释放 |
| HttpClient（RemoteControlService 内） | `IHttpClientFactory` 命名客户端（如 `"remoteware"`），**禁止 `new HttpClient()`** | 避免 socket 耗尽与 DNS 过期；超时按 `HttpTimeoutSeconds` 配置 |
| `RemotewareOptions` | `IOptions<RemotewareOptions>` + 启动校验（`ValidateOnStart`） | 配置缺失时启动即失败（fail-fast），不拖到首次外呼 |
| Controller | 默认 Scoped（框架行为） | 不在 Controller 上缓存跨请求状态 |

**反模式禁令（captive dependency）**：Singleton 服务（RemoteControlService）**不得直接注入** Scoped 服务（DbContext / MemberAuthService / RemoteAuditService）。审计写入路径：`RemoteControlService` 注入 `IServiceScopeFactory`，在 Dispatch 流程内 `CreateScope()` 解析 `IRemoteAuditService` 写完即释放——单实例语义与 Scoped 依赖兼得。

**停机顺序保证**：Host 停止时框架先调用 HostedService.StopAsync（SUB 循环退出、socket 释放），随后才释放容器其余单例（RemoteControlService 缓存随之消亡）——无需手写顺序编排，依赖框架既有行为。

## 10. 部署前置

1. cll.net 库执行三张新表 DDL：§3.3 UserRemoteLocks + §3.1 LCDXMembers / LCDXCabinetGrants
2. Bootstrap：插入首名管理员（§3.1 SQL）；可选迁移 bot CabManageRecords 个人授权（§3.1）
3. LCDXNetApi 服务器放行出站：`{ServerUrl}:443`（HTTP 控制）与 `{ZmqHost}:{ZmqPort}`（ZMQ 回执）
4. ~~bot 库只读账号~~ **已移除**（第四轮审批：零 bot 库依赖，单数据库连接）
5. CORS：既有白名单已覆盖前端域名，无改动

## 11. Grill 审查记录（v2 → v3 findings）

| # | 级别 | 发现 | 修正（已并入本文档） |
|---|---|---|---|
| 1 | P0 | **delivery 与 dlprog 被合并**：bot 中是两个命令、两张数据源、两种键格式（Serial=短 Keychip vs Keychip=FullKeychip） | 拆为 EP-06（delivery）/ EP-07（dlprog），键格式在 §2 显式声明 |
| 2 | P0 | 用户↔机台关系未建模：CabManageRecords 关联语义（一对多授权）未说明，导致"授权范围"依赖实现者猜测 | §3.1 数据模型 + 正反向语义 + EP-02 为其投影 |
| 3 | P0 | 操作记录设计不完整：仅 4 字段（谁/指令/参数/时间），无结果状态、无失败尝试语义、无查询过滤 | §3.3 扩展为 8 字段 + 失败也记录 + 脱敏 + EP-14 过览查询 |
| 4 | P1 | endpoint 规范粒度不足（无请求/响应 schema、错误码、副作用） | §6 全部字段级规范 + §7 错误码表 |
| 5 | P1 | "全部并入 LCDXNetApi"未显式声明边界 | §1 表格逐项目声明零改动 |
| 6 | P1 | bot 已知陷阱未清单化（AsNoTracking 写失效、读即清、鉴权不一致静默失败、枚举漂移） | §3.4 / EP-09 / 差异声明 / §2 逐项固化 |
| 7 | P2 | bot delivery 输出为日文文案 | Web 端结构化字段 + 前端 i18n，不复刻日文 |

**第二轮 grill（Remoteware 深挖，v3 §5 细化）**：

| # | 级别 | 发现 | 修正 |
|---|---|---|---|
| 8 | P0 | 调度竞态：若 HTTP POST 成功后才登记 pending，亚秒级回执可能先于登记到达 → miss | §5.4 顺序固化为"先登记后外呼" |
| 9 | P0 | NetMQ socket 非线程安全，v1 草案未声明所有权 | §5.5 后台循环线程独占 socket，跨线程仅经线程安全 StoreReply |
| 10 | P1 | v1 草案硬编码 SERVER_URL/TOKEN/前缀/TTL | §5.2 RemotewareOptions 配置节，禁止硬编码 |
| 11 | P1 | ZMQ PUB 慢加入者语义未声明（连接初期丢消息是链路固有属性） | §5.5 显式声明 + timeout UX 兜底，不重试 |
| 12 | P1 | 多实例部署 + LB 会使回执缓存失效 | §5.8 本期单实例约束，多实例需共享存储（范围外） |
| 13 | P1 | rm 审计仅调度级，执行结果 5min 后不可追溯 | §5.8 声明限制 + open question #6 |
| 14 | P1 | message 空串会被 CLL.Net `[Required]` 拒绝；bot 用 `"~"` 占位 | §5.3 转义 + 占位规则 |
| 15 | P2 | imageUrl 内嵌 HttpToken（与 bot 一致） | §5.8 声明 + open question #7 |

**第三轮 grill（lcset 下放 CabAuth 的变更审查）**：

| # | 级别 | 发现 | 修正 |
|---|---|---|---|
| 16 | — | lcset 权限变更本身与 bot 普通版语义一致（CabManageRecords 鉴权），差异②消除 | §4 矩阵 / EP-10 / §3.3.1 同步为 CabAuth |
| 17 | P1 | 下放后普通用户可写全部 19 项设置，其中 HideTrueVersionInfo / CustomCameraConfig / KaleidxLcPhase(Ex) 等为调试向/反检测向 key，与"普通用户"能力面可能不匹配 | open question #8：默认全量下放，审批可选按 key 分层 |
| 18 | P2 | 前端页②"LC 功能卡"需从管理区移入普通区；管理区仅剩机台级别卡 | §8 页②描述已更新 |

**第四轮 grill（审批批复落地：细分下放 + 鉴权重设计 + 单元测试）**：

| # | 级别 | 发现 | 修正 |
|---|---|---|---|
| 19 | P0 | 细分下放后 EP-13R 不能再 Admin 限定（普通用户调度子集指令后需轮询结果） | EP-13R 改为 L1 + requestId 知识即凭证（5min TTL + 32bit 空间，暴力不可行）；§5.4 同步 |
| 20 | P0 | printscr 回执 imageUrl（含 HttpToken）可被普通用户经 EP-13R 读取？——不可：普通用户子集不含 printscr，永远无法产生该 requestId | §3.2.1 矩阵明确"截图不在子集"；EP-13R 无需额外分支 |
| 21 | P1 | 去除 QQBotDbContext 后，Admin 判定与授权范围全部迁至 cll.net 新表，需 Bootstrap 首管理员与可选数据迁移 | §3.1 DDL + Bootstrap SQL + CabManageRecords 迁移说明 |
| 22 | P1 | 自有授权表后授权管理仍依赖 bot cabrelation 会形成双写源头 | 新增 EP-15..17（grant 查/增/吊销，软吊销+唯一约束+审计 grant-add/remove） |
| 23 | P1 | 子集白名单若仅在前端过滤会被直接调 API 绕过 | §3.2.1/§5.3：安全边界在后端 CabinetPolicy，前端仅 UX |
| 24 | P1 | 单元测试要求落地需要可测性设计（白名单/转义/脱敏/缓存均为纯逻辑，天然可测；EF 依赖服务用内存库） | §12 测试矩阵 + §9 CabinetPolicy 抽取 |

**审批结论归档（2026 第四轮）**：
- Q1 审计失败语义 → **方案 A（放行）**
- Q2 权限差异 → **否**，改为细分下放：lcset 普通用户仅 MininumOpenEvent 系（event/chevent；**第六轮 Q1 修订为仅 event**）；Remoteware 普通用户仅 game-reboot/game-switch
- Q3 17 条指令对 Admin 全量开放 → **是**
- Q4 remote-cmd 命令原文保留于审计 → **是**
- Q8 lcset 按 key 分层 → 由 Q2 细分方案落地（子集=event/chevent，第六轮 Q1 修订为仅 event）
- 新增要求：实施阶段新代码编写单元测试；鉴权不再依赖 QQBotDbContext（LCDXUserV2 为用户单元 + LCDXMember 身份记录 + 授权关系重设计 §3.1）

**第五轮 grill（入口探测 EP-18/EP-19 + L2 Admin 超集修正）**：

| # | 级别 | 发现 | 修正 |
|---|---|---|---|
| 25 | P0 | L2 CabAuth 若仅判授权行，无授权行的管理员会被拦——§4 矩阵管理员列全 ✅ 随之不成立 | §3.2 L2 判定改为"∃Enabled 授权行 **或** Permission≥10"（Admin 为 L2 隐式超集） |
| 26 | P1 | 前端无入口探测手段：EP-01 仅返回 permission（普通授权用户=0），无法区分"无任何机台权限的登录用户"→ 入口误显；且机台下拉需 EP-02/EP-03 双端点 + 前端角色分支 | 新增 EP-18（hasManage，L2 同源判定的"任意机台"泛化）与 EP-19（可操控清单：Admin 全量 ∨ 授权投影，统一下拉数据源）；EP-02/EP-03 并入 EP-19，编号废弃不复用 |

**第六轮审批（实施前定案，Open questions 全部关闭）**：

| # | 问题 | 决定 | 落点 |
|---|---|---|---|
| Q1 | lcset 普通子集范围 | **仅 `event`**（→MininumOpenEvent）；`chevent` **不**下放 | §3.2.1 / §4#9 / EP-10 / §9 CabinetPolicy / §12.1 |
| Q2 | EP-15..17 授权管理纳入本期 | **确认**（保持设计原样） | §6.2 EP-15..17 |
| Q3 | Bootstrap 初始管理员 | **两名**：3413607143、2320812015（P10） | §3.1 Bootstrap SQL / §10 |
| Q4 | 单实例部署约束 | **接受**；实现须遵循 ASP.NET Core DI 设计规范、妥善管理对象生命周期 | §5.8-1 / §9.1（新增 DI 生命周期规范） |
| Q5 | Remoteware 执行结果回写审计 | **不回写**（回执 message 不落库，保持调度级审计） | §5.8-2 |
| Q6 | 截图 imageUrl 内嵌 HttpToken | **接受**（与 bot 一致，仅 Admin 可见） | §5.8-3 |

**Open questions：无（全部定案，设计冻结，进入实施）**。

## 12. 测试与验证（实施阶段执行）

### 12.1 单元测试（新增 xUnit 工程 `LCDXNetApi.Tests`；前端 Karma spec）

**后端测试矩阵**（EF 依赖用 SQLite in-memory 或 EF InMemory 构造上下文；HTTP 依赖 mock HttpMessageHandler）：

| 被测对象 | 用例要点 |
|---|---|
| `CabinetPolicy` | mode∈{0,4,10} 边界（1/2/3/11 拒绝）；level 8 档边界（-2/8 拒绝）；17 条白名单；`NormalRemoteCommands` 子集判定（game-force-reboot 不在子集）；`NormalLcsetKeys` 子集判定（**chevent 不在子集**，第六轮 Q1） |
| Message 转义 | `\n \t \' \\` 映射、尾部孤立 `\`、空 message→`~` |
| `RemoteAuditService` | 密码脱敏（`user\|pass\|cmd` 三段 `***`）；Detail 2000 截断；审计异常不抛出（方案 A：记日志放行） |
| `RemoteControlService` | 先登记后外呼顺序（mock handler 断言调用时字典已含条目）；HTTP 非 2xx → 条目移除 + failed 审计；回执整体替换（并发读写无撕裂）；TTL 过期 → timeout；过期迟到回执不复活；懒清理移除超期条目 |
| `MemberAuthService` | 无 LCDXMembers 行 → permission 0；授权集合仅含 Enabled=true；hasManage 判定（∃授权行 ∨ P10——Admin 无授权行 → true）；grant 恢复语义（Enabled=false → 恢复并更新 GrantedAt/By）；(QQ,Keychip) 唯一冲突路径 |
| Controller 鉴权矩阵 | 无 token→401；普通用户对 EP-11/12/14/15..17 与子集外 EP-10/13 → 94001 + 审计 failed（Detail=subset-denied）；Admin 全通过；EP-18/19：无授权普通用户 → hasManage=false/空数组，Admin（无授权行）→ hasManage=true/全量（含未设 NickName 机台） |

**前端测试**（`ng test`，proportionate）：`BotPermissionService`（成功/失败/清理）、`ApiService.lcdxAuthHeaders` 注入、页②③角色过滤纯函数（指令列表/设置列表按 permission 过滤）。

### 12.2 集成与联调验证

1. `dotnet build` + `dotnet test` / `ng build` + `ng test` 全绿
2. 三张新表 DDL 执行 + Bootstrap 管理员插入
3. Swagger 按 §4 矩阵逐项打点（普通授权 / P10 管理员 × 13 功能，重点：子集边界）
4. 每个写端点后核对 UserRemoteLocks（含 subset-denied 失败记录、密码脱敏、grant-add/remove）
5. 真机：传统重启心跳清零；rm ping 回执；printscr 图片（Admin）；game-reboot（普通）；模式切换 BmDaemon 拉取生效
6. delivery/dlprog 输出与 bot 端同名命令一致性抽查（注意键格式差异）
