# Implement: 前端执行清单（分层递进 · 第六轮定案）

> 组织原则：**先大框架后细小功能**——每层结束 `ng build` 保持绿，层层递进；不按需求条目从上到下平铺。
> 前置：后端任务（LCDXNetApi/08-17-mai2-cabinet-backend）联调就绪前，可先用契约开发 + mock。
> 权限数据源：EP-01（permission，LCDXMembers，经后端）+ EP-18（hasManage 入口探测）；普通/管理能力差异见设计基线 §3.2.1（lcset 普通子集仅 event，第六轮 Q1 定案）。

## 层 1｜接线层 —— 交付物：权限流转 + 菜单门控生效

1. [x] ApiService：getLcdxAuth/postLcdxAuth/**deleteLcdxAuth**（Authorization 头注入）
2. [x] BotPermissionService（EP-01+EP-18 探测，BehaviorSubject：permission+hasManage）+ UserService 挂钩（load 成功触发 / clear 归零+false）
3. [x] menu.service 4 菜单项 + 分支（Cabinets/CabinetControl/RemoteControl=AfterLogin+hasManage（EP-18）；Locks=P10）

**验收**：`ng build` 绿；BotPermissionService 单测（permission/hasManage 成功、失败、清理）

## 层 2｜页面骨架层 —— 交付物：4 页可导航

4. [x] routing + module 声明 + 4 组件壳（页面标题 / 卡片布局骨架 / 机台下拉统一接 EP-19：普通=授权投影，Admin=全量，无需切换）

**验收**：`ng build` 绿；hasManage 用户见 ①②③ 菜单，P10 见全部 4 项；直访路由可达

## 层 3｜读功能层 —— 交付物：全部只读功能可用

5. [x] 页① 四卡片：机台状态 EP-04（含已启用设置）/ 上机人数 EP-05 / 配信状态 EP-06 / 下载进度 EP-07（Done/Error/HashError/Incomplete/x% 徽标）+ 手动刷新 + 30s 自动刷新开关
6. [x] 页④ 卡A 操作记录（EP-14 过滤 + 分页）；卡B 授权清单（EP-15，含 Enabled=false 行）

**验收**：`ng build` 绿；下拉切换机台后各卡片数据刷新

## 层 4｜写功能层 —— 交付物：全部写操作可用（含角色过滤）

7. [x] 页② 普通区：LC 模式四框 EP-08（模式未变禁用提交）+ 重启二态 EP-09（设置需二次确认）+ LC 功能卡 EP-10（**普通仅 event 一项、Admin 19 项**）；管理区：级别卡 EP-11（8 档下拉 + 配信警告）
8. [x] 页③：发送 EP-13 → 轮询 EP-13R（2s×30，pending/done/timeout）；指令下拉**按角色过滤**（普通 game-reboot/game-switch，Admin 17 条带参数提示）；文本 `<pre>` / printscr `<img>` 仅 Admin；会话记录（内存态）
9. [x] 页④ 卡B 写操作：EP-16 新增授权（QQ+机台下拉）+ EP-17 吊销（二次确认）

**验收**：`ng build` 绿；普通账号页② 仅 1 项设置、页③ 仅 2 条指令；Admin 全量

## 层 5｜打磨与交付层 —— 交付物：零错误 + 联调就绪

10. [x] i18n zh/en 全量词条；空态/错误态兜底（EP-19 空列表提示）
11. [x] Karma 单测：lcdxAuthHeaders 注入、页②③角色过滤纯函数
12. [x] `ng build` + `ng test` 零错误
13. [x] 联调验收（对照 prd 验收标准逐项，重点：普通用户子集边界）

**层 5 补强（2026-08-18，清单外）**：路由守卫 CabinetManageGuard/CabinetAdminGuard（设计 §8"直访提示无权限"；cabinets/cabmode/remotecontrol=manage 档，locks=admin 档）——commit ec2e420，单测 6/6。联调验收状态以 prd.md 验收清单为准（本地 2/7，其余待后端部署）。

## 验证命令

- `npx ng build`、`npx ng test`（cwd=仓库根）

## 回滚点

全部为新增组件 + 既有文件小改（api/menu/routing/module/user.service/i18n×2）；回滚 = 删新增目录 + restore 修改文件；**层间以各层验收点为界**
