import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lcdx } from '@/lib/api/client';
import { translate } from '@/lib/i18n';
import { notice } from '@/lib/message';
import { isOk } from '@/lib/models';
import { getCurrentUser, loadUser } from '@/lib/user';
import {
  filterLcsetKeys,
  MANAGE_GRANTS,
  MANAGE_PERMISSIONS,
  useBotPermission,
} from '@/lib/botPermission';
import type {
  CabinetLevelResult,
  CabinetSummary,
  CabModeItem,
} from './cabinet-models';
import { CABINET_LEVELS, LC_MODES, LCSET_KEYS } from './cabinet-models';
import './Maimai2CabmodePage.css';

/** 显示宽度（CJK/全角计 2，等价旧版 displayWidth） */
function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    width +=
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6)
        ? 2
        : 1;
  }
  return width;
}

/**
 * 按钮长名换行（等价旧版 formatModeButtonLabel；只插入显式 \n，CSS 用 pre-wrap 不再按空格自动折）：
 * 1. 含「maimai でらっくす」时在品牌后断行，版本名整段保留在第二行（CiRCLE PLUS / PRiSM 不拆）
 * 2. 否则显示宽度 > 16 时在最后一个空格拆行
 */
export function formatModeButtonLabel(name: string): string {
  const brand = 'maimai でらっくす';
  const brandIdx = name.indexOf(brand);
  if (brandIdx >= 0) {
    const head = name.slice(0, brandIdx + brand.length).trimEnd();
    const tail = name.slice(brandIdx + brand.length).trim();
    return tail ? `${head}\n${tail}` : head;
  }
  if (displayWidth(name) <= 16) {
    return name;
  }
  const lastSpace = name.lastIndexOf(' ');
  if (lastSpace > 0) {
    return name.slice(0, lastSpace) + '\n' + name.slice(lastSpace + 1);
  }
  return name;
}

/**
 * 等价旧版 maimai2-cabmode（页② 机台控制，设计 §8；v2 D13 分档）：
 * LC 模式卡 + 传统重启卡：激活用户（P≥1 持授权行）均可用；
 * LC 功能卡（EP-10）：仅 P≥4（完整 9 项，P≤3 整卡隐藏）；
 * 管理区机台级别卡（EP-11）：P≥4 显示 —— P4-6 仅 2..5 档，P≥7 全档 -1..7。
 * LC 模式选项来自 CabmodeList（机台 level ≥ 目录最低档）；LC_MODES 仅作 API 失败回退。
 */
