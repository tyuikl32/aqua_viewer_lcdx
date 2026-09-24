# 将全服游玩人数迁移到 Dashboard

## Goal

移除未登录首页的全服游玩人数展示，将轮询与卡片迁移到登录后的 dashboard 右侧栏，并完成构建审计。

## Requirements

- 未登录首页恢复原有品牌、登录入口和服务说明布局，不显示全服游玩人数。
- 登录后的 `/dashboard` 在现有右侧信息栏显示全服游玩人数卡片。
- 页面进入时立即请求 `lcdx/cabinet/global-players`，此后每 30 秒刷新一次。
- 页面销毁时清理刷新定时器。
- 沿用现有中英文文案和人员图标，不修改后端接口契约。

## Acceptance Criteria

- [ ] 首页不再请求或展示全服游玩人数。
- [ ] Dashboard 右侧“游戏数据”卡片下方展示全服游玩人数。
- [ ] 加载期间显示占位状态，成功后显示人数和统计窗口。
- [ ] 前端生产构建与 Git 空白检查通过。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
