# LCDX 项目全面审计汇总报告

日期：2026-08-22
范围：前端 aqua_viewer_lcdx + 后端 LCDXNetApi（纯静态审计 + 主站/数据库只读验证）
任务树：`.trellis/tasks/08-22-full-project-audit`（父）+ 三个子任务
分报告：功能走查 `08-22-feature-walkthrough/research/walkthrough.md`；注册排查 `08-22-register-investigation/research/register.md`；汉化审计 `08-22-i18n-audit/research/i18n-audit.md`

---

## 一、需求逐项结论

### 需求 1：完整走一遍项目，前后端能否运行

**静态链路核对：32 项功能，✅15 / ❌6 / ⚠️11。**

- ✅ 15 项：登录、注册、一次性登录、NetCode 绑卡、公告列表、Dashboard、KOP 排行、机台四页（cabinets/cabmode/remotecontrol/locks）、引继、静态页等，前端调用与后端端点（方法+路径+DTO）逐一匹配。
- ⚠️ 11 项：mai2 游戏数据 10 页走 Rinnet 主站（代码不在本仓库，无法静态核对）+ songlist 本地 IndexedDB。
- ❌ 6 项：见下方问题表 D1/D3。
- 结论：**核心链路（登录/注册/机台管理/公告/引继）前后端契约完整，可以运行**；后端无构建错误（历史构建 95/95 测试绿），前端 tsc 通过。

### 需求 2：注册方面问题是否修复

**已修复（含运行时验证）。**

- 历史 bug 均已修复：QQ 号无法注册（前端 `373ee5b`，email 校验器误用）、密码修改失败（后端 `0b09b91`）。
- 本次新发现并已解决：主站升级 JWT+EULA 后，`RinnetAdminService` 的 admin token 流程缺 EULA 接受逻辑，注册建号调 `/api/admin/createUser` 返回 **403（34033 EULA acceptance required）**。登录链路有 `EulaService.AcceptCurrentAsync` 所以正常——「只有注册坏、登录好」完全吻合。
- **处置**：已用 admin 账号接受 EULA v1（账号级状态），生产注册恢复（用户已确认修好）。
- 代码根治建议（未实施）：`RinnetAdminService.EnsureAdminSessionAsync` 在 SignInAsync 成功后同样调用 EULA 接受；以及 register 专项报告中的 P1 遗留（Rinnet 孤儿账号卡死、94011/34001 状态码不匹配、密码明文存储）。

### 需求 3：汉化做得怎么样

**Key 层面本次已修复至 100% 同步；文案层面存量债务约 100 处（未修，已分类）。**

- 本次修复 7 处不同步（en 缺 5 个 key、zh 缺 DirectJoin、Ongeki 尾随空格坏 key），修复后 zh 842 = en 842，tsc 通过。
- 存量：40 处 status.message 裸透传 + 52 处 ts 硬编码英文 + 6 处硬编码中文 + 4 处模板硬编码。优先级：P1 为 keychip/cards/dashboard/maimai2-setting/admin（约 60 处），P2 为其余低频页。

### 附加调查：mergeRegistry 卡号转换（用户反馈"算出来是 10000000"）

**结论：算法正确，非 bug，已挂起。** `userId = (卡号后10位 - 4579) / 83` 与数据库历史记录交叉验证一致（userId 10913322 反推卡号在映射表真实存在）。卡号 `24304430670830004579` 后缀 0830004579 = 10000000×83+4579，是合法编码。队友已确认功能无问题。

---

## 二、问题清单（全量，P0 无 / P1 三项 / P2 八项）

| # | 级别 | 层 | 位置 | 问题 |
|---|---|---|---|---|
| 1 | P1 | 后端 | LCDXNetUserApi.cs:80 | `getBindAccessCode/{accessCode}` 无 token 校验，匿名可枚举卡号绑定关系（同文件其他端点都有 CheckTokenAsync，属漏写）；:134/:148 `mergeRegistry/client/*` 亦无鉴权（疑游戏客户端回调，需确认） |
| 2 | P1 | 前端 | announcements.component.ts:137 | admin 编辑公告跳 `/announcements/edit`，路由表无此路径 → 404，EditComponent 死代码 |
| 3 | P1 | 后端 | LoginRegisterService.cs:213-237 | Rinnet 孤儿账号：主站建号成功但本地写库失败后重试将永久卡死，无补偿逻辑；另 :206 验证码错误返回 94011 与前端 34001 不匹配（本地化死代码）；:234 密码明文存储 |
| 4 | P2 | 前端 | app.module.ts:121-128 | Keychip/Cards/Profile/Admin 等 7 组件无路由不可达（死代码），其中 Keychip 管理页功能实际缺失 |
| 5 | P2 | 后端 | LCDXNetAnnouncementApi.cs | 前端传 lang 参数后端全部忽略，公告多语言失效 |
| 6 | P2 | 前端 | maimai2-setting.component.ts:92,210,223 | 绑卡取 `cards[0].luid` 而非 `defaultCard.luid`，多卡用户可能操作错卡 |
| 7 | P2 | 后端 | Program.cs:99 | 无 AddAuthentication/[Authorize]，鉴权全靠手工检查，新端点漏写即匿名暴露（#1 即实例） |
| 8 | P2 | 前端 | maimai2-setting.component.ts:208-234 | lcdxBindAccessCode 两个 if 非互斥，可能连发 remove+add |
| 9 | P2 | 后端 | Program.cs:72 | CORS 白名单不含 `http://localhost:4200`，本地 dev 直连被拦 |
| 10 | P2 | 后端 | EmailService.cs / VerifyCodeStorage.cs | SMTP 构造函数同步连接、验证码输错一次即作废、验证码仅存内存（详见 register.md P2 项） |

## 三、建议后续任务（按优先级）

1. `fix/bind-endpoint-auth`（P1，后端小改）：getBindAccessCode 补 CheckTokenAsync
2. `fix/announcement-edit-route`（P1，前端小改）：补路由或改跳转
3. `fix/rinnet-admin-eula`（P1，后端小改）：admin token 流程补 EULA 自动接受（防主站再更新 EULA 时复发）
4. `i18n-cleanup-batch1`（P1，前端中等）：keychip/cards/dashboard/maimai2-setting/admin 透传+硬编码改 i18n
5. 注册链路健壮性（P1-P2）：孤儿账号补偿、状态码对齐、密码哈希（涉及存量数据迁移，需单独设计）
