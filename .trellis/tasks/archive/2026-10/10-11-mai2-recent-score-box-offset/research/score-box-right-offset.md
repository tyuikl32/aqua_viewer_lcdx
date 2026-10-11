# 排查记录：recent 卡片 DX score 框右侧留白

日期：2026-10-11
方式：离线 Playwright 几何测量（`.artifacts/probe-score-box.mjs`，view 1366×900，liquefy 主题）

## 1. 环境与复现方式

离线探针复刻了 `tests/lcdx-regression/fixture.ts` 的约定：

- `localStorage`: `currentAccount`(Bearer) / `currentUser` / `lang=en` / `dbVersion=1`
- 路由 mock：`/api/user/me`、`/api/game/maimai2/data/musicList`、`/api/game/maimai2/recent`、
  `/api/static/dbVersion`（**必须带 `state:'success'`**，否则 `checkDbUpdate()` 不会走 `loadAll()` 分支、
  `preloadStates.maimai2Music` 永远不为 `OK`、页面不渲染记录 —— 这是搭探针时踩到的第一个坑）
- 非 `127.0.0.1:5187` 的请求一律 abort（图片因此加载失败，不影响几何测量）

造的数据刻意对齐用户截图：`deluxscore=3058`、`totalCombo=1125`（理论值 `1125*3=3375`），
比值 0.906 → `dxScoreStar` 命中 ⭐⭐。

## 2. 原始测量输出

```json
{
  "themeAttr": "liquefy",
  "colorScheme": "light",
  "card": { "left": 327.1875, "right": 1306, "width": 978.8125,
            "paddingLeft": "0px", "paddingRight": "0px",
            "borderRadius": "20px", "borderRight": 1 },
  "row":  { "right": 1317, "marginRight": "-12px", "gutterX": "1.5rem" },
  "leftCol":  { "paddingLeft": "12px", "left": 316.1875 },
  "rightCol": { "right": 1317, "paddingRight": "12px", "paddingLeft": "12px" },
  "scoreContainer": { "right": 1305, "width": 80.53125 },
  "scoreSpans": [
    { "text": "3058/3375", "right": 1301, "marginRight": "4px" },
    { "text": "⭐⭐",      "right": 1301, "marginRight": "4px" }
  ],
  "firstIcon": { "left": 336.1875, "marginLeft": "8px" },
  "derived": {
    "cardInnerRight": 1305,
    "cardInnerLeft": 328.1875,
    "gap_span_to_cardInnerRight": 4,
    "gap_icon_to_cardInnerLeft": 8,
    "rowOverflowRight": 12
  }
}
```

## 3. 数据解读

### 3.1 `.row` 是「零和」的

- `.row` 右边界 1317 = 卡片内边缘 1305 + **12px**（负 gutter）
- 右列 `.col-auto` padding-right = **12px**
- 12 − 12 = **0**

即：Bootstrap 的 `.row`/`.row > *` 组合在这里**不产生任何容器内边距**，
它只是把内容重新对齐回卡片边缘。视觉上「容器没留白」并不是 row 造成的，
而是**没有任何一层提供水平内边距**。

### 3.2 右侧的实际留白 = 4px

`scoreContainer.right = 1305`（正好等于卡片内边缘），
内部 span 再靠自身 `mx-1` 内缩 **4px** → 文本右缘 1301。

**`mx-1` 是右侧唯一且全部的留白来源。**

### 3.3 左右不对称

| 侧 | 元素 | 留白 | 来源 |
|---|---|---|---|
| 左 | 图标（`clear.webp`） | **8px** | `.ms-2` = 0.5rem |
| 右 | score 文本 | **4px** | `.mx-1` = 0.25rem |

左右差 2 倍，这是「看起来偏右」的直接机理解释。

### 3.4 圆角放大了视觉

内层卡片 `border-radius: 20px`。4px 的留白完全落在圆弧内侧，
文字基线视觉上直接「切」在圆角边缘 —— 这解释了为什么该问题在 liquefy 主题下格外明显。

## 4. 反证实验

在页面内把两个 span 的 `margin-right` 改为 `1rem`：

```
AFTER marginRight=1rem(!important) → {"gap_span_to_cardInnerRight":16}
```

- 留白从 4px → **16px**，且只有右侧变化 → 证实 `mx-1` 就是唯一控制因子。
- 注意：**必须用 `!important`**。Bootstrap 的 `.mx-1` 是 `margin-right: .25rem !important`，
  内联 `style.marginRight` 会被静默忽略（第一次尝试时留白纹丝不动，正是此因）。

对照截图：`.artifacts/score-box-card.png`（4px 现状） vs `.artifacts/score-box-card-fixed.png`（16px）。

## 5. 归属判定

| 对照对象 | 结果 |
|---|---|
| upstream `main` 的 `Maimai2RecentPage.css` | **零差异** |
| upstream `main` 的 `Maimai2RecentPage.tsx` | 差异仅 3 处：`assetsHost`→`maiAssetsHost`、错误提示本地化、`vsRank === 0`→`=== 1`；**布局 markup 完全未动** |
| `legacy-angular` 的 `maimai2-recent.component.html` | 同样是 `.card.bg-secondary-subtle > .row > .col-auto > .dx-score-container` 结构，`mx-1` 也一致 |

**结论：该偏移是上游 React 版固有（其 Angular 前身同样如此），非本地移植引入。**
差异只在于当前 liquefy 主题的卡片圆角更大（20px），把原本不明显的 4px 留白放大成了视觉缺陷。

## 6. 修复后的复测（方案 A：`px-3`）

在 `div.card.bg-secondary-subtle` 上加 `px-3`（1rem 水平内边距）后，同一探针复测：

```json
"row":  { "right": 1301, "marginRight": "-12px" },
"scoreSpans": [ { "text": "3058/3375", "right": 1285, "marginRight": "4px" } ],
"firstIcon": { "left": 352.1875, "marginLeft": "8px" },
"derived": {
  "cardInnerRight": 1305,
  "cardInnerLeft": 328.1875,
  "gap_span_to_cardInnerRight": 20,
  "gap_icon_to_cardInnerLeft": 24,
  "rowOverflowRight": -4
}
DARK re-check → {"colorScheme":"dark","gap_span_to_cardInnerRight":20,"paddingRight":"16px"}
```

| 指标 | 改前 | 改后 |
|---|---|---|
| 右侧留白 | 4px | **20px** |
| 左侧留白 | 8px | **24px** |
| `.row` 相对卡片内缘 | 溢出 +12px | **−4px**（回到内侧，不出界） |

推导与实测一致：`px-3` = 16px，经 −12px 负 gutter 与 +12px 列 padding 相消后净增 16px，
故右侧 4+16 = 20px、左侧 8+16 = 24px。

**为什么 `px-3` 而不是 `px-2`**：`px-3`(1rem) 与 Bootstrap `.card-body` 的默认水平内边距一致；
`px-2`(0.5rem) 只会得到 12/16px，离 20px 圆角仍偏近。

## 7. 备注 / 待决

- 修复已按方案 A（`px-3`）实施并复测通过，见第 6 节与 `prd.md` 的「实施与验证」。
- 探针脚本可改造为回归测试（断言 `gap_span_to_cardInnerRight >= 16`），但现有回归套件不覆盖
  `/mai2/recent`，需要先为该页补 fixture（mock `api/game/maimai2/data/musicList` 使
  `preloadStates.maimai2Music` 到达 `OK`）。
