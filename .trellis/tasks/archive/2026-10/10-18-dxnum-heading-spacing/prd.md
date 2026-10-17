# dxnum 页面标题改用 page-heading 约定（UI 修复）

## Goal

修掉 `/mai2/dxnum` 标题与查询行挤在一起、以及标题装饰条跑到页面底部的问题。

## 现象（用户 2026-10-18 反馈 + 截图）

- 「机台人数查询」标题与下方查询输入框只隔约 8px（`card-title` 的 `margin-bottom: .5rem`）；
- 内容区左下角出现一小段橙色装饰条，位置不对。

## 根因

`Maimai2DxnumPage.tsx` 用了 `<div className="page-heading">` 包住整页 + `<h2 className="card-title">`，
而全仓其它 mai2 页面的约定是 `<h1 className="page-heading">标题</h1>`：

- `.page-heading { margin-bottom: 1.5rem !important }`（`globals.css:311`）—— 间距应该来自它；
- `.page-heading::after` 是标题下方的装饰条（1.2em × 4px，`globals.css:315`）—— 被套在外层 div 上时，
  伪元素排在整个内容之后，于是出现在页面底部（截图里那段橙色小条）；
- `.card-title { margin-bottom: .5rem }`（`bootstrap-compat.css:311`）只有 8px，所以挤。

## Requirements

1. 标题改为 `<h1 className="page-heading">{t('Maimai2.DxnumPage.Title')}</h1>`，外层 `div.page-heading` 改为 Fragment。
2. 不改动页面行为、i18n、类型与测试断言（`getByRole('heading', ...)` 对 h1 依旧成立）。
3. 不新增 CSS/类名（复用既有约定，避免主题特异性改造）。

## Acceptance Criteria

- [ ] `npm run build` 通过
- [ ] 定向 Playwright（dxnum + guards + permissions）保持全绿
- [ ] 探针实测：`.page-heading` 元素只有 1 个（标题本身），标题下沿到查询行上沿间距 ≈ 24px（1.5rem），页面底部不再有孤立装饰条
- [ ] 路径限定提交，不 push
