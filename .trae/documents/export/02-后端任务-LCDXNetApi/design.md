# Design: 后端实现设计（LCDXNetApi）

完整依据：`research/design-baseline.md`（§3 数据模型 / §3.2.1 子集 / §5 Remoteware / §6 endpoint / §9 结构 / §12 测试）

## 新增/修改文件

| 文件 | 内容 |
|---|---|
| `Database/CllnetDbContext.cs` 改 | CabinetLevel 8 值；Cabinet.IsSpecialMode int；+UserRemoteLockRecord / LCDXMemberRecord / LCDXCabinetGrantRecord 三实体与 DbSet |
| `Configures/RemotewareOptions.cs` 新 | §5.2 配置绑定 |
| `Services/CabinetPolicy.cs` 新 | 全部白名单与子集常量：AllowedModes/AllowedLevels/RemoteCommands(17)/NormalRemoteCommands(2)/LcsetKeys(19)/NormalLcsetKeys(2) |
| `Services/MemberAuthService.cs` +接口 新 | userName→QQNumber→permission(LCDXMemberPermissions)；授权集合(LCDXCabinetGrants Enabled)；hasManage 判定(EP-18：∃授权行∨P10)；可操控清单(EP-19：Admin 全量∨授权投影)；grant 增/恢复/吊销 |
| `Services/RemoteControlService.cs` +接口 新 | §5.4 调度 + §5.6 回执缓存 |
| `Services/Hosted/RemoteReplySubscriberService.cs` 新 | §5.5 单线程 SUB |
| `Services/RemoteAuditService.cs` +接口 新 | §3.3 落库（脱敏/方案 A 放行/detail 截断） |
| `Controllers/LCDXNetCabinetApi.cs` 新 | EP-01、EP-04..EP-17（含 13R）、EP-18/EP-19（EP-02/03 并入 EP-19 废弃） |
| `Models/DTOs/CabinetDtos.cs` 新 | 全部 DTO |
| `LCDXNetApi.Tests/` 新 | xUnit（§12.1 矩阵；EF 用 SQLite in-memory/InMemory，HTTP mock handler） |
| `Program.cs` / `appsettings.json` / `sln` | DI 注册；+Remoteware 节（无 QQBotDatabase）；解决方案加入测试工程 |

## 关键实现约束（grill 固化）

1. EP-13 顺序：L1+角色/子集判定→定位→requestId→预登记→POST→失败移除+审计→成功审计
2. Subscriber socket 单线程独占；StoreReply 整体替换；过期不复活；懒清理
3. 键格式：Serial=短 Keychip（内存派生后按值查）；其余表=FullKeychip
4. EP-13R = L1 + requestId 知识凭证（普通用户也轮询子集结果）
5. EP-16 恢复语义：Enabled=false 行 → 恢复并更新 GrantedAt/GrantedBy；不插重复行
6. grant 增删吊销均审计（grant-add/grant-remove）
