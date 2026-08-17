# Implement: 前端执行清单（第五轮设计）

> 前置：后端任务（LCDXNetApi/08-17-mai2-cabinet-backend）联调就绪前，可先用契约开发 + mock。
> 权限数据源：EP-01（permission，LCDXMembers，经后端）+ EP-18（hasManage 入口探测，第五轮新增）；普通/管理能力差异见设计基线 §3.2.1。

1. [ ] ApiService：getLcdxAuth/postLcdxAuth/**deleteLcdxAuth**（Authorization 头注入）
2. [ ] BotPermissionService（EP-01+EP-18 探测，BehaviorSubject：permission+hasManage）+ UserService 挂钩（load 成功触发 / clear 归零+false）
3. [ ] menu.service 4 菜单项 + 分支（Cabinets/CabinetControl/RemoteControl=AfterLogin+hasManage（EP-18）；Locks=P10）
4. [ ] 页① maimai2-cabinets（EP-19 下拉 + 四卡片 EP-04/05/06/07 + 30s 自动刷新）
5. [ ] 页② maimai2-cabmode：普通区（模式四框 EP-08 + 重启二态 EP-09 + LC 功能卡 EP-10 **普通仅 event 一项、Admin 19 项**）；管理区（级别卡 EP-11）
6. [ ] 页③ maimai2-remote-control：机台下 EP-19（普通=授权机台，Admin=全量，无需切换）；指令下拉**按角色过滤**（普通 game-reboot/game-switch，Admin 17 条）；发送 EP-13 → 轮询 EP-13R（2s×30，pending/done/timeout；printscr 图片仅 Admin）
7. [ ] 页④ maimai2-locks（P10）：卡A 操作记录（EP-14 过滤+分页）；卡B 授权管理（EP-15 清单 / EP-16 新增 / EP-17 吊销二次确认）
8. [ ] routing/module/i18n（zh+en 全量词条）
9. [ ] Karma 单测：BotPermissionService（permission/hasManage 成功、失败、清理）、lcdxAuthHeaders、页②③角色过滤纯函数
10. [ ] `ng build` + `ng test` 零错误
11. [ ] 联调验收（对照 prd 验收标准逐项，重点：普通用户子集边界）

## 验证命令
- `npx ng build`、`npx ng test`（cwd=仓库根）

## 回滚点
全部为新增组件 + 既有文件小改（api/menu/routing/module/user.service/i18n×2）；回滚 = 删新增目录 + restore 修改文件
