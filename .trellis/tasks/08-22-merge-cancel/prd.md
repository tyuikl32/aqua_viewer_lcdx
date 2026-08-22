# Cancel merge request + show dates on setting page

## Goal

`/mai2/setting` 页「国服数据引继」卡片：
1. 已设置引继时，「已设置」按钮变为「取消引继」，点击后操作数据库取消
2. 显示「上次请求引继的日期」和「上次成功的日期」（数据库 `LCDXUserMergeRegistry.LastRequestDate` / `LastSuccessDate`，GET 端点已返回这两字段，前端只需展示）
3. i18n 同步（zh/en 同加 key）

## Design（已与用户走口头确认的需求原文）

- 后端新增：
  - `IUserService.CancelMergeByCardId(string cardId)` → `UserService` 实现：卡号→userId（复用 TryConvertCardIdToUserId）→ 查 registry → `IsOnRequest=false` + SaveAsync；无记录或已不在请求态时返回 92001 + 提示"无进行中的引继请求"语义（幂等）
  - Controller `POST lcdx/mergeRegistry/cancel/{userName}/{cardId}`（沿用同文件鉴权模式：CheckTokenAsync(userName, token)，与 request 端点一致）
- Repository 无新增需求：`GetByUserIdAsync` + 基类 `SaveAsync` 够用
- 前端 `maimai2-setting`：
  - 组件状态：`mergeLastRequestDate` / `mergeLastSuccessDate`（loadMergeRequestStatus 从 GET 响应读取）
  - 按钮逻辑：`mergeRequested===true` 时按钮文案=取消引继、点击走 cancelMergeRequest()（带 confirm）；否则原请求逻辑
  - 卡片内展示两行日期（有值才显示；值为后端默认 0001-01-01 时视为无记录不显示）
  - 所有新文案走 `Maimai2.Setting.*` i18n key，zh/en 同步
- 副标题「提交后无法在网页端取消」不再成立 → 更新文案

## Acceptance Criteria

- [ ] 后端 `dotnet build` 通过（如本机有 SDK；否则至少接口/实现/控制器语法自洽）
- [ ] 前端 `npx tsc --noEmit -p tsconfig.app.json` 通过
- [ ] zh/en key 同步（flat key 集合一致）
- [ ] 未设置→点设置→显示已设置+可取消→取消后按钮恢复「设置引继」的状态流转在代码层面自洽
