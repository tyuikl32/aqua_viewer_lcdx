import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { BModal } from '@/components/shared/BModal';
import { fetchCardQr, type CardQrPayload } from '@/lib/api/cardQr';
import { isOk, StatusCode, type Card } from '@/lib/models';

/**
 * 机台登入二维码弹窗（NCBT 40 字符码）。
 *
 * 关键约束：
 * - 二维码**固定白底黑块**，不跟随主题：应用默认 colorTheme='auto'，暗色下若让
 *   浅色模块画在深底上，机台的 ZXing 解码不保证能反色识别。
 * - payload 只存在于组件内存，关闭即销毁；不写 localStorage / URL / 查询缓存。
 * - 倒计时 540s = 后端实际可用的最坏情况（码按分钟对齐，生成于 HH:MM:SS 时
 *   最晚可用到 HH:MM+9:59）。
 * - 关闭弹窗时用 cancelled 守卫丢弃在途响应。
 */

const COUNTDOWN_SECONDS = 540;
const QR_SIZE = 320;

/** 后端返回码 → i18n key。 */
const ERROR_KEYS: Record<number, string> = {
  [StatusCode.BAD_REQUEST]: 'CardsPage.QrUnsupported',
  [StatusCode.CARD_NOT_BELONG_TO_YOU]: 'CardsPage.QrNotOwner',
  [StatusCode.CARD_QR_TOO_FREQUENT]: 'CardsPage.QrTooFrequent',
  [StatusCode.INTERNAL_SERVER_ERROR]: 'CardsPage.QrUnavailable',
};

function formatRemain(seconds: number): string {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * 剩余秒数。优先用服务端的绝对失效时刻 `expiresAt`（权威，已含请求耗时），
 * 缺失时回退 `expiresInSeconds`——保证与尚未升级的后端也能配合。
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

export function CardQrModal({
  open,
  userName,
  card,
  cooldownLeft,
  onClose,
  onSettled,
}: {
  open: boolean;
  userName: string;
  card: Card | null;
  /** 页面级 10 秒冷却剩余秒数；>0 时刷新按钮禁用并显示倒计时。 */
  cooldownLeft: number;
  onClose: () => void;
  /** 请求落定后回传：页面据此维护「10 秒刷新冷却」。throttle=false 表示不占用后端窗口。 */
  onSettled: (at: number, throttle: boolean) => void;
}) {
  const { t } = useTranslation();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [remain, setRemain] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const cardLuid = card?.luid ?? '';

  useEffect(() => {
    if (!open || !cardLuid || !userName) {
      return;
    }

    let cancelled = false;
    setBusy(true);
    setErrorKey(null);
    setDataUrl(null);
    setRemain(0);

    void (async () => {
      try {
        const resp = await fetchCardQr(userName, cardLuid);
        if (cancelled) return;

        if (!isOk(resp)) {
          const code = resp?.status?.code ?? StatusCode.INTERNAL_SERVER_ERROR;
          setErrorKey(ERROR_KEYS[code] ?? 'CardsPage.QrRenderFailed');
          // 除「卡号不支持」外，请求都已占用后端 10 秒窗口
          onSettled(Date.now(), code !== StatusCode.BAD_REQUEST);
          return;
        }

        const url = await QRCode.toDataURL(resp.data.payload, {
          width: QR_SIZE,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: { dark: '#000000ff', light: '#ffffffff' },
        });
        if (cancelled) return;

        setDataUrl(url);
        setRemain(remainingSeconds(resp.data));
        onSettled(Date.now(), true);
      } catch {
        if (!cancelled) {
          setErrorKey('CardsPage.QrRenderFailed');
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
    // onSettled 由页面用 useCallback 稳定，不参与依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cardLuid, userName, reloadToken]);

  // 倒计时：每秒递减，归零即停止（图像与刷新入口随之切换）
  useEffect(() => {
    if (!open || remain <= 0) {
      return;
    }

    const timer = window.setTimeout(() => setRemain((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [open, remain]);

  const expired = remain <= 0;
  const showQr = Boolean(dataUrl) && !expired;

  const fileName = useMemo(() => `lcdx-login-qr-${card?.id ?? 0}.png`, [card?.id]);

  // 占位文案只覆盖「没有二维码也没有错误」的状态。errorKey 存在时整块容器让位给
  // 具体原因（见下方渲染），因此这里不再兜底出「生成失败」，避免两句话同时出现。
  const placeholder = busy
    ? t('CardsPage.QrLoading')
    : expired && dataUrl
      ? t('CardsPage.QrExpired')
      : t('CardsPage.QrRenderFailed');

  return (
    <BModal open={open} onClose={onClose} title={t('CardsPage.QrTitle')}>
      <div className="d-flex flex-column align-items-center">
        {errorKey ? (
          /*
           * 错误态与二维码容器**互斥**：两者同时渲染会让用户看到
           * 「生成失败，请刷新重试」紧挨着「操作太频繁」——而后者恰好把刷新按钮
           * 禁用了 10 秒，等于指引他做一件必然失败的事。
           */
          <div className="text-danger small text-center py-4">{t(errorKey)}</div>
        ) : (
          /* 白底容器是硬约束：暗色主题下也必须让码是深模块 + 白底 */
          <div
            className="bg-white d-flex align-items-center justify-content-center rounded"
            style={{ width: QR_SIZE + 24, height: QR_SIZE + 24 }}
          >
            {showQr && dataUrl ? (
              <img src={dataUrl} width={QR_SIZE} height={QR_SIZE} alt={t('CardsPage.QrTitle')} />
            ) : (
              <span className="text-secondary small">{placeholder}</span>
            )}
          </div>
        )}

        {showQr && (
          <div className="mt-2 font-monospace">
            {t('CardsPage.QrRemaining', { time: formatRemain(remain) })}
          </div>
        )}

        <div className="alert alert-warning small mt-3 mb-2 w-100 text-center">
          <div className="fw-bold">{t('CardsPage.QrWarningTitle')}</div>
          <div>{t('CardsPage.QrWarningBody')}</div>
        </div>

        <div className="text-secondary small text-center">{t('CardsPage.QrHint')}</div>

        <div className="hstack gap-2 mt-3">
          <a
            className={'btn btn-outline-secondary btn-sm' + (showQr ? '' : ' disabled')}
            href={showQr && dataUrl ? dataUrl : undefined}
            download={fileName}
            aria-disabled={!showQr}
          >
            {t('CardsPage.QrSave')}
          </a>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || cooldownLeft > 0}
            onClick={() => setReloadToken((value) => value + 1)}
          >
            {cooldownLeft > 0
              ? t('CardsPage.QrRefreshCooldown', { n: cooldownLeft })
              : t('CardsPage.QrRefresh')}
          </button>
        </div>
      </div>
    </BModal>
  );
}
