# 调整 CiRCLE PLUS 机台模式选项

## Goal

将机台控制模式调整为 4 和 5 两个 CiRCLE PLUS 选项，并同步后端允许值。

## Requirements

- 机台控制页面只显示模式 `4` 和 `5` 两个选项。
- 模式 `4` 和 `5` 均显示为 `CiRCLE PLUS`，中英文文案一致。
- 后端 LC 模式白名单只允许 `4` 和 `5`，非法值提示同步更新。
- 不自动迁移数据库中已有的旧模式值。

## Acceptance Criteria

- [ ] 前端模式选项为 `4`、`5`，两项均显示 `CiRCLE PLUS`。
- [ ] 后端允许保存模式 `4`、`5`，拒绝其他模式。
- [ ] 前端生产构建、后端构建和测试通过。
- [ ] Trellis 任务完成归档，提交只包含本次相关改动。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
