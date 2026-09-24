# 404 page redesign (retroactive archive)

## Goal

404 页面重设计：以 Bootstrap 卡片布局替换原海龟拼贴风格（Xavior 2026-08-23 需求，当次会话遗漏 trellis 归档，2026-08-24 补档）。

## Requirements

- 卡片布局：nf-eyebrow 小标 + display-3「404」+ 黄色下划线 + MISS 徽章 + nf-log 终端日志块（闪烁光标动画）
- i18n 顶层 `NotFound` 命名空间（Title/Eyebrow/Line1/Line2/EnglishLine/Home/Back）；曾误嵌套在 `App` 内导致模板键路径不匹配显示原始键，已修正为顶层
- 「返回首页」-> `https://lcdxnet.am-allnet.com`；「返回上一页」仅当存在 referrer 时显示（`document.referrer`）
- 移除页首「页面未找到」标题
- 应用壳提供 navbar/footer，页面不重复引入

## Acceptance Criteria

- [x] 构建/深浅色模式正常，键均翻译（zh/en）
- [x] 仅改 not-found 组件四件套 + 两个 i18n 文件，零其他文件改动

## Notes

- commits（2026-08-23 实际完成）：7c15179（重设计）、35027f6（i18n 顶层修正）、78805ed（移除页首标题）
- 后续 spec 编译错误（TranslateModule v18）由 08-24-spec-repairs（43c15cd）修复
- 预览产物：项目根 `E:\ALL.Net\Project_LCDX_NET\404-preview.html`
