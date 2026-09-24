# i18n audit and key sync fixes

## Goal

审计汉化工作进度并完成 trivial 修复：zh/en key 同步修复 + 存量英文透传分类清单 + 修复优先级建议。

## Requirements

- **Trivial 修复（本次执行）**：
  - zh 多出的 6 个 key：`App.Sidebar.Circle` / `App.Sidebar.Festa` / `App.Sidebar.ServerMissions` / `Maimai2.FestaPage.Title` / `Maimai2.ServerMissions.Title` / `Ongeki.RecentPage.UnknownArtist` → 确认是 en 缺失则补齐
  - en 多出的 1 个 key：`Maimai2.CirclePage.DirectJoin` → 确认是 zh 缺失则补齐
  - 坏 key：`Ongeki.RecentPage.UnknownArtist `（尾随空格，en 侧）→ 修正
  - 修复前先确认对应 key 是否真的被组件引用（避免补错方向）
- **审计（只出清单不动代码）**：
  - status.message 透传清点（spec 记录约 40 处），按页面分类
  - 模板/组件中硬编码英文扫描（绕过 translate 的用户可见文案）
  - 修复优先级建议（P0 高频页面 / P1 低频 / P2 边缘）
- 遵循 spec：`.trellis/spec/frontend/quality-guidelines.md` → "User-facing messages must be localized"

## Acceptance Criteria

- [x] zh/en key 100% 同步（flat key 集合一致），尾随空格 key 修正
- [x] 修复涉及的组件引用核对（key 确实被使用）
- [x] 透传清单按页面分组 + 优先级标注
- [x] `npx tsc --noEmit -p tsconfig.app.json` 通过；zh.json/en.json JSON 解析通过
- [x] 结果写入 `{TASK_DIR}/research/i18n-audit.md`
