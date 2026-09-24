# Replace hardcoded user-facing strings with i18n keys

## Goal

清除代码与模板里硬编码的用户可见文案（英文 notice、中文 notice、模板 placeholder），全部改为 i18n key。

## 诊断结论（2026-08-29 全量扫描）

| 类别 | 处数 | 示例 |
|---|---|---|
| 组件 ts 内硬编码英文 | ~100 | `'Set default card failed.'`、`'Successfully changed'`、`'OK'`、`'No Data'` |
| 组件 ts 内硬编码中文 | 6+ | `'请填写完整的用户信息'`、`'根据《中华人民共和国个人信息保护法》，该功能已关闭'` |
| 模板 `placeholder` 硬编码 | 5 | `placeholder="ExtId"`、`placeholder="KeychipId"`（审计列 4 处，另发现紧邻同类 1 处） |

分布 top：keychip 24（已先期完成作为样板）、cards 12、admin 13、maimai2-setting 10、ongeki-rival-list 9、v2-rival-list 8、profile 7。

方向相反但同类违规的是硬编码中文：英文用户会看到中文提示。

## Requirements

- 硬编码英文/中文 notice → `messageService.noticeTranslated('Key')`（或组件内已有的 `noticeTranslated` 辅助）
- 模板 placeholder → `placeholder="{{'Key' | translate}}"`，与 `cards.component.html` 既有写法一致
- 专有名词（ExtId、Keychip ID、Username）作为 placeholder 时，zh 侧给出对应的中译或保留技术名，en 侧保留原文
- 不改业务逻辑

## Key 命名与新增

沿用在 `zh.json` 中已有的页面命名空间（`CardsPage.*`、`AdminPage.*`、`Maimai2.Setting.*`、`ChuniV2.*`、`Ongeki.*`、`ProfilePage.*`…）。本次新增 87 个 key（含透传任务共 92 个），新建命名空间 13 个：`AdminPage`、`AnnouncementsPage.Edit`、`ChuniV2.RivalListPage`、`ChuniV2.SettingPage`、`ImporterPage`、`Maimai2.DxPassPage`、`Maimai2.SongListPage`、`OAuthPage`、`OnetimeSignInPage`、`Ongeki.CardGalleryPage`、`Ongeki.CardPage`、`Ongeki.RivalListPage`、`PasswordResetPage`。

复用了已存在的 key，未重复造轮子：`SignInPage.LoginFailedMessage`、`Maimai2.LocksPage.OperationSuccess` / `OperationFailed`、`Common.OperationFailed`。

## Acceptance Criteria

- [x] 扫描脚本 `TOTAL VIOLATIONS: 0 across 0 files`
- [x] 5 处模板 placeholder 改为 `{{'Key' | translate}}`
- [x] zh.json / en.json 982/982 完全同步，无空白 key
- [x] `npx tsc --noEmit -p tsconfig.app.json` 通过
- [x] `npm run build-prod` 通过

## Notes

- JSON 采用「读取 → 插入 → `json.dumps(indent=2, ensure_ascii=False)` 写回」的方式批量新增 key；已验证 zh.json 无损往返，en.json 仅末尾换行差异（脚本保持原样）。
- 少量兜底文案（各处 `OperationFailed`）语义偏通用，若后续需要更精确的提示，可在对应页面替换为专属 key。
