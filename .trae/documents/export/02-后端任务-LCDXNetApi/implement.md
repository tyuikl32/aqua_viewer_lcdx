# Implement: 后端执行清单（分层递进 · 第六轮定案）

> 组织原则：**先大框架后细小功能**——每层结束时仓库处于可验证状态（编译/单测/打点），层层递进；不按需求条目从上到下平铺。
> 设计依据：`research/design-baseline.md`（§3 数据模型 / §5 Remoteware / §6 endpoint / §9.1 DI 生命周期 / §12 测试矩阵）。

## 层 1｜地基层 —— 交付物：编译通过

纯声明式代码（实体/配置/常量/DTO），无行为逻辑。

1. [ ] CllnetDbContext：CabinetLevel 补全 8 值；Cabinet.IsSpecialMode bool→int；三新实体 + DbSet（UserRemoteLockRecord / LCDXMemberRecord / LCDXCabinetGrantRecord）
2. [ ] RemotewareOptions（Options 模式）+ appsettings `Remoteware` 节 + csproj/sln（+NetMQ 4.0.4.2、+LCDXNetApi.Tests 测试工程）
3. [ ] CabinetPolicy 白名单常量：AllowedModes{0,4,10} / AllowedLevels[-1..7] / RemoteCommands(17) / NormalRemoteCommands{game-reboot,game-switch} / LcsetKeys(19) / **NormalLcsetKeys{event}**（chevent 不在子集，第六轮 Q1）
4. [ ] CabinetDtos：全部请求/响应 DTO

**验收**：`dotnet build` 绿；CabinetPolicy 单测（mode/level/白名单/子集边界——含 chevent 拒绝）

## 层 2｜服务内核层 —— 交付物：业务主干单测绿

5. [ ] MemberAuthService（+接口）：userName→QQNumber→permission；授权集合（Enabled=true）；hasManage（∃授权行∨P10）；可操控清单（Admin 全量∨授权投影）；grant 增/恢复/吊销
6. [ ] RemoteAuditService（+接口）：落库 + 密码脱敏 + Detail 2000 截断 + 方案 A（审计失败记日志放行）
7. [ ] RemoteControlService（+接口）：§5.4 先登记后外呼 + §5.6 回执缓存（整体替换/懒清理）；IHttpClientFactory 命名客户端（禁止 new HttpClient）
8. [ ] RemoteReplySubscriberService（HostedService）：§5.5 单线程独占 socket / 心跳 / 重连 / 4 帧契约 / 不完整帧丢弃
9. [ ] Program.cs DI 注册：严格按基线 §9.1（Singleton/Scoped/AddHostedService/IServiceScopeFactory 反模式禁令/ValidateOnStart）

**验收**：单测绿——grant 恢复语义 / 先登记后外呼顺序 / 回执整体替换 / TTL 过期+迟到不复活 / 脱敏 / Message 转义

## 层 3｜端点骨干层 —— 交付物：Swagger 全端点可打

10. [ ] LCDXNetCabinetApi 控制器：18 端点（EP-01 / EP-04..17 含 13R / EP-18 / EP-19；EP-02/03 废弃不复用），happy path（L1 鉴权 + L2/L3 判定 + 查询与写操作主干）

**验收**：`dotnet build` 绿；Swagger 逐端点打点通（EP-01/18/19、EP-04..07 查询、EP-14/15 Admin 查询）

## 层 4｜细节收口层 —— 交付物：全部细小规则落地

11. [ ] 子集拒绝：EP-10 普通仅 `event`、EP-13 普通仅 2 指令；越界 → 94001 + 审计 failed（Detail=subset-denied，被拒尝试本身是证据）
12. [ ] 散点规则：失败路径审计（HTTP 非2xx/异常 → 条目移除+failed 审计）；EP-16 恢复语义（Enabled=false 行恢复，不插重复行）；EP-13R printscr→imageUrl；EP-07 progressText 映射（10000/-1/-2/-3）；EP-05 人名打码（ShowHiddenName）；EP-06 短 Keychip 内存派生后按值查；过期迟到回执不复活 + 懒清理

**验收**：Controller 鉴权矩阵单测全绿（§12.1：无 token→401；普通对 EP-11/12/14..17 及子集外→94001+审计；Admin 全通；EP-18/19 三态）

## 层 5｜交付层 —— 交付物：全绿 + 可部署

13. [ ] `dotnet build` + `dotnet test` 全绿（§12.1 矩阵全覆盖）
14. [ ] 部署包输出：三表 DDL + Bootstrap 双管理员 SQL（3413607143 / 2320812015）+ 出站放行 443/5556 + 单实例说明

## 验证命令

- `dotnet build`、`dotnet test`（cwd=LCDXNetApi）
- 联调前置：cll.net 执行三表 DDL + Bootstrap

## 回滚点

新增（10 源文件 + 测试工程）+ 修改 4 文件（CllnetDbContext / csproj|sln / Program / appsettings）；**层间回滚以各层验收点为界**
