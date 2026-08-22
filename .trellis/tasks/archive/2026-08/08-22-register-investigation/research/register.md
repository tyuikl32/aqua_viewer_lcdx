# LCDX 注册（Sign-up）全链路静态审计报告

审计日期：2026-08-22  
审计方式：纯静态代码审查（未运行服务、未发真实邮件）  
前端仓库：E:/ALL.Net/Project_LCDX_NET/aqua_viewer_lcdx（Angular 22）  
后端仓库：E:/ALL.Net/Project_LCDX_NET/LCDXNetApi（ASP.NET Core）

---

## 一、注册链路图

什么算出来的是10000000

RinnetHost = <https://portal.naominet.live> (appsettings.json TitleSettings)  
lcdxApiServer = <https://lcdxnet.am-allnet.com/> (dev) / "/" (prod, 同域)  [与后端 Route("lcdx") 前缀匹配]

---

## 二、问题/风险清单

| #  | 层     | 文件:行号                                                                          | 现象                      | 级别 | 说明                                                                                                                                                                                                                   |
| -- | ----- | ------------------------------------------------------------------------------ | ----------------------- | -- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | 后端    | Services/LoginRegisterService.cs:213-237                                       | Rinnet 孤儿账号导致注册永久卡死     | P1 | 新用户路径：先调 Rinnet createUser，成功后才写本地 UserV2 表。若 Rinnet 建号成功但本地 AddAsync 失败/服务重启，本地无记录；用户重试时 GetByUserNameAsync 仍为 null -> 再次 CreateUser -> Rinnet 返回"用户已存在" -> throw "User creation failed"，该 QQ 号永远无法完成注册。无任何补偿/对账逻辑。 |
| 2  | 前后端契约 | status-code.ts:33 vs LoginRegisterService.cs:206                               | 验证码错误提示未本地化             | P1 | 后端验证码错误返回 94011，前端 VERIFY_CODE_NOT_CORRECT = 34001，永远不匹配。sign-up.component.ts:142 的 CodeIncorrect 分支是死代码，用户实际看到英文原文 "Invalid verification code"（且与 UNAUTHORIZED=94011 复用同一状态码，语义冲突）。                                 |
| 3  | 后端    | Services/LoginRegisterService.cs:234,240 + Repositories/UserV2Repository.cs:19 | OuterPassword 明文存储、明文比对 | P1 | 用户设置的密码不经哈希直接入库，登录时明文等值查询。数据库泄露即全部密码泄露；同时明文密码出现在 EF 查询表达式中可能进慢查询日志。                                                                                                                                                  |
| 4  | 后端    | Services/EmailService.cs:24,39-59                                              | SMTP 在构造函数中同步连接         | P2 | 单例 DI 下服务启动即连接 smtp.qcloudmail.com:465，失败直接 throw；SMTP 不可达时 register_start 全部返回 94001，且可能影响宿主启动。发送全程持全局 lock，并发注册串行阻塞（同步 IO 在 async 链路上）。                                                                            |
| 5  | 后端    | Services/Hosted/VerifyCodeStorage.cs:89-105                                    | 验证码输错一次即作废              | P2 | Verify 用 TryRemove 实现：只要提交（无论对错）code 即被删除。用户抄错一位就要重新等 60 秒再收一封邮件。有效期 10 分钟形同虚设。                                                                                                                                      |
| 6  | 后端    | Controllers/LCDXNetLoginApi.cs:73-99 + LoginRegisterService.cs:197-201         | 后端无 QQ 号/密码强度校验         | P2 | 路由参数为 long，接受 0、负数、超长 QQ 号；密码仅查非空。绕过前端直接调 API 可注册 1 位密码账户。前端校验（5-12 位、8-100 位）仅是 UI 层约束。                                                                                                                             |
| 7  | 后端    | Services/Hosted/VerifyCodeStorage.cs:25                                        | 验证码仅存内存                 | P2 | ConcurrentDictionary：API 重启后所有已发验证码失效；多实例部署时不共享，负载均衡后验证/发送可能打到不同实例。                                                                                                                                                  |
| 8  | 后端    | Services/LoginRegisterService.cs:260-271                                       | 半成功状态吞错 + 硬编码中文         | P2 | phase1 成功但 SignInAsync 失败时返回硬编码中文 "操作成功，请手动登录"（其余 message 均英文），且吞掉真实异常信息，用户不知发生了什么。                                                                                                                                  |
| 9  | 设计    | Services/EmailService.cs:124                                                   | QQ->邮箱硬编码 {qq}@qq.com   | P2 | 假设所有 QQ 号开通并使用 QQ 邮箱；未开通者收不到验证码，且发送失败统一报 94001 "Failed to send verification code"，用户无法区分"QQ 邮箱未开通"与其他故障。                                                                                                             |
| 10 | 后端    | Services/LoginRegisterService.cs:181                                           | 回滚逻辑语义误用                | P3 | 发信失败后调 \_verifyCodeStorage.Verify(qqNumber, code) 删除已存 code——借"校验"做"删除"，当前恰好能工作（code 即刚生成值），但脆弱且难读，应提供 Remove/Delete API。                                                                                            |
| 11 | 前端    | auth/authentication.service.ts:161                                             | 参数命名误导                  | P3 | getVerifyCode_lcdx(email: string) 形参名 email，实为 QQ 号，纯可读性问题。                                                                                                                                                          |
| 12 | 后端    | Services/LoginRegisterService.cs:277-279                                       | 手工字符串拼接 JSON            | P3 | SignInAsync 用 $"{{"usernameOrEmail":...}}" 拼 JSON。当前 password 来自 TokenGenerate（字母数字）无注入风险，但任何后续改动（如改传 OuterPassword）会引入 JSON 注入/损坏风险。                                                                                |
| 13 | 后端    | Services/LoginRegisterService.cs:166                                           | 4 位纯数字验证码               | P3 | 码空间仅 10000。因 TryRemove 一次性消耗机制（错一次即作废）爆破不可行，风险可接受，记录备查。                                                                                                                                                              |

