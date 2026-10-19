# dxnum 外部入口的前端配套（操作记录筛选 + 时间字段类型）

> 轻量任务（PRD-only）。2 个文件、纯加法式，无组件逻辑改动。

## Goal

为后端「dxnum 外部入口」补两处前端配套：① 操作记录页的 action 筛选能选中新来源 `dxnum-token-query`；② 类型定义跟上后端新增的时间字段。**不改任何页面运行逻辑。**

## Background

- 配套后端任务（工作区根下另一仓库）：`LCDXNetApi/.trellis/tasks/10-19-dxnum-external-token`。
- 后端新增端点 `GET /lcdx/cabinet/dxnum`（专用 `X-Api-Token` 鉴权），每次查询审计写 `action=dxnum-token-query`。
- 后端响应**加法式**新增：`data.snapshotTime`、四窗 `from`/`to`、`recentPlayers[].lastPlayDate`。
- 该端点由外部系统（QQ bot）直接调用，**不经过前端**；前端只需让审计记录可读、类型不落后。

## Requirements

- **R1** `src/features/mai2/Maimai2LocksPage.tsx` 的 `ACTIONS` 数组追加 `'dxnum-token-query'`，使筛选下拉可选、选中后请求带 `action=dxnum-token-query`（后端 `:686` 是通用字符串比较，无需后端配合）。
- **R2** `src/features/mai2/cabinet-models.ts` 补可选字段：`PlayerWindow.from?` / `PlayerWindow.to?`、`PlayerPlayCount.lastPlayDate?`、`CabinetDxnumResult.snapshotTime?`。
- **R3** 新字段一律**可选**（`?`）——不得把既有对象字面量变成类型错误。
- **R4** 不改任何组件渲染逻辑、不改请求路径、不新增页面。

## Acceptance Criteria

- [ ] 操作记录页 action 下拉出现 `dxnum-token-query`
- [ ] `PlayerWindow` / `PlayerPlayCount` / `CabinetDxnumResult` 的新字段均为可选
- [ ] `Maimai2DxnumPage.tsx` 中 `items.reduce<PlayerWindow>(…, { players: 0, plays: 0 })` 等既有字面量**不报错**
- [ ] TypeScript 类型检查通过（`tsc -b` 阶段）
- [ ] 无运行期行为变化（既有 e2e 拦截 fixture 不受影响）

## Out of Scope

- 展示新增时间字段（本期只补类型，不做 UI）
- 新的查询页面或新的接口调用

## Notes

- 后端当前状态：生产配置已写入，二进制待部署。前端这两处**不影响** bot 调用接口，只影响审计页可读性与类型准确性。
- 时间字段语义见后端 `README.dxnum-external-api.md`（`snapshotTime` 是数据口径时刻，与信封 `time` 不同）。
