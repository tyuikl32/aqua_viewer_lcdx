import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lcdx } from '@/lib/api/client';
import { translate } from '@/lib/i18n';
import { notice } from '@/lib/message';
import { isOk } from '@/lib/models';
import { getCurrentUser, loadUser } from '@/lib/user';
import { filterCommands, useBotPermission } from '@/lib/botPermission';
import type { CabinetSummary, RemoteCommandResult } from './cabinet-models';
import { argFormatKey, commandArgValue, isArgInvalid, REMOTE_COMMANDS } from './cabinet-models';
import './Maimai2RemoteControlPage.css';

const POLL_INTERVAL_MS = 2_000;
const POLL_MAX = 30;

interface SessionEntry {
  requestId: string;
  command: string;
  status: 'pending' | 'done' | 'timeout';
  message: string | null;
  imageUrl: string | null;
}

/**
 * 等价旧版 maimai2-remote-control（页③ 远程控制，设计 §8）：
 * EP-19 机台下拉 + 指令下拉按角色过滤（普通 game-reboot/game-switch，Admin 17 条）
 * + EP-13 发送 → 结果轮询（2s×30）+ 文本 <pre> / printscr <img>（仅 Admin）+ 会话记录（内存态）。
 */

/** 等价旧版 statusBadge */
function statusBadge(entry: SessionEntry): string {
  switch (entry.status) {
    case 'done':
      return 'text-bg-success';
    case 'timeout':
      return 'text-bg-danger';
    default:
      return 'text-bg-secondary';
  }
}

