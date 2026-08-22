# Registration flow investigation

## Goal

静态排查注册功能（sign-up）全链路，定位潜在问题。用户反馈「注册方面问题是否修复」但无具体现象记录，需全链路审查后给出结论：是否存在缺陷、在哪一层、是否已修复。

## Requirements

- 前端链路：`sign-up.component.ts/html` 表单校验（QQ 号格式、密码一致性、验证码）→ `authenticationService` 的 getVerifyCode_lcdx / 注册提交 → api.service 的 HTTP 封装 → i18n 提示
- 后端链路：`LCDXNetLoginController` 的 `register_start/{qqNumber}` / `register_confirm/{qqNumber}` → `LoginRegisterService`（验证码生成与校验、SMTP 发送、QQ 号与 Rinnet 主站账号关联、注册事务）
- 重点核对：
  - 验证码发送的频率限制与错误分支
  - SMTP 配置的有效性引用（appsettings EmailSettings）
  - register_confirm 的参数校验（密码强度、验证码过期、QQ 号未注册主站时的行为）
  - 前后端 DTO 字段契约
  - git 历史：注册相关代码近期是否有修复提交（回答「是否已修复」）
- 不发送真实邮件、不运行服务

## Acceptance Criteria

- [x] 注册链路图（前端表单 → API → 后端 Service → 数据库/主站）
- [x] 发现的问题逐条列出：层 / 文件:行号 / 现象 / 严重级别
- [x] 明确回答「注册问题是否已修复」：结合 git log 证据
- [x] 结果写入 `{TASK_DIR}/research/register.md`
