# cabinets players daily window column

## Goal

/mai2/cabinets 上机人数卡展示「当日人数」（Xavior 2026-08-24 需求：目前仅有 2 小时窗口）。

## Requirements

- `CabinetPlayers` 接口新增 `today: PlayerWindow`（对应后端 ef3161d 新增的 Today 字段，camelCase）
- 人数卡 3 列（col-4）改 4 列（col-3），顺序：今日 / 30 分钟 / 1 小时 / 2 小时
- i18n：`Maimai2.Cabinets.Today`（zh 今日 / en Today）
- 其余（正在游玩列表、自动刷新、在玩去重）不动

## Acceptance Criteria

- [x] 人数卡第一列为今日人数（含人次括号），与后端当日 0 点起窗口一致
- [x] ng build 零 error

## Notes

- commit: ee82e7f
- 后端配套：LCDXNetApi 08-24-cabinet-daily-window（ef3161d，含 2 个时钟无关测试）
