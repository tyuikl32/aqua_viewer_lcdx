# PRD: 舞萌DX 机台管理 —— 后端（LCDXNetApi 专属范围）

> 本任务仅覆盖 **LCDXNetApi** 后端改动。前端由独立 Trellis 任务管理：
> `E:\ALL.Net\Project_LCDX_NET\aqua_viewer_lcdx\.trellis\tasks\08-16-mai2-cabinet-features`
> 设计基线（单一事实源）：本任务 `research/design-baseline.md`（已含第五轮：细分下放 / 鉴权重设计 / 单元测试 / 入口探测 EP-18/EP-19 + L2 Admin 超集修正）。

## 需求（设计基线 §3/§5/§6/§9/§12）

1. **数据模型（全部 cll.net 库，零 bot 库依赖）**：CabinetLevel 补全 8 值；Cabinet.IsSpecialMode bool→int；新表 UserRemoteLocks（8 字段操作记录，失败也落库，密码脱敏，方案 A 失败放行）；新表 LCDXMembers（身份记录：QQNumber PK + Permission，无行=普通用户 0）；新表 LCDXCabinetGrants（1:N 授权，QQNumber+FullKeychip 唯一，Enabled 软吊销，GrantedAt/GrantedBy）
2. **鉴权三层**：L1 TokenAuth（既有 CheckTokenAsync）；L2 CabAuth = LCDXCabinetGrants(Enabled=true) **或** LCDXMembers.Permission>=10（Admin 为 L2 隐式超集，第五轮 #25）；L3 Admin = LCDXMembers.Permission>=10。**不新增 QQBotDbContext**
3. **细分下放（§3.2.1，第六轮 Q1 定案）**：lcset 普通用户仅 `event`（→MininumOpenEvent，`chevent` 不下放），Admin 19 项；Remoteware 普通用户仅 `game-reboot`/`game-switch`，Admin 17 条。子集判定在后端（CabinetPolicy），拒绝请求落审计 failed（Detail=subset-denied）
4. **18 个 endpoint**（EP-01、EP-04..EP-17 + 13R + EP-18/EP-19）：含入口探测 EP-18（hasManage=∃授权行∨P10，前端菜单显隐）、可操控清单 EP-19（Admin=全量 / 普通=授权投影，原 EP-02/EP-03 并入废弃，编号不复用）、授权管理 EP-15（查）/EP-16（增）/EP-17（软吊销），审计 grant-add/grant-remove
5. **Remoteware 子系统**：§5 详细设计（RemotewareOptions 配置化、先登记后外呼、单线程 socket、4 帧契约、懒清理 TTL、requestId=L1+知识凭证）
6. **单元测试**：新增 xUnit 工程 LCDXNetApi.Tests（§12.1 测试矩阵：CabinetPolicy/转义/脱敏/RemoteControlService/MemberAuthService/Controller 鉴权矩阵）

## 硬约束

- 禁止硬编码 Remoteware 常量（§5.2）
- 写操作必须跟踪查询（bot 的 AsNoTracking+SaveChanges 是已知 bug，不得复刻）
- delivery（AppDlReports/OptDlReports，短 Keychip=Serial，内存派生）与 dlprog（DownloadRecords，FullKeychip）是两个 endpoint，键格式不得混用
- mode 白名单 {0,4,10}；level 白名单 [-1..7]；command 白名单 17 条 + 普通子集 2 条
- QQBot/CLL.Net/BmDaemon 三项目零改动；LCDXNetApi 仅连 cll.net 单库

## 验收标准

- [ ] dotnet build + dotnet test 全绿
- [ ] 三张新表 DDL 可执行；Bootstrap 管理员 SQL 附带于部署说明
- [ ] Swagger 按 §4 矩阵逐项验证（普通授权 / P10 × 13 功能，重点子集边界：普通 lcset 请求 bd→94001+审计；普通 rm 请求 printscr→94001+审计）
- [ ] EP-18/19：无授权普通用户 → hasManage=false / 空数组；Admin（无授权行）→ hasManage=true / 全量（含未设 NickName 机台）
- [ ] 每个写端点后 UserRemoteLocks 有记录（含 subset-denied、密码脱敏、grant-add/remove）
- [ ] rm ping 调度→回执轮询 Pong!；printscr imageUrl（Admin）；game-reboot（普通用户）链路通
- [ ] reboot：IsRebooting=true 落库，enable=false 可取消
- [ ] 单元测试覆盖 §12.1 矩阵全部用例组
