# 技术设计 · 卡片页机台登入二维码（前端）

## 1. 组件与数据流

```
CardsPage
  ├─ 每张主卡：isNcbtEligible(luid) ? <button onClick=openQr(card)> : null
  └─ <CardQrModal open cardLuid onClose />
        ├─ useEffect(open) → lcdx.post('lcdx/cardQr/{user}', { cardId })
        │     └─ 200 → QRCode.toDataURL(payload, …) → <img> + 540s 倒计时
        │     └─ 94032 → 提示并进入冷却
        │     └─ 其他 → 对应文案
        └─ 关闭 → 清 payload/dataUrl/倒计时，置 cancelled
```

`lcdx` 客户端已具备 Authorization、401 单飞刷新与错误映射（`src/lib/api/client.ts`），无需新建请求层。

## 2. 卡号判定扩展

`src/lib/guofuCard.ts` 现状只实现新码：

```ts
const GUOFU_CARD_PREFIX = '2430443067';
const GUOFU_CARD_ENCODE_MULTIPLIER = 83;
const GUOFU_CARD_ENCODE_OFFSET = 4579;
```

改为：

```ts
const LEGACY_CARD_PREFIX = '243044306799';
const MIN_CLIENT_ID = 10_000_000;
const MAX_CLIENT_ID_EXCLUSIVE = 20_000_000;

export function decodeGuofuCardId(card: string | null | undefined): number | null {
  const value = card ?? '';
  if (value.length !== 20 || !/^\d+$/.test(value)) return null;
  if (!value.startsWith(GUOFU_CARD_PREFIX)) return null;

  const discriminator = value[GUOFU_CARD_PREFIX.length];

  let id: number | null = null;
  if (discriminator === '9') {
    if (value.startsWith(LEGACY_CARD_PREFIX)) id = Number(value.slice(LEGACY_CARD_PREFIX.length));
  } else if (discriminator === '0' || discriminator === '1') {
    const suffix = Number(value.slice(GUOFU_CARD_PREFIX.length));
    if (Number.isSafeInteger(suffix)) {
      const raw = suffix - GUOFU_CARD_ENCODE_OFFSET;
      if (raw >= 0 && raw % GUOFU_CARD_ENCODE_MULTIPLIER === 0) id = raw / GUOFU_CARD_ENCODE_MULTIPLIER;
    }
  }

  if (id === null || id < MIN_CLIENT_ID || id >= MAX_CLIENT_ID_EXCLUSIVE) return null;
  return id;
}

export function isGuofuCardNumber(card: string | null | undefined): boolean {
  return decodeGuofuCardId(card) !== null;
}
```

调用点：
- `Maimai2SettingPage` 的引继门控（自动获得旧码支持）
- `CardsPage` 的二维码按钮可见性

## 3. 二维码渲染

`qrcode` 已在依赖中（`ProfilePage` 的 TOTP 已用）。

```ts
QRCode.toDataURL(payload, {
  width: 320,
  margin: 2,
  errorCorrectionLevel: 'H',
  color: { dark: '#000000', light: '#ffffff' },
});
```

**白底是硬约束**：外层再套一层 `bg-white` 容器，避免浮层背景透出。

## 4. 状态机

```
idle ──open──▶ loading ──92001──▶ ready(540s) ──倒计时归零──▶ expired
                   │                   │
                   ├─94001/94031──▶ error（可重试）
                   └─94032───────▶ cooldown(≤10s，显示剩余)
```

页面级冷却：

```ts
const [cooldownUntil, setCooldownUntil] = useState(0); // Date.now() 基准
```

弹窗把「生成成功时刻」回传给页面，由页面维护冷却终点；`openQr` 前先看是否仍在冷却。

## 5. 弹窗结构

```
BModal(title=机台登入二维码)
  <div className="d-flex justify-content-center bg-white p-3 rounded">
    <img src={dataUrl} width={320} height={320} alt="login qr" />
  </div>
  <div className="text-center mt-2">{剩余 mm:ss}</div>
  <div className="alert alert-warning small">
    为了您的账号安全<br/>请勿传播此二维码
  </div>
  <div className="text-secondary small">对准机台上的扫码区，10 分钟内有效</div>
  footer: [保存图片] [刷新]
```

## 6. 错误码与文案映射

| status.code | 文案 key |
|---|---|
| 92001 | — |
| 94001 | `CardsPage.QrUnsupported` |
| 94031 | `CardsPage.QrNotOwner` |
| 94032 | `CardsPage.QrTooFrequent` |
| 95001 | `CardsPage.QrUnavailable` |
| 其他 | `CardsPage.QrRenderFailed` / `Common.OperationFailed` |

需在 `src/lib/models.ts` 的 `StatusCode` 中补 `CARD_QR_TOO_FREQUENT = 94032`（`CARD_NOT_BELONG_TO_YOU = 94031`、`INTERNAL_SERVER_ERROR = 95001` 已存在）。

## 7. 竞态与生命周期

```ts
useEffect(() => {
  if (!open) return;
  let cancelled = false;
  void generate().then(v => { if (!cancelled) apply(v); });
  return () => { cancelled = true; };
}, [open, cardLuid]);
```

关闭时清空 `payload` / `dataUrl` / `remain`，不写任何持久化。

## 8. 兼容性

- 后端未部署时端点 404 → `lcdx.post` 抛错 → 弹窗显示「操作失败」，不会崩溃。
- 旧码放宽对既有新码用户无影响。
- 引继入口对旧码放开后，若后端未同步部署会回到「能点必失败」——因此**后端必须先上线**（发布顺序写入 implement.md）。