export function Maimai2CabmodePage() {
  const { t } = useTranslation();
  const permissionState = useBotPermission();
  const permission = permissionState.permission;

  const [cabinets, setCabinets] = useState<CabinetSummary[]>([]);
  const [selectedNick, setSelectedNick] = useState('');
  const [info, setInfo] = useState<{
    isSpecialMode: number;
    isRebooting: boolean;
    level: number;
    settings: { settingName: string; settingValue: string }[];
  } | null>(null);
  const [selectedMode, setSelectedMode] = useState(-1);
  const [rebooting, setRebooting] = useState(false);
  /** CabmodeList 实时目录；空数组表示尚未加载或 API 失败（回退 LC_MODES） */
  const [cabModes, setCabModes] = useState<CabModeItem[]>([]);
  const [lcsetKey, setLcsetKey] = useState('');
  const [lcsetVal, setLcsetVal] = useState('');
  const [selectedLevel, setSelectedLevel] = useState(3);

  /** LC 功能键按权限过滤（P≥4 完整 9 项，P≤3 为空；等价旧版 permission 订阅） */
  const lcsetKeys = useMemo(() => filterLcsetKeys(permission, LCSET_KEYS), [permission]);

  /** 级别下拉选项（v2 D13）：P4-6 仅 2..5；P≥7 全档 -1..7 */
  const cabinetLevelOptions = useMemo(
    () =>
      permission >= MANAGE_PERMISSIONS
        ? CABINET_LEVELS
        : CABINET_LEVELS.filter((l) => l.level >= 2 && l.level <= 5),
    [permission],
  );

  const selectedNickRef = useRef(selectedNick);
  selectedNickRef.current = selectedNick;
  const infoGenerationRef = useRef(0);

  const userName = () => getCurrentUser()?.username ?? '';

  /** 可选模式：目录已滤 IsEnabled；此处再滤机台 level ≥ 目录最低档；无目录时回退 LC_MODES */
  const visibleModes = useMemo(() => {
    if (cabModes.length > 0) {
      const cabLevel = info?.level;
      return cabModes
        .filter((m) => cabLevel === undefined || cabLevel >= m.level)
        .map((m) => ({ mode: m.id, label: formatModeButtonLabel(m.name) }));
    }
    return LC_MODES.map((m) => ({ mode: m.mode, label: '' }));
  }, [cabModes, info?.level]);

  /** 当前模式文案：查得到目录名时 `id（名称）`，否则回退 i18n Mode* */
  const currentModeLabel = (() => {
    const id = info?.isSpecialMode;
    if (id === undefined || id === null) {
      return '';
    }
    const fromDb = cabModes.find((m) => m.id === id)?.name;
    return fromDb ? t('Maimai2.CabinetControl.ModeNameWithId', { id, name: fromDb }) : String(id);
  })();

  const currentModeFallbackLabelKey =
    LC_MODES.find((m) => m.mode === info?.isSpecialMode)?.labelKey ?? '';

  const modeChanged = info != null && selectedMode !== info.isSpecialMode;

  const currentLcsetEntry = lcsetKeys.find((k) => k.key === lcsetKey);
  const currentLcsetDefault = currentLcsetEntry?.default;
  /** 输入格式提示（如 cc 的格式(0,1)）：仅作 placeholder/辅助说明，不锁定输入 */
  const currentLcsetNote = currentLcsetEntry?.noteKey ? t(currentLcsetEntry.noteKey) : undefined;

  const loadCabModes = useCallback(async () => {
    try {
      await loadUser();
      const resp = await lcdx.get(`lcdx/cabinet/modes/${encodeURIComponent(userName())}`);
      if (isOk(resp) && resp.data?.modes) {
        setCabModes(resp.data.modes as CabModeItem[]);
      }
    } catch {
      /* 等价旧版：失败保持空目录，模式列表回退 LC_MODES */
    }
  }, []);

  const loadInfo = useCallback(async () => {
    try {
      const nick = selectedNick;
      if (!nick || nick !== selectedNickRef.current) {
        return;
      }
      const generation = ++infoGenerationRef.current;
      const resp = await lcdx.get(
        `lcdx/cabinet/info/${encodeURIComponent(userName())}/${encodeURIComponent(nick)}`,
      );
      if (generation !== infoGenerationRef.current || nick !== selectedNickRef.current) return;
      if (isOk(resp)) {
        setInfo(resp.data);
        setSelectedMode(resp.data.isSpecialMode);
        setRebooting(resp.data.isRebooting);
        setSelectedLevel(resp.data.level);
      }
    } catch {
      /* 等价旧版：静默 */
    }
  }, [selectedNick]);

  const loadCabinets = useCallback(async () => {
    try {
      await loadUser();
      const resp = await lcdx.get(`lcdx/cabinet/controllable/${encodeURIComponent(userName())}`);
      if (isOk(resp) && Array.isArray(resp.data)) {
        const list = resp.data as CabinetSummary[];
        setCabinets(list);
        const first = list[0];
        setSelectedNick(first ? (first.nickName ?? first.fullKeychip) : '');
      }
    } catch {
      /* 等价旧版：静默，页面显示空列表提示 */
    }
  }, []);

  useEffect(() => {
    void loadCabModes();
    void loadCabinets();
  }, [loadCabModes, loadCabinets]);

  /** 选中机台变化（含初次默认选中）→ 加载 info（等价旧版 onCabinetChange） */
  useEffect(() => {
    setInfo(null);
    if (selectedNick) {
      void loadInfo();
    }
    return () => { infoGenerationRef.current++; };
  }, [selectedNick, loadInfo]);

  const submitMode = async () => {
    try {
      const resp = await lcdx.post('lcdx/cabinet/mode', {
        userName: userName(),
        nickName: selectedNick,
        mode: selectedMode,
      });
      if (isOk(resp)) {
        notice(translate('Maimai2.CabinetControl.Success'));
        void loadInfo();
      } else {
        notice(translate('Maimai2.CabinetControl.Failed'));
      }
    } catch {
      notice(translate('Maimai2.CabinetControl.Failed'));
    }
  };

  /** 读即清语义：机台下次心跳空闲时自动重启；设置需二次确认 */
  const toggleReboot = async () => {
    const enable = !rebooting;
    if (enable && !window.confirm(t('Maimai2.CabinetControl.RebootConfirm'))) {
      return;
    }
    try {
      const resp = await lcdx.post('lcdx/cabinet/reboot', {
        userName: userName(),
        nickName: selectedNick,
        enable,
      });
      if (isOk(resp)) {
        notice(translate('Maimai2.CabinetControl.Success'));
        void loadInfo();
      } else {
        notice(translate('Maimai2.CabinetControl.Failed'));
      }
    } catch {
      notice(translate('Maimai2.CabinetControl.Failed'));
    }
  };

  const submitLcset = async () => {
    try {
      const resp = await lcdx.post('lcdx/cabinet/lcset', {
        userName: userName(),
        nickName: selectedNick,
        key: lcsetKey,
        val: lcsetVal,
      });
      if (isOk(resp)) {
        notice(translate('Maimai2.CabinetControl.Success'));
        setLcsetVal('');
        void loadInfo();
      } else {
        notice(translate('Maimai2.CabinetControl.Failed'));
      }
    } catch {
      notice(translate('Maimai2.CabinetControl.Failed'));
    }
  };

  /** 恢复默认值：将输入框填为当前 key 的 default（无 default 的 key 按钮已禁用） */
  const restoreDefault = () => {
    if (currentLcsetDefault !== undefined) {
      setLcsetVal(currentLcsetDefault);
    }
  };

  const submitLevel = async () => {
    try {
      const resp = await lcdx.post('lcdx/cabinet/level', {
        userName: userName(),
        nickName: selectedNick,
        level: selectedLevel,
      });
      if (isOk(resp)) {
        const result = resp.data as CabinetLevelResult;
        notice(translate('Maimai2.CabinetControl.Success'));
        // 后端档位警告（级别越低配信越少）：有则一并提示，避免被静默吞掉
        if (result?.warning) {
          notice(result.warning, 'warning');
        }
        void loadInfo();
      } else {
        notice(translate('Maimai2.CabinetControl.Failed'));
      }
    } catch {
      notice(translate('Maimai2.CabinetControl.Failed'));
    }
  };

  return (
    <>
      <h1 className="page-heading">{t('Maimai2.CabinetControlPage.Title')}</h1>

      {cabinets.length === 0 ? (
        <div className="alert alert-info">{t('Maimai2.CabinetsPage.NoCabinets')}</div>
      ) : (
        <>
          <div className="row mb-3">
            <div className="col-md-5 cabinet-select-col">
              <select
                className="form-select cabinet-select"
                value={selectedNick}
                onChange={(event) => setSelectedNick(event.target.value)}
              >
                {cabinets.map((cab) => {
                  const value = cab.nickName ?? cab.fullKeychip;
                  return (
                    <option key={cab.fullKeychip} value={value}>
                      {cab.nickName || cab.fullKeychip}
                      {cab.locationName ? ` (${cab.locationName})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="row">
            {/* LC 模式卡：PC 半宽（col-lg-6），长名按钮不再挤扁旁边功能卡 */}
            <div className="col-12 col-lg-6 mb-4">
              <div className="card shadow h-100">
                <div className="card-header">
                  <h5 className="mb-0">{t('Maimai2.CabinetControl.LCModeCard')}</h5>
                </div>
                <div className="card-body">
                  <div className="cab-mode-block">
                    <div className="mb-3 text-muted small cab-mode-current">
                      {t('Maimai2.CabinetControl.CurrentMode')}:{' '}
                      {cabModes.length > 0 ? (
                        <span className="cab-mode-current-name">{currentModeLabel}</span>
                      ) : (
                        <>
                          {info?.isSpecialMode}
                          {currentModeFallbackLabelKey
                            ? t('Maimai2.CabinetControl.Parenthesized', { value: t(currentModeFallbackLabelKey) })
                            : ''}
                        </>
                      )}
                    </div>
                    <div className="cab-mode-grid">
                      {visibleModes.map((m) => (
                        <button
                          type="button"
                          key={m.mode}
                          className={`btn cab-mode-btn ${
                            selectedMode === m.mode ? 'btn-primary' : 'btn-outline-primary'
                          }`}
                          onClick={() => setSelectedMode(m.mode)}
                        >
                          {m.label ? m.label : t(`Maimai2.Cabinets.Mode${m.mode}`)}
                        </button>
                      ))}
                    </div>
                    <button
                      className="btn btn-success mt-3 cab-mode-submit"
                      disabled={!modeChanged}
                      onClick={() => void submitMode()}
                    >
                      {t('Maimai2.CabinetControl.Submit')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 传统重启卡：与模式卡同行（lg 6+6），不塞进 1/3 窄列 */}
            <div className="col-12 col-md-6 col-lg-6 mb-4">
              <div className="card shadow h-100">
                <div className="card-header">
                  <h5 className="mb-0">{t('Maimai2.CabinetControl.RebootCard')}</h5>
                </div>
                <div className="card-body">
                  <p className="small text-muted">{t('Maimai2.CabinetControl.RebootHint')}</p>
                  {rebooting ? (
                    <button className="btn btn-warning" disabled={!info} onClick={() => void toggleReboot()}>
                      {t('Maimai2.CabinetControl.CancelReboot')}
                    </button>
                  ) : (
                    <button className="btn btn-danger" disabled={!info} onClick={() => void toggleReboot()}>
                      {t('Maimai2.CabinetControl.SetReboot')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* LC 功能卡：lg 起占半宽，自动换到下一行（与级别卡并排） */}
            {permission >= MANAGE_GRANTS && (
              <div className="col-12 col-md-6 col-lg-6 mb-4">
                <div className="card shadow h-100">
                  <div className="card-header">
                    <h5 className="mb-0">{t('Maimai2.CabinetControl.LCSettingsCard')}</h5>
                  </div>
                  <div className="card-body">
                    <select
                      className="form-select mb-2"
                      value={lcsetKey}
                      onChange={(event) => setLcsetKey(event.target.value)}
                    >
                      <option value="" disabled>
                        {t('Maimai2.CabinetControl.SelectKey')}
                      </option>
                      {lcsetKeys.map((k) => (
                        <option key={k.key + k.setting} value={k.key}>
                          {k.keyLabelKey ? t(k.keyLabelKey) : k.key} → {k.setting}
                        </option>
                      ))}
                    </select>
                    <input
                      className="form-control mb-2"
                      value={lcsetVal}
                      onChange={(event) => setLcsetVal(event.target.value)}
                      placeholder={currentLcsetNote ?? t('Maimai2.CabinetControl.ValuePlaceholder')}
                    />
                    {currentLcsetNote && (
                      <div className="form-text mb-2">
                        {t('Maimai2.CabinetControl.ValueFormatHint')}: {currentLcsetNote}
                      </div>
                    )}
                    <div className="d-flex gap-2 flex-wrap">
                      <button
                        className="btn btn-success"
                        disabled={!lcsetKey}
                        onClick={() => void submitLcset()}
                      >
                        {t('Maimai2.CabinetControl.Submit')}
                      </button>
                      <button
                        className="btn btn-outline-secondary"
                        disabled={!lcsetKey || currentLcsetDefault === undefined}
                        onClick={restoreDefault}
                      >
                        {t('Maimai2.CabinetControl.RestoreDefault')}
                      </button>
                    </div>
                    {Boolean(info?.settings?.length) && (
                      <>
                        <hr />
                        <h6>{t('Maimai2.Cabinets.EnabledSettings')}</h6>
                        <ul className="list-unstyled small mb-0">
                          {info!.settings.map((s) => (
                            <li key={s.settingName}>
                              <code>{s.settingName}</code> = {s.settingValue}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 管理区：机台级别卡（v2 D13：P≥4 显示；P4-6 仅 2..5，P≥7 全档） */}
            {permission >= MANAGE_GRANTS && (
              <div className="col-12 col-md-6 col-lg-6 mb-4">
                <div className="card shadow h-100 border-warning">
                  <div className="card-header bg-warning-subtle">
                    <h5 className="mb-0">⚙ {t('Maimai2.CabinetControl.LevelCard')}</h5>
                  </div>
                  <div className="card-body">
                    <div className="mb-2 small text-muted">
                      {t('Maimai2.CabinetControl.CurrentLevel')}: {info?.level}
                    </div>
                    <select
                      className="form-select mb-2"
                      value={selectedLevel}
                      onChange={(event) => setSelectedLevel(Number(event.target.value))}
                    >
                      {cabinetLevelOptions.map((l) => (
                        <option key={l.level} value={l.level}>
                          {l.level} — {l.name} ({t(l.descKey)})
                        </option>
                      ))}
                    </select>
                    <div className="alert alert-warning py-2 small mb-2">
                      {t('Maimai2.CabinetControl.LevelWarning')}
                    </div>
                    <button className="btn btn-success" disabled={!info} onClick={() => void submitLevel()}>
                      {t('Maimai2.CabinetControl.Submit')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
