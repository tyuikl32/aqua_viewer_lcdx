# Replace status.message passthrough with i18n keys

## Goal

消除所有把后端 `status.message` 或 HTTP 错误对象直接弹给用户的调用点，改为 i18n key。

## 诊断结论（2026-08-29 全量扫描）

审计报告估算「40 处透传 + 约 60 处硬编码 ≈ 100 处」，**实测远超**：用脚本逐行扫描 `src/app` 下全部 `.ts`，排除已合规的调用（`noticeError` / `noticeTranslated` / 直接传 `translate` 结果 / `translate.get().subscribe(res => notice(res))` 这类把翻译结果存在 `res`、`message` 变量的写法）后：

| 类别 | 处数 | 处理方式 |
|---|---|---|
| `notice(error)` / `notice(err)` / `notice(err.message, 'warning')` 等错误对象透传 | **123** | `noticeError()` |
| `notice(resp.status.message)` 等后端消息透传 | **31** | `noticeTranslated('<Page>.OperationFailed')` 或语义化 key |
| 硬编码字面量（英文/中文/模板串） | 106 | 见 `08-29-i18n-hardcode` |
| 模板 `placeholder` 硬编码 | 5 | `{{'Key' | translate}}` |

合计 **265 处**，分布在 40+ 个文件。

## 关键设计：为什么给 MessageService 加方法

逐个组件注入 `TranslateService` 需要改动 40+ 个文件的构造函数，成本高且易漏。改为在 `MessageService`（root 级单例，所有组件都已注入）内部注入 `TranslateService` 并新增两个方法：

```ts
noticeTranslated(key: string, color: 'danger' | 'warning' | 'success' = null, params?: object) {
  this.notice(this.translate.instant(key, params), color);
}

/// 通用失败提示，用于无法判断具体语义的错误回调
noticeError(color: 'danger' | 'warning' | 'success' = null) {
  this.noticeTranslated('Common.OperationFailed', color);
}
```

收益：调用点只需把 `notice(error)` 改成 `noticeError()`，无需触碰构造函数；带插值的模板串用 `noticeTranslated('Key', null, {id})` + 文案里 `{{id}}` 占位。

`TranslateService` 不依赖 `MessageService`，无循环依赖。

## Requirements

- 错误对象一律走 `noticeError()`，保留原有 color 参数（`'warning'` / `'danger'` 原样传递）
- 后端 `status.message` 一律改为 `noticeTranslated(...)`；语义可判定的用专属 key（如 `Maimai2.Setting.MergeRequestSuccess`），判定不了的用页面级 `OperationFailed`
- 同一操作的多个失败路径（else 分支 + error 回调）复用同一个 key，不为同一失败造两个 key
- 不改业务逻辑、控制流、样式参数

## Acceptance Criteria

- [x] 自有扫描脚本 `TOTAL VIOLATIONS: 0 across 0 files`（扫描规则排除已合规调用）
- [x] `npx tsc --noEmit -p tsconfig.app.json` 通过
- [x] zh.json / en.json flat key 集合完全一致，982/982
- [x] `npm run build-prod` 通过
- [x] 未改动被替换调用之外的业务逻辑

## Notes

- `keychip.component.ts` 保留了它原有的 `noticeTranslated` 私有辅助方法，现改为转发到 `messageService.noticeTranslated`，两种写法等价。
- 带插值的地方（好友 id、已复制文本、激活的兑换码名）用 ngx-translate 参数，文案里的 `{{id}}` / `{{text}}` / `{{name}}` 占位。
