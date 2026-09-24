import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lcdx } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { isOk } from '@/lib/models';
import { getCurrentUser, loadUser } from '@/lib/user';
import { filterCommands, useBotPermission } from '@/lib/botPermission';
import type { CabinetSummary, RemoteCommandResult } from './cabinet-models';
import { REMOTE_COMMANDS } from './cabinet-models';
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

  /** 指令下拉按角色过滤（等价旧版 botPermission.state 订阅：延迟返回的 Admin 探测可扩展列表） */
  const commands = useMemo(
    () => filterCommands(permission.permission, REMOTE_COMMANDS),
    [permission.permission],
  );

  const selectedCommandDef = commands.find((c) => c.command === selectedCommand);

  /** 权限变化后若当前选中指令不再可见则清空（等价旧版订阅内逻辑） */
  useEffect(() => {
    if (selectedCommand && !commands.some((c) => c.command === selectedCommand)) {
      setSelectedCommand('');
    }
  }, [commands, selectedCommand]);

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const pollCountsRef = useRef(new Map<string, number>());
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
              s.requestId === entry.requestId
                ? { ...s, status: data.status, message: data.message, imageUrl: data.imageUrl }
                : s,
            ),
          );
        }
        // data 为空（94041）：保持 pending 直至上限
      } catch {
        /* 等价旧版：单次轮询失败不终止会话，直到上限 */
      }
      if (count >= POLL_MAX) {
        // 2s×30 上限：置 timeout 停止轮询该条目
        setSessions((prev) =>
          prev.map((s) => (s.requestId === entry.requestId ? { ...s, status: 'timeout' } : s)),
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
    setSending(true);
    try {
      const resp = await lcdx.post('lcdx/cabinet/command', {
        userName: userName(),
        nickName: selectedNick,
        command: selectedCommand,
        message,
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
        notice(t('Maimai2.RemoteControlPage.Failed'));
      }
    } catch {
      setSending(false);
      notice(t('Maimai2.RemoteControlPage.NetworkError'));
    }
  }, [message, selectedCommand, selectedNick, sending, startPolling, t]);

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
                  <label className="form-label">{t('Maimai2.Cabinets.SelectCabinet')}</label>
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
                <div className="col-md-4">
                  <label className="form-label">{t('Maimai2.RemoteControl.Command')}</label>
                  <select
                    className="form-select"
                    value={selectedCommand}
                    onChange={(event) => setSelectedCommand(event.target.value)}
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
                    <div className="form-text">
                      {selectedCommandDef.hasArg
                        ? t(selectedCommandDef.argHintKey)
                        : t('Maimai2.RemoteControl.NoArgCommand')}
                    </div>
                  )}
                </div>
                <div className="col-md-4">
                  <label className="form-label">{t('Maimai2.RemoteControl.Params')}</label>
                  <input
                    className="form-control"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    disabled={Boolean(selectedCommandDef) && !selectedCommandDef?.hasArg}
                    placeholder={t('Maimai2.RemoteControl.ParamsPlaceholder')}
                  />
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
