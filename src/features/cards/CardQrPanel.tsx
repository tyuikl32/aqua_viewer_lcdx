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
 *
 * **点击生成，不在挂载时自动取码**：
 * 路由的 auth 包装用 `Fragment key={username}`，用户名到达时整棵子树会重挂载；
 * 若挂载即取码，一次进入会发两次请求，第二次必然撞上后端 10 秒窗口返回 94032，
 * 把已经拿到的码替换成"操作太频繁"。改为用户显式点击后，请求次数完全可预测。
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
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // 10 秒刷新冷却：后端按窗口限流，冷却放在面板内
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

  // 倒计时：每秒递减，归零即停止
  useEffect(() => {
    if (remain <= 0) {
      return;
    }

    const timer = window.setTimeout(() => setRemain((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remain]);

  const generate = useCallback(async () => {
    if (busy || cooldownLeft > 0 || !userName || !cardId) {
      return;
    }

    setBusy(true);
    setErrorKey(null);

    try {
      const resp = await fetchCardQr(userName, cardId);

      if (!isOk(resp)) {
        const code = resp?.status?.code ?? StatusCode.INTERNAL_SERVER_ERROR;
        setErrorKey(ERROR_KEYS[code] ?? 'PlayerQrPage.RenderFailed');
        // 除「卡号不支持」外，请求都已占用后端 10 秒窗口
        if (code !== StatusCode.BAD_REQUEST) {
          setCooldownUntil(Date.now() + COOLDOWN_MS);
        }
        return;
      }

      const url = await QRCode.toDataURL(resp.data.payload, {
        width: QR_SIZE,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#000000ff', light: '#ffffffff' },
      });

      setDataUrl(url);
      setRemain(remainingSeconds(resp.data));
      setCooldownUntil(Date.now() + COOLDOWN_MS);
    } catch {
      setErrorKey('PlayerQrPage.RenderFailed');
    } finally {
      setBusy(false);
    }
  }, [busy, cooldownLeft, userName, cardId]);

  const expired = remain <= 0;
  const showQr = Boolean(dataUrl) && !expired;
  const idle = !dataUrl && !errorKey && !busy;

  // 占位文案只覆盖「没有二维码也没有错误」的状态：errorKey 存在时整块容器让位给
  // 具体原因，避免「生成失败」和「操作太频繁」同时出现。
  const placeholder = busy
    ? t('PlayerQrPage.Loading')
    : expired && dataUrl
      ? t('PlayerQrPage.Expired')
      : t('PlayerQrPage.RenderFailed');

  const refreshLabel =
    cooldownLeft > 0
      ? t('PlayerQrPage.RefreshCooldown', { n: cooldownLeft })
      : busy
        ? t('PlayerQrPage.Loading')
        : dataUrl
          ? t('PlayerQrPage.Refresh')
          : t('PlayerQrPage.Generate');

  return (
    <div className="d-flex flex-column align-items-center">
      {errorKey ? (
        <div className="text-danger small text-center py-4">{t(errorKey)}</div>
      ) : idle ? (
        /* 空闲态不占位：给一个明确的生成按钮，避免挂载即发请求 */
        <div
          className="d-flex align-items-center justify-content-center rounded bg-body-tertiary text-secondary small"
          style={{ width: QR_SIZE + 24, height: QR_SIZE + 24 }}
        >
          {t('PlayerQrPage.NotGenerated')}
        </div>
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
          onClick={() => void generate()}
        >
          {refreshLabel}
        </button>
      </div>
    </div>
  );
}
