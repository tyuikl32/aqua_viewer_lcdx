# cabmode LC settings restore-default + 9-key trim

## Goal

/mai2/cabmode LC 功能设置卡：按 Xavior 2026-08-24 规格表加「恢复默认值」按钮，并把下拉从 19 项裁到 9 项（与后端 85a8bfd 同步）。

## Requirements

规格表（Xavior 原文）：
| key | 默认值处理 |
|-----|-----------|
| 跳过闭店 / bd / igam / ffesta | 框内可编辑数字 0 |
| event | 可编辑数字 25091800 |
| skipdlc / disfesta | 可编辑数字 1 |
| cam | 无默认值（恢复默认按钮禁用） |
| cc | 框内备注「格式(0,1)」，不可编辑 |
| 3456/chevent/ui/3456cn/hide/freekl/freekld/缓和1/缓和2/kldhope | 移除这条 |

- `LCSET_KEYS` 增加可选 `default`（恢复默认按钮填充值）与 `note`（只读提示）字段
- 恢复默认值按钮：`[disabled]="!lcsetKey || currentLcsetDefault === undefined"`；点击将输入框填为 default
- cc：placeholder 显示「格式(0,1)」且 `[readonly]`；**提交按钮同时禁用**（后端 lcset 无条件写库，只读框空值提交会把机台 CustomCameraConfig 清空）
- i18n：`Maimai2.CabinetControl.RestoreDefault`（zh 恢复默认值 / en Restore Default）
- filterLcsetKeys 逻辑不变（P≥4 全量 / P≤3 空）

## Acceptance Criteria

- [x] 下拉 9 项，与后端 CabinetPolicy.LcsetKeys 逐字一致
- [x] 数字默认项按钮可用并正确填入；cam 按钮禁用；cc 输入框 readonly 且提交禁用
- [x] ng build 零 error

## Notes

- commit: ea017a3
- 后端配套：LCDXNetApi 08-24-lcset-trim（85a8bfd）