export function Maimai2RemoteControlPage() {
  const { t } = useTranslation();
  const permission = useBotPermission();

  const [cabinets, setCabinets] = useState<CabinetSummary[]>([]);
  const [selectedNick, setSelectedNick] = useState('');
  const [selectedCommand, setSelectedCommand] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  /** 参数框已失焦（或点击发送被拦）：此后才显示行内校验错误，避免刚选中指令就报红 */
  const [argTouched, setArgTouched] = useState(false);
  const paramsRef = useRef<HTMLInputElement>(null);
  /** 上一次选中指令的参数格式签名（'' = 无参/未选），用于判断切换时是否要清空已填值 */
  const prevArgFormatRef = useRef<string>('');

  /** 指令下拉按角色过滤（等价旧版 botPermission.state 订阅：延迟返回的 Admin 探测可扩展列表） */
  const commands = useMemo(
    () => filterCommands(permission.permission, REMOTE_COMMANDS),
    [permission.permission],
  );

  const selectedCommandDef = commands.find((c) => c.command === selectedCommand);
  const argSpec = selectedCommandDef?.arg;
  const showArgError = argTouched && isArgInvalid(argSpec, message);

  /** 权限变化后若当前选中指令不再可见则清空（等价旧版订阅内逻辑） */
  useEffect(() => {
    if (selectedCommand && !commands.some((c) => c.command === selectedCommand)) {
      setSelectedCommand('');
    }
  }, [commands, selectedCommand]);

  /**
   * 切换指令：复位「已失焦」标记；参数格式变了就清空已填值（无参指令同样清空），
   * 只有 download / downloadpro 这类同格式指令之间切换才保留。
   * 依赖只有 selectedCommand —— commands 会随权限探测换新数组，不能让它触发清理。
   */
  useEffect(() => {
    setArgTouched(false);
    const format = argFormatKey(selectedCommandDef?.arg);
    if (prevArgFormatRef.current !== format) {
      prevArgFormatRef.current = format;
      setMessage('');
    }
  }, [selectedCommand]);

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const pollCountsRef = useRef(new Map<string, number>());
  const pollingRequestsRef = useRef(new Set<string>());
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const userName = () => getCurrentUser()?.username ?? '';

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
      /* 等价旧版：列表加载失败静默，页面显示空列表提示 */
    }
  }, []);

  useEffect(() => {
    void loadCabinets();
  }, [loadCabinets]);

  /** 单一定时器轮询全部 pending 会话（等价旧版 pollPending） */
  const pollPending = useCallback(async () => {
    const pending = sessionsRef.current.filter((s) => s.status === 'pending');
    if (pending.length === 0) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }
    for (const entry of pending) {
      if (
        pollingRequestsRef.current.has(entry.requestId) ||
        !sessionsRef.current.some((s) => s.requestId === entry.requestId && s.status === 'pending')
      ) {
        continue;
      }
      pollingRequestsRef.current.add(entry.requestId);
      const count = (pollCountsRef.current.get(entry.requestId) ?? 0) + 1;
      pollCountsRef.current.set(entry.requestId, count);
      try {
        const resp = (await lcdx.get(
          `lcdx/cabinet/result/${encodeURIComponent(userName())}/${encodeURIComponent(entry.requestId)}`,
        )) as { data?: RemoteCommandResult };
        const data = resp?.data;
        if (data && data.status !== 'pending') {
          setSessions((prev) =>
            prev.map((s) =>
              s.requestId === entry.requestId && s.status === 'pending'
                ? { ...s, status: data.status, message: data.message, imageUrl: data.imageUrl }
                : s,
            ),
          );
        }
        // data 为空（94041）：保持 pending 直至上限
      } catch {
        /* 等价旧版：单次轮询失败不终止会话，直到上限 */
      } finally {
        pollingRequestsRef.current.delete(entry.requestId);
      }
      if (count >= POLL_MAX) {
        // 最多 30 次已完成的查询；慢请求不重叠，不保证严格的 60 秒超时。
        setSessions((prev) =>
          prev.map((s) =>
            s.requestId === entry.requestId && s.status === 'pending'
              ? { ...s, status: 'timeout' }
              : s,
          ),
        );
      }
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) {
      return;
    }
    pollTimerRef.current = setInterval(() => void pollPending(), POLL_INTERVAL_MS);
  }, [pollPending]);

  /** 无 pending 会话时停表（等价旧版 pollPending 内的 stopPolling） */
  useEffect(() => {
    if (!sessions.some((s) => s.status === 'pending') && pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, [sessions]);

  /** 卸载清理（等价旧版 ngOnDestroy） */
  useEffect(
    () => () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    },
    [],
  );

  /** EP-13 发送远程指令（等价旧版 send） */
  const send = useCallback(async () => {
    if (!selectedCommand || !selectedNick || sending) {
      return;
    }
    // 契约校验：必填未填 / 格式不符时只报行内错误，不发请求（错误就地展示，不再弹 toast）
    if (isArgInvalid(argSpec, message)) {
      setArgTouched(true);
      paramsRef.current?.focus();
      return;
    }
    setSending(true);
    try {
      const resp = await lcdx.post('lcdx/cabinet/command', {
        userName: userName(),
        nickName: selectedNick,
        command: selectedCommand,
        // 无参指令恒发空串，避免把上一条指令的残留参数带给机台
        message: commandArgValue(argSpec, message),
      });
      setSending(false);
      if (isOk(resp) && resp.data?.requestId) {
        const requestId: string = resp.data.requestId;
        setSessions((prev) => [
          {
            requestId,
            command: selectedCommand,
            status: 'pending',
            message: null,
            imageUrl: null,
          },
          ...prev,
        ]);
        pollCountsRef.current.set(requestId, 0);
        startPolling();
      } else {
        notice(translate('Maimai2.RemoteControlPage.Failed'));
      }
    } catch {
      setSending(false);
      notice(translate('Maimai2.RemoteControlPage.NetworkError'));
    }
  }, [argSpec, message, selectedCommand, selectedNick, sending, startPolling, t]);

  return (
    <>
      <h1 className="page-heading">{t('Maimai2.RemoteControlPage.Title')}</h1>

      {cabinets.length === 0 ? (
        <div className="alert alert-info">{t('Maimai2.CabinetsPage.NoCabinets')}</div>
      ) : (
        <>
          <div className="card shadow mb-4">
            <div className="card-body">
              <div className="row g-2 align-items-start">
                <div className="col-md-4 cabinet-select-col">
                  <label className="form-label" htmlFor="remote-cabinet">
                    {t('Maimai2.Cabinets.SelectCabinet')}
                  </label>
                  <select
                    id="remote-cabinet"
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
                <div className="col-md-4">
                  <label className="form-label" htmlFor="remote-command">
                    {t('Maimai2.RemoteControl.Command')}
                  </label>
                  <select
                    id="remote-command"
                    className="form-select"
                    value={selectedCommand}
                    onChange={(event) => setSelectedCommand(event.target.value)}
                    aria-describedby={selectedCommandDef ? 'remote-args-hint' : undefined}
                  >
                    <option value="" disabled>
                      {t('Maimai2.RemoteControl.SelectCommand')}
                    </option>
                    {commands.map((c) => (
                      <option key={c.command} value={c.command}>
                        {c.command}
                      </option>
                    ))}
                  </select>
                  {selectedCommandDef && (
                    <div className="form-text" id="remote-args-hint">
                      {argSpec
                        ? t(argSpec.hintKey)
                        : t('Maimai2.RemoteControl.NoArgCommand')}
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="form-label" htmlFor="remote-params">
                    {t('Maimai2.RemoteControl.Params')}
                  </label>
                  <input
                    id="remote-params"
                    ref={paramsRef}
                    className={'form-control' + (showArgError ? ' is-invalid' : '')}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onBlur={() => setArgTouched(true)}
                    disabled={!argSpec}
                    placeholder={t(argSpec?.placeholderKey ?? 'Maimai2.RemoteControl.ParamsPlaceholder')}
                    inputMode={argSpec?.numeric ? 'numeric' : undefined}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={showArgError || undefined}
                    aria-describedby={
                      showArgError ? 'remote-args-hint remote-args-error' : 'remote-args-hint'
                    }
                  />
                  {showArgError && (
                    <div className="invalid-feedback d-block" id="remote-args-error" role="alert">
                      {t(argSpec?.invalidKey ?? argSpec?.hintKey ?? 'Maimai2.RemoteControl.Params')}
                    </div>
                  )}
                </div>
              </div>
              <button
                className="btn btn-primary mt-3"
                disabled={!selectedCommand || !selectedNick || sending}
                onClick={() => void send()}
              >
                {sending && <span className="spinner-border spinner-border-sm me-1"></span>}
                {t('Maimai2.RemoteControl.Send')}
              </button>
            </div>
          </div>

          {sessions.length > 0 && (
            <div className="card shadow">
              <div className="card-header">
                <h5 className="mb-0">{t('Maimai2.RemoteControl.SessionLog')}</h5>
              </div>
              <div className="card-body">
                {sessions.map((s) => (
                  <div className="border rounded p-2 mb-2" key={s.requestId}>
                    <div className="d-flex justify-content-between align-items-center">
                      <span>
                        <code>{s.command}</code> <small className="text-muted">#{s.requestId}</small>
                      </span>
                      <span className={`badge ${statusBadge(s)}`}>{s.status}</span>
                    </div>
                    {s.imageUrl ? (
                      <img src={s.imageUrl} className="img-fluid rounded mt-2" alt="screenshot" />
                    ) : s.message ? (
                      <pre className="mb-0 mt-2 small">{s.message}</pre>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
