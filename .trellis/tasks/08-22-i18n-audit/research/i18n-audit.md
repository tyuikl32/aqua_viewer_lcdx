# i18n 汉化审计报告

审计日期：2026-08-22
范围：`aqua_viewer_lcdx/src`（i18n key 同步 + 透传清点 + 硬编码扫描）
规范依据：`.trellis/spec/frontend/quality-guidelines.md` → "User-facing messages must be localized"

---

## 一、Key 同步修复（本次已完成 ✅）

修复前 zh 841 / en 837，7 处不同步；修复后 **zh 842 = en 842，完全同步**，全部 key 无前后空白。

| # | Key | 问题 | 修复动作 |
|---|---|---|---|
| 1 | `App.Sidebar.Circle` | en 缺失（菜单服务 menu.service.ts:53 动态引用 `App.Sidebar.` + item.name） | en 补 "Circle" |
| 2 | `App.Sidebar.Festa` | en 缺失（menu.service.ts:59） | en 补 "Festa" |
| 3 | `App.Sidebar.ServerMissions` | en 缺失（menu.service.ts:65） | en 补 "Server Missions" |
| 4 | `Maimai2.FestaPage.Title` | en 缺失（maimai2-festa.component.html:1 引用） | en 补 "Festa" |
| 5 | `Maimai2.ServerMissions.Title` | en 缺失（maimai2-server-missions.component.html:1 引用） | en 补 "Server Missions" |
| 6 | `Ongeki.RecentPage.UnknownArtist` | en 侧 key 尾随空格 `"UnknownArtist "`，`ongeki-recent-item.component.html:19` 引用的是无空格版本 → 英文环境显示 key 原文 | en 修正 key 去空格 |
| 7 | `Maimai2.CirclePage.DirectJoin` | zh 缺失（当前无代码引用，预留 key） | zh 补 "直接加入" |

验证：`npx tsc --noEmit -p tsconfig.app.json` 退出码 0；两 JSON 解析有效；flat key 集合逐一下比对一致。

## 二、status.message 裸透传存量（40 处，未修）

后端 `status.message` 多为英文（如 "成功操作" 混中文也有），直接透传违反规范。按页面分类：

| 页面/组件 | 处数 | 备注 |
|---|---|---|
| keychip（机台管理） | 7 | P1 高频管理页 |
| cards | 6 | P1 高频用户页 |
| announcements + edit | 6 | P1；edit 组件当前不可达（走查 D1 断链） |
| maimai2-setting | 3 | P1；含 merge request 成功提示 "成功操作" 透传 |
| dashboard | 3 | P1 首页 |
| oauth-callback | 3 | P2；走主站 RinNET 链路 |
| admin | 1 | P1 管理页（warning） |
| netcode-bind / onetime-sign-in / user.service | 各 1 | P1/P2 |
| password-reset / profile / v2-rival-list / ongeki-rival-list / ongeki-card / sign-up | 各 1-2 | P2 |

修复优先级建议：P1 = keychip、cards、dashboard、maimai2-setting、admin（高频/管理页，约 20 处）；P2 = 其余低频页与 oauth-callback（跨站链路）。建议后续任务按页面分批走 `TranslateService` + zh/en 同步新增 key（样板：sign-in.component.ts）。

## 三、硬编码用户可见文案（非 i18n）

**组件 ts 内 notice() 硬编码英文：52 处**（分布 top：keychip 10、cards 6、v2-setting/v2-rating 各 4、maimai2-cabmode 3、v2-userbox/importer 各 3，其余 21 个文件 1-2 处）。

**硬编码中文：6 处**——admin 3 处、maimai2-setting 2 处（含 '请稍后' 表单占位与《个人信息保护法》提示）、maimai2-songlist 2 处。英文用户看中文，方向相反但同类违规。

**模板硬编码：4 处**——admin.component.html:324（placeholder="ExtId"）、edit.component.html:32（placeholder="Content"）、keychip.component.html:334（placeholder="KeychipId"）、v2-name-setting.html:7（placeholder="Username"）。

## 四、结论

- Key 层面 zh/en 已 100% 同步，英文环境的 Ongeki 游玩记录"未知艺术家"缺失与侧边栏三个菜单项缺失已修复。
- 存量债务两块：40 处 status.message 透传（spec 已记录为 tracked debt）+ 52 处 ts 硬编码英文 + 6 处硬编码中文 + 4 处模板硬编码。合计约 100 处，建议按 P1（keychip/cards/dashboard/maimai2-setting/admin，约 60 处）→ P2（低频页）分两批独立任务清理，单批改动面可控。