无问题项（已核对）：

- 路由匹配：前端 lcdx/register_start|register_confirm 与后端 [Route("lcdx")] + HttpGet/HttpPost 一致。
- DTO 契约：前端 body {code, password} 与 RegisterRequestDto {code, password} 字段完全对应，无多余/缺失字段。
- i18n：zh.json/en.json 的 SignUpPage.* 覆盖组件与模板全部 key（SendCodeSuccess/SendCodeTooFast/CodeIncorrect/QQNumberInvalid/PasswordErrors 等），无缺失。
- 频率限制：前端 60 秒按钮禁用与后端 1 分钟重发冷却匹配。
- 表单校验：QQ 5-12 位数字、验证码 4 位数字、密码 8-100 位、两次一致，实现正确。
- 验证码回滚：SMTP 发送失败时已存 code 会被删除，不会出现"占着冷却却无码可验"。

---

## 三、git 历史证据

### 前端仓库（aqua_viewer_lcdx）

- `373ee5b` "修复了qq号无法注册的bug"（2026-04-06）  
  根因：sign-up 表单原先复用了 email 校验器 + type=email 输入框，纯数字 QQ 号被 Validators.email 拒绝，导致无法注册。该提交将校验改为 pattern ^[0-9]+$ 并补验证码 4 位数字校验。当前代码已进一步重构为 qqNumber 控件（5-12 位数字校验），是该修复的延续和加强。
- `cd164d6` "feat(auth): auto login after registeration"  
  注册成功后自动登录（对应 procLoginResp 流程）。
- `01e3e7e` "fix: use provideTranslateHttpLoader() to set up TRANSLATE_HTTP_LOADER_CONFIG"  
  与 i18n 加载相关的修复。

### 后端仓库（LCDXNetApi）

- `0b09b91` "Fix password change issue"（2026-01-24）  
  修复注册/重置路径两处：EmailService 去掉 IDisposable（避免 DI 释放后 SMTP 客户端失效）；EncodeWithOffset 改为 OffsetBaseConverter.EncodeWithOffset 修正静态方法引用错误（此前"重复注册=重置密码"路径会出错）。
- `23e0408` "重构"  
  引入 RegisterRequestDto（code/password 契约定型）及服务层重构。
- `6b5710e` / `8d3eab7` "Add token link and registration Apis"  
  注册 API 首次加入。
- `8e4697f` "Add Mail"、`a167bf3` "Fix Lifetime fault"、`0c08c87`/`bff45ad` "Update EmailService.cs"  
  邮件服务相关迭代。

---

## 四、结论：注册方面的问题是否修复？

**历史上确实存在并修复过的注册缺陷有两个：**

1. "QQ 号无法注册"（前端 373ee5b）：表单误用 email 校验器导致纯数字 QQ 号无法提交——**已修复**，且当前表单校验（5-12 位数字 + 4 位验证码 + 密码规则 + 两次一致）完整、i18n 覆盖齐全。
2. "密码修改/重置失败"（后端 0b09b91）：EncodeWithOffset 方法引用错误 + EmailService 被 DI 提前释放——**已修复**。

**当前代码状态下，主链路（发码 -> 验证 -> 建号 -> 自动登录）在正常路径可以工作**，路由、DTO 契约、i18n 均已核对无误。

**但仍存在未修复的遗留风险**，最重要的是两个 P1：

1. Rinnet 孤儿账号问题（LoginRegisterService.cs:213-237）：Rinnet 建号成功而本地写库失败后，该 QQ 号将永久无法注册，无恢复手段；
2. 状态码契约不匹配（94011 vs 34001）：验证码错误时用户看到英文原文而非本地化提示，且该分支与 UNAUTHORIZED 复用同一码值。

另有密码明文存储（P1 安全隐患）、验证码输错即作废（P2 体验）、后端缺输入校验（P2）等问题。总体判断：**"能否注册"这一历史问题已修复；"注册体验与健壮性"仍有 1 个可致永久卡死的边界缺陷和多个 P2 级风险待处理。**
