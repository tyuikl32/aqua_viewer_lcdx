# 设计基线抽取版（mai2 机台管理 · 前端任务上下文）

> 本文件是 `mai2-cabinet-management-v3-design.md`（48.7KB，超出 32KB 上下文注入上限）的**抽取版**，
> 覆盖前端任务 jsonl 声明的全部依赖章节：§2 键格式 / §3.2 权限模型（含 3.2.1 细分下放）/
> §5.3 指令白名单 / §5.6-5.7 回执读取与边界 / §6 endpoint 契约 / §7 错误码 / §8 前端设计。
> 未收录：§3.1/3.3/3.4 数据模型建表、§4 矩阵、§5 其余后端 ZMQ 内部、§9 后端内部结构、§10 部署、§11 审查记录、§12 测试。
> **单一事实源仍为原文件**；两处冲突时以原文为准。抽取日期 2026-08-22。

## 2. 术语与关键标识（grill 规则 3：键格式必须显式）

| 标识 | 格式 | 例 | 用途 |
|---|---|---|---|
| `FullKeychip` | 16 字符含 `-`（主键） | `A69E-01A88888888` | Cabinets 主键；**除 AppDlReports/OptDlReports 外所有表的关联键** |
| `Keychip`（短） | `[NotMapped]` 派生：`FullKeychip.Remove(12,4).Replace("-","")` | `A69E01A888` | **仅** AppDlReports/OptDlReports 的 `Serial` 列。因是派生属性，SQL 内不可用，须内存计算后按值查询 |
| `NickName` | 任意字符串（如 `fm1`） | `fm1` | 用户输入的机台定位符 |
| `QQNumber` | long | — | 用户唯一标识（LCDXUserV2Records 主键；bot Users 主键） |
| `UserName` | `LCDX{36进制}` | `LCDXabc12` | 前端登录名（RinNET 体系）；QQNumber 经 LCDXUserV2Records 反查 |

机台定位规则（与 bot 一致）：`NickName == 输入` 精确匹配 → 失败再 `FullKeychip.Contains(输入)` → 仍失败返回 94041。

### 3.2 权限模型

| 层 | 名称 | 判定 | 用途 |
|---|---|---|---|
| L1 | TokenAuth | `Authorization` 头 + 路径 `{userName}` → `IRinnetAdminService.CheckTokenAsync`（既有服务，经 RinNET `/api/user/me` 校验归属） | 所有端点前置；失败 401 |
| L2 | CabAuth | L1 + `userName→QQNumber`（LCDXUserV2Records）+ [`LCDXCabinetGrants` 存在 `(QQNumber, FullKeychip, Enabled=true)` **或** `LCDXMemberPermissions.Permission>=10`] | 普通用户功能 |

> Admin 为 L2 的隐式超集（第五轮 grill #25 修正）：§4 矩阵管理员列全 ✅，若无授权行的管理员被 L2 拦截则矩阵不成立。L2 判定 = 有 Enabled 授权行 **或** Permission≥10。
| L3 | Admin | L1 + `LCDXMemberPermissions.Permission >= 10` | 管理员功能 |

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

### 5.3 指令白名单与消息转义

- 全量白名单 17 条：`remote-cmd(-with-user)` / `remote-bat(-with-user)` / `remote-url-bat(-with-user)` / `printscr` / `remote-card` / `download` / `downloadpro` / `unzip` / `logsince` / `logsave` / `game-reboot` / `game-switch` / `game-force-reboot` / `ping`。
- **按角色子集（§3.2.1）**：Admin = 全量；普通（CabAuth）= `NormalRemoteCommands = { game-reboot, game-switch }`。**白名单外或子集外一律 94001，在产生任何外呼副作用之前拒绝；拒绝请求仍落审计（result=failed，Detail 注明 subset-denied）——被拒绝的尝试本身是可疑行为证据**。
- `Message` 转义：移植 bot `UnescapeUserInput`（`\n`→LF、`\t`→TAB、`\'`→`"`、`\\`→`\`，尾部孤立 `\` 保留）；空 message 以 `"~"` 占位（bot 同款，CLL.Net `[Required]` 不接受空串）。
- 前端下拉按 permission 过滤展示（普通 2 条 / Admin 17 条），无参指令禁用参数框；**前端过滤仅为 UX，安全边界在后端**。

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

## 6. Endpoint 规范（全部在 LCDXNetApi，前缀 `lcdx/cabinet`）

通用约定：
- 响应统一 `ApiResponse<T>`：`{ status:{code,message}, time, data }`；成功 code=92001
- 所有端点失败鉴权返回 HTTP 401（token 无效）；L2/L3 权限不足返回 HTTP 200 + code=94001（与既有控制器一致）
- 所有 `{userName}` 为路径段，`Authorization: Bearer {lcdx accessToken}` 头必带
- 时间格式 ISO-8601 字符串；`page/size` 分页参数默认 `1/20`

### 6.1 权限与机台清单

**EP-01 `GET lcdx/cabinet/permission/{userName}`**
- 鉴权：L1
- 数据源：`LCDXMemberPermissions`（无行 = permission 0）
- 响应 data：`{ qqNumber: long, permission: int }`
- 错误：401
- 副作用：无

**EP-18 `GET lcdx/cabinet/manage-access/{userName}`**（入口探测：是否有任何机台管理权限，第五轮新增）
- 鉴权：L1
- 判定：与 §3.2 L2 同源——`LCDXCabinetGrants` 存在 `(QQNumber, Enabled=true)` 行 **或** `LCDXMemberPermissions.Permission>=10` → `hasManage=true`（Admin 为隐式超集，无授权行也为 true）
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
