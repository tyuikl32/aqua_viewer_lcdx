# Implement: 后端执行清单

1. [ ] CllnetDbContext 改（枚举 8 值 / IsSpecialMode int / 三新实体）
2. [ ] RemotewareOptions + appsettings Remoteware 节 + csproj/sln（+NetMQ、+测试工程）
3. [ ] CabinetPolicy（全部白名单/子集常量）
4. [ ] MemberAuthService（+接口：permission/hasManage/授权集合/可操控清单/grant 管理）
5. [ ] RemoteAuditService（+接口：脱敏/方案 A/截断）
6. [ ] RemoteControlService（+接口：§5.4/§5.6）
7. [ ] RemoteReplySubscriberService（HostedService：§5.5）
8. [ ] CabinetDtos（全部 DTO）
9. [ ] LCDXNetCabinetApi 控制器（EP-01/04..17 + 13R + EP-18/19；EP-02/03 废弃）
10. [ ] Program.cs 注册
11. [ ] LCDXNetApi.Tests：CabinetPolicy / 转义 / 脱敏 / RemoteControlService / MemberAuthService / Controller 鉴权矩阵
12. [ ] dotnet build + dotnet test 全绿
13. [ ] 输出部署包：三表 DDL + Bootstrap 管理员 SQL + 出站 443/5556 + 单实例说明

## 验证命令
- `dotnet build`、`dotnet test`（cwd=LCDXNetApi）
- 联调前置：cll.net 执行三表 DDL + Bootstrap

## 回滚点
新增（10 源文件 + 测试工程）+ 修改 4 文件（CllnetDbContext/csproj|sln/Program/appsettings）
