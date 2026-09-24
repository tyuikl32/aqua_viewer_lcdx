# cabmode 页选项读库与文案格式化

## Goal

`/mai2/cabmode` LC 模式按钮改读 `lcdx/cabinet/modes`：按机台 Level 与 IsEnabled 过滤；长名按钮换行；当前模式显示 `代号（名称）`。

## Requirements

1. `ngOnInit` 拉取 `cabModes: {id, name, level}[]`；API 失败/空时回退 `LC_MODES`。
2. 可见选项：`info.level >= mode.level`（IsEnabled 已在后端过滤）。
3. 按钮文案 `formatModeButtonLabel`：显示宽度 > 16 时在最后一个空格换行（CJK 计 2）。
   - `舞萌DX 2026` → 一行
   - `maimai でらっくす PRiSM` → `maimai でらっくす` / `PRiSM`
4. 当前模式：`{{id}}（{{完整名}}）`；查不到名则仅代号。
5. CSS：`white-space: pre-line` + 按钮 max-width。

## Acceptance

- [ ] 选项来自 API 且按机台 level 过滤
- [ ] 长名两行、短名一行
- [ ] 当前模式含名称
- [ ] `npm run build-prod` 通过（或说明未跑）
