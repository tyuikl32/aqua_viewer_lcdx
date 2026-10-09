import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, lcdx } from '@/lib/api/client';
import { translate } from '@/lib/i18n';
import { notice } from '@/lib/message';
import { isOk } from '@/lib/models';
import { getCurrentUser, loadUser } from '@/lib/user';
import type { DisplayMaimai2Profile } from './models';
import './Maimai2SettingPage.css';

/**
 * 等价旧版 Maimai DX settings component + LCDX 缝合（bindCard / 国服数据引继 / 头像上传禁用）。
 *
 * LCDX 差异（对照 master:src/app/sega/maimai2/maimai2-setting/）：
 * - 头像上传整功能禁用（LCDX 现行行为，按钮提示 UploadPortraitDisabled；上游 PortraitDialog 移除）
 * - 新增「绑定卡号」卡：lcdx/getBindAccessCode|addAccessCode|removeAccessCode（注意用 cards[0].luid）
 * - 新增「国服数据引继」卡：lcdx/mergeRegistry 状态查询 / request / cancel（用 defaultCard.luid）
 * - 全部用户可见消息走 i18n（等价旧版 noticeTranslated / noticeError）
 */

/** 引继日期规范化：后端无记录时返回 DateTime 默认值 0001-01-01，视为无记录（等价旧版 normalizeMergeDate） */
function normalizeMergeDate(value: unknown): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) {
    return null;
  }
  return date.toLocaleString();
}

