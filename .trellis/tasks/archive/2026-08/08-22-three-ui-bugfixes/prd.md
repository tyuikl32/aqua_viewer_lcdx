# Fix cabinets switch, remotecontrol alignment, merge cancel error toast

## Goal

修复三个用户上报的 UI/交互 bug（/mai2/cabinets 开关错位、/mai2/remotecontrol 列下沉、/mai2/setting 取消引继 404 提示）。

## 诊断结论（2026-08-22 静态核实）

1. **cabinets 开关盖住刷新按钮**：`maimai2-cabinets.component.html` 头部行中 `<div class="col-md-auto form-check form-switch ms-2">` 把网格列类与 form-check 容器类混在同一元素；Bootstrap 5.2 的 `.form-check-input` 依赖浮动 + 负 margin（`margin-left:-2.5em` 拉进 `padding-left`），在 grid 列上布局错位。
2. **remotecontrol 选指令后选择机台下沉**：表单行 `class="row g-2 align-items-end"`；指令列内 `@if (selectedCommandDef)` 的 `form-text` 提示出现后撑高该列，其余列底对齐 → 下沉。
3. **setting 取消引继提示「404 OK」**：后端端点 `POST lcdx/mergeRegistry/cancel/{userName}/{cardId}` 已存在于仓库（`e9efa48`，`IsOnRequest=false` 落库，幂等 92001）；**线上后端版本落后于 08-22 的后端提交**（EP-20 `permissions` 同样 404），故 404 是部署问题非代码缺失。前端问题：`cancelMergeRequest` 的 error 回调 `notice(error)` 直接弹原始 `HttpErrorResponse`（"OK" 是 HTTP 状态文本），违反本地化规则。
   - 「上次引继成功的日期」**后端 API 与前端展示均已存在**（GET 返回 `lastSuccessDate`，模板 109-110 行展示；值为默认 0001-01-01 时隐藏）——无需补 API。

## Requirements

- cabinets：开关与刷新按钮同行对齐、不重叠（网格列类与 form-check 分层：`col-md-auto` 列内嵌独立 `form-check form-switch` 容器）
- remotecontrol：切换指令出现/消失提示文字时，选择机台与参数列位置稳定不动
- setting：取消引继失败（含 404/网络错误）弹本地化失败文案（复用 `Maimai2.Setting.MergeCancelFailed`），不透传原始错误对象
- 不改后端代码（端点已存在，待部署）；不改无关页面

## Acceptance Criteria

- [x] cabinets 头部行静态复现（bootstrap 5.2.3 + 相同标记）中开关与按钮并排对齐、无重叠 —— 复现页 1a/1b 对照截图确认（1a 开关偏低错位 → 1b 对齐）；已应用同款标记
- [x] remotecontrol 行在有/无指令提示两种状态下其余列不位移 —— `align-items-end` → `align-items-start`；复现页 2a/2b 对照确认
- [x] setting 取消引继失败路径走 i18n 文案；成功路径行为不变 —— error 回调改弹 `Maimai2.Setting.MergeCancelFailed`，成功分支未动
- [x] `npx tsc --noEmit -p tsconfig.app.json` 通过；setting/cabinets/remote-control 相关 scoped 用例不回归 —— tsc exit 0；setting spec 1/1 SUCCESS（cabinets/remote-control 无 spec 文件）
- [x] zh/en key 无新增缺口（复用现有 key）—— 仅复用 `Maimai2.Setting.MergeCancelFailed`，未新增 key

## Notes

- 后端部署事项（不在本任务内）：线上 lcdxnet.am-allnet.com 后端需重新发布至 ≥ `e9efa48`，取消引继与 EP-20 系列端点即恢复；发布后取消引继语义 = `LCDXUserMergeRegistry.IsOnRequest` 置 false。
