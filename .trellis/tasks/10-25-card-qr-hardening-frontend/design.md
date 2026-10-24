# 设计 · 机台登入二维码加固（前端）

## 1. 错误态：用结构消除双消息（R1/R2）

现状是两个互不知情的分支同时命中：

```tsx
<div className="bg-white ...">
  {showQr && dataUrl ? <img/> : <span>{busy ? loading : expired && dataUrl ? expired : renderFailed}</span>}
</div>
{errorKey && <div className="text-danger">{t(errorKey)}</div>}   // ← 第二个分支也渲染
```

出错时 `dataUrl` 为 null，`expired && dataUrl` 恒假 → 落到 `QrRenderFailed`；随后
`errorKey` 再渲染一次。**只改条件判断是治标的**（白框里仍留一条通用文案）。

**改法：错误态整块替换掉二维码容器**，让两条消息在结构上不可能共存。

```tsx
{errorKey ? (
  <div className="text-danger small text-center py-4">{t(errorKey)}</div>
) : (
  <div className="bg-white d-flex align-items-center justify-content-center rounded"
       style={{ width: QR_SIZE + 24, height: QR_SIZE + 24 }}>
    {showQr && dataUrl ? <img ... /> : <span className="text-secondary small">{placeholder}</span>}
  </div>
)}
```

其中 `placeholder` 只保留三种状态：`busy` → 生成中；`expired && dataUrl` → 已失效；
其余 → `QrRenderFailed`（真正异常路径，例如渲染抛错）。

好处：

- 一个状态只出一个文案，没有"先通用后具体"的层级需要维护；
- 淡色/白色大空方块不会在错误态出现（原本错误态会留一个 344×344 的空白白框）；
- 重试时 effect 开头 `setErrorKey(null)` 会把容器带回来，无需额外状态。

`QrRenderFailed` 文案改为不承诺动作：`二维码生成失败。` / `Failed to generate the QR code.`
（94032 时刷新按钮本身被禁用，原「请刷新重试」是错误指引。）

## 2. 文案与倒计时对齐（R4）

`540` 是**正确**的（机台按分钟对齐、回看 10 个分钟 IV，最坏 9:00），不能改成 600。
要改的是文案——它写死了「10 分钟」，却紧挨着「09:00 剩余」。

| key | 旧 | 新 |
|---|---|---|
| `QrHint` zh | 把手机屏幕对准机台上的扫码区，10 分钟内有效。 | 把手机屏幕对准机台上的扫码区，倒计时结束前有效。 |
| `QrHint` en | Aim your screen at the cabinet scanner. Valid for 10 minutes. | Aim your screen at the cabinet scanner before the countdown ends. |

去掉具体数字，两处不再互相矛盾，也不需要将来随实现漂移。

## 3. 倒计时以服务端绝对时刻为准（R6）

后端新增 `expiresAt`（ISO 8601 带偏移）。前端优先用它，缺失时回退，**保证四种组合都能跑**：

| 后端 | 前端 | 表现 |
|---|---|---|
| 有 `expiresAt` | 新 | 按绝对时刻（本次目标） |
| 无 `expiresAt` | 新 | 回退 `expiresInSeconds`（前端先上也不炸） |
| 有 `expiresAt` | 旧 | 忽略未知字段，只用 `expiresInSeconds` |
| 无 | 旧 | 现状 |

```ts
function remainingSeconds(data: CardQrPayload): number {
  const clamp = (n: number) => Math.max(0, Math.min(COUNTDOWN_SECONDS, n));
  const target = data.expiresAt ? Date.parse(data.expiresAt) : NaN;
  if (Number.isFinite(target)) return clamp(Math.round((target - Date.now()) / 1000));
  return clamp(data.expiresInSeconds || COUNTDOWN_SECONDS);
}
```

- `clamp` 上界 `540`：客户端时钟慢于服务器时不显示「10:30」这种不存在的余量。
- 下界 `0`：时钟快于服务器时立刻显示失效，而不是显示一个已被机台拒绝的码。
- 不走 `expiresInSeconds` 的 `||` 短路误判（`0` 是合法但无意义的值，统一走 `||` 兜底即可）。

## 4. 暗色主题的自动化断言（R5）

不截图比对（要维护基线图、字体渲染有差异）。直接**读渲染结果**：

1. 断言 `html[data-color-scheme=dark]`（确认确实在暗色）；
2. 断言二维码容器的 `getComputedStyle().backgroundColor === 'rgb(255, 255, 255)'`；
3. 把 `<img>` 的 `data:image/png` 解成 `ImageBitmap`，用 `OffscreenCanvas` 取 `getImageData`，
   统计亮度直方图：
   - `mid`（8 < L < 247）占比 < 2% —— 有任何主题染色或半透明叠加都会让这个值飙起来；
   - `minL <= 8` 且 `maxL >= 247` —— 确认纯黑纯白两端都在。

为什么这条值得写：唯一的失败模式是有人把 `bg-white` 换成 `bg-body`/`bg-light`，
或给 `img` 加了 `filter`/`opacity`。那时代码看起来完全正常，只有机台 ZXing 会静默扫不出。

覆盖 `legacy` 与 `liquefy` 两个主题族（`animal-island` 有全局光标类与更多覆盖，成本高、
收益低，暂不纳入；如需可后续追加一行）。

## 5. 测试改动

`tests/lcdx-regression/cards-qr.spec.ts`：

| 用例 | 断言 |
|---|---|
| 现有 4 条错误/成功用例 | 不动 |
| `error states never show the generic failure copy`（新，参数化 4 种码） | 具体文案 `count === 1` 且通用文案 `count === 0` |
| `QR stays black-on-white in <family> dark theme`（新，2 族） | 见 §4 |
| `countdown follows the server expiresAt when present`（新） | mock `expiresAt = now+120s` → 显示 `02:00` 左右 |

参数化 4 种错误码直接复用现有 `page.route` 手法，不引入新 fixture。

## 6. 风险与回滚

| 风险 | 缓解 |
|---|---|
| 像素断言在某些 GPU/字体后端上抖动 | 只断言「中间调占比 < 2%」与两端极值，不断言具体占比数字 |
| `expiresAt` 时区解析在 Safari 上偏差 | 后端输出带 `zzz` 偏移，`Date.parse` 对各浏览器均按 ISO 处理 |
| 错误态不再渲染白框，视觉上有人觉得"跳" | 错误态本就不该展示二维码容器；文案在原位置居中 |
| 单测/回归脚本依赖旧文案 | 已确认 `cards-qr.spec.ts` 未引用 `QrRenderFailed` / `QrHint` |

回滚：单 commit revert，改动集中在 `CardQrModal.tsx` + 两个 i18n 文件 + 一个 spec。