export function Maimai2SettingPage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<DisplayMaimai2Profile | null>(null);
  const [aimeId, setAimeId] = useState('');
  const [userName, setUserName] = useState('');
  const [userNameTouched, setUserNameTouched] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemTouched, setRedeemTouched] = useState(false);
  const [divMaxLength, setDivMaxLength] = useState(0);

  // ---- LCDX：绑定卡 access code（等价旧版 bindCardForm：20 位 access code 绑定/解绑） ----
  const [currentAccessCode, setCurrentAccessCode] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [accessCodeLoaded, setAccessCodeLoaded] = useState(false);

  // ---- LCDX：国服数据引继（merge request） ----
  const [mergeRequested, setMergeRequested] = useState(false);
  const [mergeRequestLoading, setMergeRequestLoading] = useState(false);
  const [mergeCardId, setMergeCardId] = useState('');
  const [mergeLastRequestDate, setMergeLastRequestDate] = useState<string | null>(null);
  const [mergeLastSuccessDate, setMergeLastSuccessDate] = useState<string | null>(null);

  const loadMergeRequestStatus = (cardId: string) => {
    if (!cardId) {
      return;
    }
    const user = encodeURIComponent(getCurrentUser()?.username ?? '');
    lcdx
      .get(`lcdx/mergeRegistry/${user}/${encodeURIComponent(cardId)}`)
      .then((resp) => {
        if (isOk(resp)) {
          setMergeRequested(resp.data?.isOnRequest === true);
          setMergeLastRequestDate(normalizeMergeDate(resp.data?.lastRequestDate));
          setMergeLastSuccessDate(normalizeMergeDate(resp.data?.lastSuccessDate));
        }
      })
      .catch(() => notice(translate('Common.OperationFailed')));
  };

  useEffect(() => {
    void (async () => {
      try {
        await loadUser();
        const user = getCurrentUser();
        const id = String(user?.defaultCard?.extId ?? '');
        setAimeId(id);
        setMergeCardId(String(user?.defaultCard?.luid ?? ''));

        // LCDX account tools must not depend on unrelated game-profile availability.
        const results = await Promise.allSettled([
          api.get('api/game/maimai2/profile', { aimeId: id }).then((loadedProfile) => {
            setProfile(loadedProfile as DisplayMaimai2Profile);
            setUserName((loadedProfile as DisplayMaimai2Profile).userName);
          }),
          api.get('api/game/maimai2/config/userPhoto/divMaxLength').then((maxLength) => {
            setDivMaxLength(Number(maxLength) || 0);
          }),
          (async () => {
            const cardLuid = user?.cards?.[0]?.luid ?? '';
            const bindUser = encodeURIComponent(user?.username ?? '');
            const bindResp = await lcdx.get(`lcdx/getBindAccessCode/${bindUser}/${cardLuid}`);
            if (!isOk(bindResp) || typeof bindResp.data !== 'string') {
              throw new Error('Binding lookup did not return a valid access code');
            }
            setCurrentAccessCode(bindResp.data);
            setAccessCode(bindResp.data);
            setAccessCodeLoaded(true);
          })(),
        ]);
        if (results.some((result) => result.status === 'rejected')) {
          notice(translate('Common.OperationFailed'));
        }
      } catch {
        notice(translate('Common.OperationFailed'));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mergeCardId) {
      loadMergeRequestStatus(mergeCardId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergeCardId]);

  const changeUserName = async () => {
    if (!userNameTouched) return;
    try {
      const updated = await api.post('api/game/maimai2/profile/username', {
        aimeId: Number(aimeId),
        userName,
      });
      setProfile(updated as DisplayMaimai2Profile);
      notice(translate('Maimai2.Setting.UsernameChanged'));
    } catch {
      notice(translate('Common.OperationFailed'));
    }
  };

  const activateRedeemCode = async () => {
    if (!redeemTouched) return;
    try {
      const result = await api.get('api/game/maimai2/redeem', { aimeId, redeemCode });
      if (result?.status?.code === 92001) {
        notice(translate('Maimai2.Setting.RedeemActivated', { name: result.data }));
      } else {
        notice(translate('Maimai2.Setting.RedeemFailed'));
      }
    } catch {
      notice(translate('Common.OperationFailed'));
    }
  };

  const downloadFile = async () => {
    try {
      const blob = await api.blob('api/game/maimai2/export', { aimeId });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `maimai2_${aimeId}_exported.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      notice(translate('Common.OperationFailed'));
    }
  };

  /** LCDX：头像上传功能整功能禁用（等价旧版 openUploadUserPortraitDialog 的 warning 提示） */
  const openPortraitDisabled = () => {
    notice(translate('Maimai2.Setting.UploadPortraitDisabled'), 'warning');
  };

  // ==================== LCDX：绑定卡 access code ====================

  /** 等价旧版 lcdxBindAccessCode：有 code → 解绑（removeAccessCode）；无 code 且输入合法 → 绑定（addAccessCode） */
  const lcdxBindAccessCode = async () => {
    if (!accessCodeLoaded) return;
    const user = getCurrentUser();
    const cardLuid = user?.cards?.[0]?.luid ?? '';
    const name = user?.username ?? '';
    if (currentAccessCode !== '') {
      try {
        const resp = await lcdx.post(`lcdx/removeAccessCode/${name}`, { currentAccessCode: cardLuid });
        if (isOk(resp)) {
          notice(translate('Maimai2.Setting.AccessCodeUpdated'));
          window.location.reload();
        } else {
          notice(translate('Maimai2.Setting.AccessCodeUpdateFailed'));
        }
      } catch {
        notice(translate('Common.OperationFailed'));
      }
      return;
    }
    if (accessCode.length === 20) {
      try {
        const resp = await lcdx.post(`lcdx/addAccessCode/${name}`, {
          currentAccessCode: cardLuid,
          accessCode,
        });
        if (isOk(resp)) {
          notice(translate('Maimai2.Setting.AccessCodeUpdated'));
          window.location.reload();
        } else {
          notice(translate('Maimai2.Setting.AccessCodeUpdateFailed'));
        }
      } catch {
        notice(translate('Common.OperationFailed'));
      }
    }
  };

  // ==================== LCDX：国服数据引继 ====================

  /** 等价旧版 requestMergeFromDefaultServer：确认后提交引继请求 */
  const requestMergeFromDefaultServer = async () => {
    if (mergeRequestLoading || mergeRequested || !mergeCardId) {
      return;
    }
    if (!window.confirm(t('Maimai2.Setting.MergeRequestConfirm'))) {
      return;
    }
    setMergeRequestLoading(true);
    const user = encodeURIComponent(getCurrentUser()?.username ?? '');
    const card = encodeURIComponent(mergeCardId);
    try {
      const resp = await lcdx.post(`lcdx/mergeRegistry/request/${user}/${card}`);
      setMergeRequestLoading(false);
      if (isOk(resp)) {
        setMergeRequested(true);
        notice(translate('Maimai2.Setting.MergeRequestSuccess'));
      } else {
        notice(translate('Maimai2.Setting.MergeRequestFailed'));
      }
    } catch {
      setMergeRequestLoading(false);
      notice(translate('Common.OperationFailed'));
    }
  };

  /** 等价旧版 cancelMergeRequest：确认后撤销引继请求 */
  const cancelMergeRequest = async () => {
    if (mergeRequestLoading || !mergeRequested || !mergeCardId) {
      return;
    }
    if (!window.confirm(t('Maimai2.Setting.MergeCancelConfirm'))) {
      return;
    }
    setMergeRequestLoading(true);
    const user = encodeURIComponent(getCurrentUser()?.username ?? '');
    const card = encodeURIComponent(mergeCardId);
    try {
      const resp = await lcdx.post(`lcdx/mergeRegistry/cancel/${user}/${card}`);
      setMergeRequestLoading(false);
      if (isOk(resp)) {
        setMergeRequested(false);
        notice(translate('Maimai2.Setting.MergeCancelSuccess'));
      } else {
        notice(translate('Maimai2.Setting.MergeCancelFailed'));
      }
    } catch {
      setMergeRequestLoading(false);
      notice(translate('Maimai2.Setting.MergeCancelFailed'));
    }
  };

  return (
    <div className="content maimai2-setting-page">
      <h1 className="page-heading">{t('Maimai2.Setting.Title')}</h1>
      {profile && (
        <>
          <div className="card mb-3">
            <div className="card-header">{t('Maimai2.Setting.UserName')}</div>
            <div className="card-body">
              <h5 className="card-title">{t('Maimai2.Setting.UserNameTitle')}</h5>
              <form onSubmit={(event) => event.preventDefault()}>
                <input
                  value={userName}
                  onChange={(event) => {
                    setUserName(event.target.value);
                    setUserNameTouched(true);
                  }}
                  type="text"
                  className="form-control mb-3"
                  id="username"
                />
              </form>
              <div className="d-flex justify-content-between align-items-center">
                <div className="text-muted small align-text-bottom">{t('Maimai2.Setting.UserNameSubTitle')}</div>
                <a className="btn btn-primary" onClick={() => void changeUserName()}>
                  {t('Maimai2.Setting.UserNameChangeButton')}
                </a>
              </div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header">{t('Maimai2.Setting.UserIcon')}</div>
            <div className="card-body">
              <h5 className="card-title" />
              <h5 className="card-text">
                {t('Maimai2.Setting.UserIconTips')}
                <ul>
                  <li>
                    {t('Maimai2.Setting.UserIconLimit1')} &lt; <b>{divMaxLength * 10} kb</b>.
                  </li>
                  <li>{t('Maimai2.Setting.UserIconLimit2')}</li>
                </ul>
              </h5>
              <div className="d-flex justify-content-between align-items-end">
                <div className="text-muted small align-text-bottom">{t('Maimai2.Setting.UserIconSubTitle')}</div>
                <a className="btn btn-primary" onClick={openPortraitDisabled}>
                  {t('Maimai2.Setting.UserIconChangeButton')}
                </a>
              </div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header">{t('Maimai2.Setting.RedemptionCode')}</div>
            <div className="card-body">
              <h5 className="card-title">{t('Maimai2.Setting.RedemptionCodeTitle')}</h5>
              <form onSubmit={(event) => event.preventDefault()}>
                <input
                  value={redeemCode}
                  onChange={(event) => {
                    setRedeemCode(event.target.value);
                    setRedeemTouched(true);
                  }}
                  type="text"
                  className="form-control mb-3"
                  id="redeemCode"
                />
              </form>
              <div className="d-flex justify-content-between align-items-center">
                <div className="text-muted small align-text-bottom">{t('Maimai2.Setting.RedemptionCodeSubTitle')}</div>
                <a className="btn btn-primary" onClick={() => void activateRedeemCode()}>
                  {t('Maimai2.Setting.RedeemButton')}
                </a>
              </div>
            </div>
          </div>
        </>
      )}
      {aimeId && (
        <>
          {/* LCDX：绑定卡号卡（等价旧版 BindingCardNumber；有 code 只读 + 解绑，无 code 可编辑 + 绑定） */}
          <div className="card mb-3">
            <div className="card-header">{t('Maimai2.Setting.BindingCardNumber')}</div>
            <div className="card-body">
              <h5 className="card-title">{t('Maimai2.Setting.BindingCardNumberTitle')}</h5>
              <form onSubmit={(event) => event.preventDefault()}>
                <input
                  value={accessCodeLoaded ? accessCode : t('Maimai2.Setting.AccessCodeLoading')}
                  onChange={(event) => setAccessCode(event.target.value)}
                  type="text"
                  className="form-control mb-3"
                  id="accessCode"
                  disabled={!accessCodeLoaded || currentAccessCode !== ''}
                />
              </form>
              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3">
                <div className="text-muted small">
                  {t('Maimai2.Setting.BindingCardNumberSubTitle1')}
                  <br />
                  {t('Maimai2.Setting.BindingCardNumberSubTitle2')}
                </div>
                <button
                  type="button"
                  onClick={() => void lcdxBindAccessCode()}
                  className="btn btn-primary flex-shrink-0"
                  disabled={!accessCodeLoaded || (currentAccessCode === '' && accessCode.length !== 20)}
                >
                  {currentAccessCode === ''
                    ? t('Maimai2.Setting.TryBind')
                    : t('Maimai2.Setting.Unbind')}
                </button>
              </div>
            </div>
          </div>

          {/* LCDX：国服数据引继卡（等价旧版 MergeRequest：状态查询 + 请求/取消 + 日期展示） */}
          <div className="card mb-3">
            <div className="card-header">{t('Maimai2.Setting.MergeRequest')}</div>
            <div className="card-body">
              <h5 className="card-title">{t('Maimai2.Setting.MergeRequestTitle')}</h5>
              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3">
                <div className="text-muted small">{t('Maimai2.Setting.MergeRequestSubTitle')}</div>
                <button
                  type="button"
                  className={`btn flex-shrink-0 ${mergeRequested ? 'btn-danger' : 'btn-primary'}`}
                  disabled={mergeRequestLoading || !mergeCardId}
                  onClick={() =>
                    void (mergeRequested ? cancelMergeRequest() : requestMergeFromDefaultServer())
                  }
                >
                  {mergeRequestLoading
                    ? t('Maimai2.Setting.MergeRequestLoading')
                    : mergeRequested
                      ? t('Maimai2.Setting.MergeCancelButton')
                      : t('Maimai2.Setting.MergeRequestButton')}
                </button>
              </div>
              {(mergeLastRequestDate || mergeLastSuccessDate) && (
                <div className="text-muted small mt-2">
                  {mergeLastRequestDate && (
                    <div>
                      {t('Maimai2.Setting.MergeLastRequestDate')}: {mergeLastRequestDate}
                    </div>
                  )}
                  {mergeLastSuccessDate && (
                    <div>
                      {t('Maimai2.Setting.MergeLastSuccessDate')}: {mergeLastSuccessDate}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {profile && (
        <>
          <div className="card mb-3">
            <div className="card-header text-danger">{t('Maimai2.Setting.ExportData')}</div>
            <div className="card-body">
              <h5 className="card-text">{t('Maimai2.Setting.ExportDataTitle')}</h5>
              <div className="d-flex justify-content-between align-items-end">
                <div className="text-muted small align-text-bottom">{t('Maimai2.Setting.ExportDataSubTitle')}</div>
                <a className="btn btn-primary" onClick={() => void downloadFile()}>
                  {t('Maimai2.Setting.ExportDataSubButton')}
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
