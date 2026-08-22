# Full project audit: features, registration, i18n

## Goal

对 LCDX 项目（前端 `aqua_viewer_lcdx` + 后端 `LCDXNetApi`）做一次全面静态审计，覆盖三个交付物：功能走查、注册流程排查、汉化进度审计。父任务持有需求集与最终集成审查，实际工作由三个子任务完成。

## Scope & Constraints

- **验证方式：静态审查为主**（已与用户确认）。不起前端 dev server、不做完整联调、不发送真实验证码邮件；必要时可用 API 测试思路核对后端契约，但不运行服务。
- 后端仓库存在与本审计无关的未提交遗留（`publish-linux.yml` 修改 + `08-22-single-file-publish` 任务目录），**不混入本次改动**。
- 用户偏好产出以**表格分类**呈现，问题按 P0/P1/P2 分级。

## Deliverables (owned by child tasks)

| Child task | Deliverable |
|---|---|
| `08-22-feature-walkthrough` | 功能走查表：路由 → 组件 → API → 后端实现链路，逐项标注 ✅正常 / ❌缺陷 / ⚠️无法静态断定 |
| `08-22-register-investigation` | 注册流程排查报告：前端表单 + 后端 LoginRegisterService 静态审查，定位潜在缺陷并分级 |
| `08-22-i18n-audit` | 汉化审计报告：zh/en key 同步修复（trivial）+ 透传/硬编码英文分类清单与修复建议 |

## Cross-child Acceptance Criteria

- [ ] 三个子任务各自产出落盘到 `{TASK_DIR}/research/` 或最终汇总报告
- [ ] 汇总报告（三部分表格 + P0/P1/P2 分级问题清单）交付给用户
- [ ] i18n trivial 修复通过 `npx tsc --noEmit -p tsconfig.app.json` + JSON 解析验证
- [ ] 提交遵循 Phase 3.4 批量提交计划（需用户确认后执行）
- [ ] journal 记录本次 session

## Notes

- 三个子任务无相互依赖，可并行审计；汉化 trivial 修复在审计完成后统一执行。
- 「注册方面问题」无历史记录，用户不确定具体现象——排查需覆盖验证码发送、SMTP 配置、注册确认、异常分支全链路。
