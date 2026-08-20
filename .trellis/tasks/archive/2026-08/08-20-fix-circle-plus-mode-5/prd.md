# 恢复 0/4/10 模式并新增 CiRCLE PLUS 模式 5（前端）

## 背景

此前对机台控制模式的改动误删了原有模式 `0`（国服 2025）与 `10`（Splash PLUS），把选项错误地收敛为只有 `4` 和 `5`。本任务纠正该偏差。

## 需求

机台控制页面的 LC 模式选项必须同时包含四个值，顺序为 `0 / 4 / 5 / 10`：

| 模式 | 中文文案 | 英文文案 |
|------|---------|---------|
| 0   | 国服 (2025) | CN (2025) |
| 4   | CiRCLE PLUS | CiRCLE PLUS |
| 5   | CiRCLE PLUS | CiRCLE PLUS |
| 10  | Splash PLUS | Splash PLUS |

关键约束：

- 不删除原有模式 `0 / 4 / 10`，只新增 `5`。
- 模式 `4` 与 `5` 的展示文案都必须是 `CiRCLE PLUS`。
- 前端模式列表由 `LC_MODES` 常量驱动，模板与组件逻辑无需改动。

## 验收标准

1. `LC_MODES` 按顺序包含 `0 / 4 / 5 / 10`。
2. `zh.json` 含 `Mode0`、`Mode4`、`Mode5`、`Mode10`，其中 `Mode4` 与 `Mode5` 均为 `CiRCLE PLUS`。
3. `en.json` 含 `Mode0`、`Mode4`、`Mode5`、`Mode10`，其中 `Mode4` 与 `Mode5` 均为 `CiRCLE PLUS`。
4. `npm run build-prod` 通过。
5. `git diff --check` 无空白错误。