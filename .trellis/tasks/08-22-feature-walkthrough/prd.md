# Feature walkthrough audit (frontend-backend chain)

## Goal

以静态审查方式完整走一遍项目功能面：以前端路由为骨架，逐功能追踪 组件 → api.service / authenticationService → 后端 Controller → Service 的实现链路，标记每个功能的健康状态。

## Requirements

- 路由清单以 `src/app/app-routing.module.ts` 为准，覆盖全部用户可达页面（含守卫保护页）
- 每个功能核对：前端调用的 API 路径 ↔ 后端 Controller 端点是否匹配（方法 + 路由 + 请求/响应 DTO 字段）
- 关注明显缺陷：调用了不存在的端点、DTO 字段错位、守卫绕过、404/异常未处理、依赖缺失（如远程 MySQL/SMTP/Rinnet 不可达时的行为）
- 不运行任何服务（用户已确认仅静态审查）

## Acceptance Criteria

- [ ] 产出功能走查表：路由 / 功能名 / 前端文件 / 后端端点 / 状态（✅/❌/⚠️）/ 说明
- [ ] 发现的缺陷逐条附文件路径与行号
- [ ] ⚠️ 项注明「需运行时验证」的原因
- [ ] 结果写入 `{TASK_DIR}/research/walkthrough.md`
