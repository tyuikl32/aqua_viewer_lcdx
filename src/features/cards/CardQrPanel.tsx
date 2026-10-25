import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { fetchCardQr, type CardQrPayload } from '@/lib/api/cardQr';
import { isOk, StatusCode } from '@/lib/models';

/**
 * 机台登入二维码面板（NCBT 40 字符码），内联渲染。
 *
 * 硬约束：
 * - 二维码**固定白底黑块**，不跟随主题：应用默认 colorTheme='auto'，暗色下若让
 *   浅色模块画在深底上，机台的 ZXing 解码不保证能反色识别。
 * - payload 只存在于组件内存，卸载即销毁；不写 localStorage / URL / 查询缓存。
 * - 倒计时 540s 是后端可用时长下界（码按分钟对齐，生成于 HH:MM:SS 时最晚可用到
 *   HH:MM+9:59）；服务端给了绝对 `expiresAt` 时以它为准。
 * - 挂载即取码：本组件只出现在「玩家二维码」页，不需要二次点击。
 * - 关闭/离开页面时用 cancelled 守卫丢弃在途响应。
 */

const COUNTDOWN_SECONDS = 540;
const QR_SIZE = 320;
const COOLDOWN_MS = 10_000;

/** 后端返回码 → i18n key。 */
const ERROR_KEYS: Record<number, string> = {
  [StatusCode.BAD_REQUEST]: 'PlayerQrPage.Unsupported',
  [StatusCode.CARD_NOT_BELONG_TO_YOU]: 'PlayerQrPage.NotOwner',
  [StatusCode.CARD_QR_TOO_FREQUENT]: 'PlayerQrPage.TooFrequent',
  [StatusCode.INTERNAL_SERVER_ERROR]: 'PlayerQrPage.Unavailable',
};

function formatRemain(seconds: number): string {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * 剩余秒数。优先用服务端的绝对失效时刻 `expiresAt`（权威，已含请求耗时），
 * 缺失时回退 `expiresInSeconds`。
 *
 * 钳制到 [0, 540]：客户端时钟比服务器慢时不会显示「10:30」这种不存在的余量；
 * 快时立刻显示失效，而不是展示一个机台已拒收的码。
 */
function remainingSeconds(data: CardQrPayload): number {
  const clamp = (n: number) => Math.max(0, Math.min(COUNTDOWN_SECONDS, n));
  const target = data.expiresAt ? Date.parse(data.expiresAt) : Number.NaN;
  if (Number.isFinite(target)) {
    return clamp(Math.round((target - Date.now()) / 1000));
  }
  return clamp(data.expiresInSeconds || COUNTDOWN_SECONDS);
}

/**
 * 有效期内复用同一张卡已取回的码。
 *
 * 为什么必须有：`router.tsx` 的 auth 包装用 `Fragment key={user?.username}`，
 * 用户名从空变成实际值时整棵子树会**重挂载**，面板的 effect 因此会再发一次请求；
 * 4 秒内二次请求必然撞上后端 10 秒窗口（94032），把已经拿到的码替换成"操作太频繁"。
 * 缓存只在内存里、以服务端 expiresAt 为准，刷新页面即清空。
 */
const livePayloadCache = new Map<string, CardQrPayload>();

export function CardQrPanel({
  userName,
  cardId,
  fileName,
}: {
  /** 当前登录用户名（`/lcdx/cardQr/{user}` 的第一段）。 */
  userName: string;
  /** 主卡完整卡号。调用方需保证 `decodeGuofuCardId` 非 null。 */
  cardId: string;
  /** 保存图片时的文件名。 */
  fileName: string;
}) {
  const { t } = useTranslation();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [remain, setRemain] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // 10 秒刷新冷却：后端按窗口限流，冷却放在面板内即可（面板不会被关掉重开）
  useEffect(() => {
    if (cooldownUntil <= 0) {
      setCooldownLeft(0);
      return;
    }

    let timer = 0;
    const tick = () => {
      const left = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownLeft(left);
      if (left === 0) window.clearInterval(timer);
    };
    tick();
    timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const markSettled = useCallback((throttle: boolean) => {
    if (!throttle) return;
    setCooldownUntil(Date.now() + COOLDOWN_MS);
  }, []);

  useEffect(() => {
    if (!cardId || !userName) {
      return;
    }

    let cancelled = false;

    const renderPayload = async (payload: CardQrPayload): Promise<boolean> => {
      const url = await QRCode.toDataURL(payload.payload, {
        width: QR_SIZE,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#000000ff', light: '#ffffffff' },
      });
      if (cancelled) return false;
      setDataUrl(url);
      setRemain(remainingSeconds(payload));
      return true;
    };

    const cacheKey = `${userName}|${cardId}`;
    // 手动刷新（reloadToken > 0）必须真的打后端，不复用缓存
    const cached = reloadToken === 0 ? livePayloadCache.get(cacheKey) : undefined;

    setBusy(true);
    setErrorKey(null);

    void (async () => {
      try {
        if (cached && remainingSeconds(cached) > 0) {
          await renderPayload(cached);
          return;
        }

        setDataUrl(null);
        setRemain(0);

        const resp = await fetchCardQr(userName, cardId);
        if (cancelled) return;

        if (!isOk(resp)) {
          const code = resp?.status?.code ?? StatusCode.INTERNAL_SERVER_ERROR;

          // 撞上限流但手上还有未过期的码：继续用它，别把好好的码换成报错
          const fallback = livePayloadCache.get(cacheKey);
          if (code === StatusCode.CARD_QR_TOO_FREQUENT && fallback && remainingSeconds(fallback) > 0) {
            await renderPayload(fallback);
            return;
          }

          setErrorKey(ERROR_KEYS[code] ?? 'PlayerQrPage.RenderFailed');
          // 除「卡号不支持」外，请求都已占用后端 10 秒窗口
          markSettled(code !== StatusCode.BAD_REQUEST);
          return;
        }

        livePayloadCache.set(cacheKey, resp.data);
        await renderPayload(resp.data);
        markSettled(true);
      } catch {
        if (!cancelled) {
          setErrorKey('PlayerQrPage.RenderFailed');
        }
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cardId, userName, reloadToken, markSettled]);

  // 倒计时：每秒递减，归零即停止
  useEffect(() => {
    if (remain <= 0) {
      return;
    }

    const timer = window.setTimeout(() => setRemain((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remain]);

  const expired = remain <= 0;
  const showQr = Boolean(dataUrl) && !expired;

  // 占位文案只覆盖「没有二维码也没有错误」的状态：errorKey 存在时整块容器让位给
  // 具体原因，避免「生成失败」和「操作太频繁」同时出现。
  const placeholder = busy
    ? t('PlayerQrPage.Loading')
    : expired && dataUrl
      ? t('PlayerQrPage.Expired')
      : t('PlayerQrPage.RenderFailed');

  return (
    <div className="d-flex flex-column align-items-center">
      {errorKey ? (
        <div className="text-danger small text-center py-4">{t(errorKey)}</div>
      ) : (
        /* 白底容器是硬约束：暗色主题下也必须让码是深模块 + 白底 */
        <div
          className="bg-white d-flex align-items-center justify-content-center rounded"
          style={{ width: QR_SIZE + 24, height: QR_SIZE + 24 }}
        >
          {showQr && dataUrl ? (
            <img src={dataUrl} width={QR_SIZE} height={QR_SIZE} alt={t('PlayerQrPage.Title')} />
          ) : (
            <span className="text-secondary small">{placeholder}</span>
          )}
        </div>
      )}

      {showQr && (
        <div className="mt-2 font-monospace">
          {t('PlayerQrPage.Remaining', { time: formatRemain(remain) })}
        </div>
      )}

      <div className="alert alert-warning small mt-3 mb-2 w-100 text-center">
        <div className="fw-bold">{t('PlayerQrPage.WarningTitle')}</div>
        <div>{t('PlayerQrPage.WarningBody')}</div>
      </div>

      <div className="text-secondary small text-center">{t('PlayerQrPage.Hint')}</div>

      <div className="hstack gap-2 mt-3">
        <a
          className={'btn btn-outline-secondary btn-sm' + (showQr ? '' : ' disabled')}
          href={showQr && dataUrl ? dataUrl : undefined}
          download={fileName}
          aria-disabled={!showQr}
        >
          {t('PlayerQrPage.Save')}
        </a>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy || cooldownLeft > 0}
          onClick={() => setReloadToken((value) => value + 1)}
        >
          {cooldownLeft > 0
            ? t('PlayerQrPage.RefreshCooldown', { n: cooldownLeft })
            : t('PlayerQrPage.Refresh')}
        </button>
      </div>
    </div>
  );
}
