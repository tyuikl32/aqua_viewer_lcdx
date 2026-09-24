import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lcdx } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { isOk } from '@/lib/models';
import { getCurrentUser, loadUser } from '@/lib/user';
import {
  ADMIN_PERMISSION,
  MANAGE_GRANTS,
  MANAGE_PERMISSIONS,
  roleBand,
  useBotPermission,
} from '@/lib/botPermission';
import type {
  CabinetSummary,
  GrantItem,
  GrantList,
  MemberPermissionItem,
  MemberPermissionList,
  RemoteLockItem,
  RemoteLockList,
} from './cabinet-models';
import { formatFullDateTime, formatMinutesDateTime } from './cabinet-models';
import { Maimai2Pagination } from './Maimai2Pagination';
import './Maimai2LocksPage.css';

const PAGE_SIZE = 20;
const GRANT_PAGE_SIZE_OPTIONS = [10, 20, 100];
const ACTIONS = [
  'cabmode',
  'cabreboot',
  'lcset',
  'cablevel',
  'rm',
  'grant-add',
  'grant-remove',
  'perm-set',
  'perm-remove',
];

type MemberSortKey = 'qqNumber' | 'permission' | 'note' | 'addedSince';

/**
 * 等价旧版 maimai2-locks（页④ 操作记录与授权，设计 §8，P≥4）：
 * 卡A 操作记录（EP-14 过滤+分页）；卡B 机台管理授权（EP-15 辖区清单 / EP-16 新增（自动档位：4-6 授→P3，7+ 授→P4）/
 * EP-17 吊销二次确认）；卡C Admin 授权（EP-20 设置 / EP-20L 清单 / EP-20D 删除，P≥7）。
 */
export function Maimai2LocksPage() {
  const { t } = useTranslation();
  const permissionState = useBotPermission();
  const permission = permissionState.permission;
  const ready = permissionState.loaded;
  const canManage = permission >= MANAGE_GRANTS;
  const canAdmin = permission >= MANAGE_PERMISSIONS;

  // ---- 卡A 操作记录 ----
  const [locks, setLocks] = useState<RemoteLockItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterQQ, setFilterQQ] = useState<number | null>(null);
  const [filterKeychip, setFilterKeychip] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterSince, setFilterSince] = useState('');
  const [filterUntil, setFilterUntil] = useState('');

  // ---- 卡B 机台管理授权 ----
  const [grants, setGrants] = useState<GrantItem[]>([]);
  const [cabinets, setCabinets] = useState<CabinetSummary[]>([]);
  const [grantQQ, setGrantQQ] = useState<number | null>(null);
  const [grantNick, setGrantNick] = useState('');
  const [grantSearchQQ, setGrantSearchQQ] = useState<number | null>(null);
  const [grantPage, setGrantPage] = useState(1);
  const [grantPageSize, setGrantPageSize] = useState(PAGE_SIZE);

  // ---- 卡C Admin 授权（P≥7） ----
  const [members, setMembers] = useState<MemberPermissionItem[]>([]);
  const [permQQ, setPermQQ] = useState<number | null>(null);
  const [permLevel, setPermLevel] = useState<number | null>(null);
  const [permNote, setPermNote] = useState('');
  /** 行内备注编辑：当前编辑行的 QQ（一次一行），null = 非编辑态 */
  const [editingNoteQQ, setEditingNoteQQ] = useState<number | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');
  /** 成员表排序：键 + 方向（默认 QQ 升序，服务端默认序） */
  const [memberSortKey, setMemberSortKey] = useState<MemberSortKey>('qqNumber');
  const [memberSortAsc, setMemberSortAsc] = useState(true);
  const [memberPage, setMemberPage] = useState(1);

  const userName = () => getCurrentUser()?.username ?? '';

  /** 档位名标签（i18n：Maimai2.LocksPage.Role*） */
  const roleBandLabel = (value: number) => t(`Maimai2.LocksPage.Role${roleBand(value)}`);
  /** 等级下拉选项文案：`0（无任何权限）` / `3（二级用户）` / `4（机台管理员）` */
  const permLevelLabel = (level: number) => t('Maimai2.LocksPage.PermLevelOptionFormat', { level, band: roleBandLabel(level) });

  // ==================== 卡A：EP-14 ====================

  const loadLocks = useCallback(async (targetPage: number, resetPage = false) => {
    try {
      const params = new URLSearchParams({ page: String(targetPage), size: String(PAGE_SIZE) });
      if (filterQQ != null) params.append('targetQQ', String(filterQQ));
      if (filterKeychip) params.append('fullKeychip', filterKeychip);
      if (filterAction) params.append('action', filterAction);
      if (filterSince) params.append('since', filterSince);
      if (filterUntil) params.append('until', filterUntil);
      const resp = await lcdx.get(`lcdx/cabinet/locks/${encodeURIComponent(userName())}?${params.toString()}`);
      if (isOk(resp)) {
        const data = resp.data as RemoteLockList;
        setLocks(data?.items ?? []);
        setTotal(data?.total ?? 0);
      }
      if (resetPage) {
        setPage(1);
      }
    } catch {
      /* 等价旧版：请求失败保持原列表 */
    }
  }, [filterAction, filterKeychip, filterQQ, filterSince, filterUntil]);

  // ==================== 卡B：EP-15/16/17 ====================

  const loadGrants = useCallback(async () => {
    try {
      const resp = await lcdx.get(`lcdx/cabinet/grants/${encodeURIComponent(userName())}`);
      if (isOk(resp)) {
        const data = resp.data as GrantList;
        setGrants(data?.items ?? []);
      }
    } catch {
      /* 等价旧版：静默 */
    }
  }, []);

  const loadCabinets = useCallback(async () => {
    try {
      const resp = await lcdx.get(`lcdx/cabinet/controllable/${encodeURIComponent(userName())}`);
      if (isOk(resp) && Array.isArray(resp.data)) {
        setCabinets(resp.data as CabinetSummary[]);
      }
    } catch {
      /* 等价旧版：静默 */
    }
  }, []);

  // ==================== 卡C：EP-20/20L/20D（P≥7） ====================

  const loadMembers = useCallback(async () => {
    try {
      const resp = await lcdx.get(`lcdx/cabinet/permissions/${encodeURIComponent(userName())}`);
      if (isOk(resp)) {
        const data = resp.data as MemberPermissionList;
        setMembers(data?.items ?? []);
        setMemberPage(1); // 刷新回到第 1 页
      }
    } catch {
      /* 等价旧版：静默 */
    }
  }, []);

  /** 初次进入（等价旧版 ngOnInit）：探测完成后才判定权限/加载，避免权限未返回时误显示无权限 */
  useEffect(() => {
    if (!ready || !canManage) {
      return;
    }
    void (async () => {
      await loadUser();
      void loadLocks(1);
      void loadGrants();
      void loadCabinets();
      if (canAdmin) {
        void loadMembers();
      }
    })();
  }, [ready, canManage, canAdmin, loadLocks, loadGrants, loadCabinets, loadMembers]);

  /** 刷新后当前页越界（如吊销导致列表变短）时回到第 1 页 */
  const filteredGrants = useMemo(() => {
    if (grantSearchQQ == null) {
      return grants;
    }
    const prefix = String(grantSearchQQ);
    return grants.filter((g) => String(g.qqNumber).startsWith(prefix));
  }, [grants, grantSearchQQ]);

  useEffect(() => {
    if ((grantPage - 1) * grantPageSize >= filteredGrants.length && grantPage > 1) {
      setGrantPage(1);
    }
  }, [filteredGrants.length, grantPage, grantPageSize]);

  const pagedGrants = useMemo(
    () => filteredGrants.slice((grantPage - 1) * grantPageSize, grantPage * grantPageSize),
    [filteredGrants, grantPage, grantPageSize],
  );

  /** 成员表渲染数据：显示层按 ≤ 自身等级过滤（后端 EP-20L 已过滤，双保险）+ 当前排序 */
  const visibleMembers = useMemo(() => {
    const dir = memberSortAsc ? 1 : -1;
    return members
      .filter((m) => m.permission <= permission)
      .sort((a, b) => {
        switch (memberSortKey) {
          case 'permission':
            return (a.permission - b.permission) * dir;
          case 'note':
            return (a.note ?? '').localeCompare(b.note ?? '') * dir;
          case 'addedSince':
            return (a.addedSince ?? '').localeCompare(b.addedSince ?? '') * dir;
          default:
            return (a.qqNumber - b.qqNumber) * dir;
        }
      });
  }, [members, permission, memberSortKey, memberSortAsc]);

  const pagedMembers = useMemo(
    () => visibleMembers.slice((memberPage - 1) * PAGE_SIZE, memberPage * PAGE_SIZE),
    [visibleMembers, memberPage],
  );

  /** 表头点击排序：同列切换方向，换列重置为升序 */
  const setMemberSort = (key: MemberSortKey) => {
    if (memberSortKey === key) {
      setMemberSortAsc((prev) => !prev);
    } else {
      setMemberSortKey(key);
      setMemberSortAsc(true);
    }
  };

  const sortArrow = (key: MemberSortKey) =>
    memberSortKey === key ? (memberSortAsc ? ' ▲' : ' ▼') : '';

  const resultBadge = (result: string) =>
    result === 'success' ? 'text-bg-success' : 'text-bg-danger';

  /** 等级下拉选项：仅 0..自身等级（只能授权别人 ≤ 自己） */
  const permLevelOptions = useMemo(
    () => Array.from({ length: permission + 1 }, (_, index) => index),
    [permission],
  );

  // ==================== 动作 ====================

  const applyFilter = () => {
    setPage(1);
    void loadLocks(1);
  };

  const addGrant = async () => {
    if (grantQQ == null || !grantNick) {
      return;
    }
    try {
      const resp = await lcdx.post('lcdx/cabinet/grants', {
        userName: userName(),
        targetQQNumber: grantQQ,
        nickName: grantNick,
      });
      if (isOk(resp)) {
        notice(t('Maimai2.LocksPage.OperationSuccess'));
        setGrantQQ(null);
        setGrantNick('');
        void loadGrants();
      } else {
        notice(t('Maimai2.LocksPage.OperationFailed'));
      }
    } catch {
      notice(t('Maimai2.LocksPage.OperationFailed'));
    }
  };

  const removeGrant = async (item: GrantItem) => {
    const cabinet = item.nickName || item.fullKeychip;
    if (!window.confirm(t('Maimai2.LocksPage.RevokeConfirm', { qq: item.qqNumber, cabinet }))) {
      return;
    }
    try {
      const resp = await lcdx.delete('lcdx/cabinet/grants', undefined, {
        userName: userName(),
        targetQQNumber: item.qqNumber,
        nickName: item.fullKeychip,
      });
      if (isOk(resp)) {
        notice(t('Maimai2.LocksPage.OperationSuccess'));
        void loadGrants();
      } else {
        notice(t('Maimai2.LocksPage.OperationFailed'));
      }
    } catch {
      notice(t('Maimai2.LocksPage.OperationFailed'));
    }
  };

  const setPermission = async () => {
    if (permQQ == null || permLevel == null) {
      return;
    }
    if (permLevel === ADMIN_PERMISSION && !permNote.trim()) {
      notice(t('Maimai2.LocksPage.PermNoteRequiredError'));
      return;
    }
    try {
      const resp = await lcdx.post('lcdx/cabinet/permissions', {
        userName: userName(),
        targetQQNumber: permQQ,
        permission: permLevel,
        note: permNote || null,
      });
      if (isOk(resp)) {
        notice(t('Maimai2.LocksPage.OperationSuccess'));
        setPermQQ(null);
        setPermLevel(null);
        setPermNote('');
        void loadMembers();
      } else {
        notice(t('Maimai2.LocksPage.OperationFailed'));
      }
    } catch {
      notice(t('Maimai2.LocksPage.OperationFailed'));
    }
  };

  const removePermission = async (member: MemberPermissionItem) => {
    if (!window.confirm(t('Maimai2.LocksPage.RemovePermConfirm', { qq: member.qqNumber }))) {
      return;
    }
    try {
      const resp = await lcdx.delete('lcdx/cabinet/permissions', undefined, {
        userName: userName(),
        targetQQNumber: member.qqNumber,
      });
      if (isOk(resp)) {
        notice(t('Maimai2.LocksPage.OperationSuccess'));
        void loadMembers();
      } else {
        notice(t('Maimai2.LocksPage.OperationFailed'));
      }
    } catch {
      notice(t('Maimai2.LocksPage.OperationFailed'));
    }
  };

  /** 行内备注编辑：进入编辑态 */
  const startNoteEdit = (member: MemberPermissionItem) => {
    setEditingNoteQQ(member.qqNumber);
    setEditingNoteValue(member.note ?? '');
  };

  /** 提交备注：复用 EP-20 upsert，permission 传原值（仅改 Note；后端 AddedSince 不动）。
   *  P10 备注必填（空备注后端会删条目） */
  const submitNoteEdit = async (member: MemberPermissionItem) => {
    if (member.permission === ADMIN_PERMISSION && !editingNoteValue.trim()) {
      notice(t('Maimai2.LocksPage.PermNoteRequiredError'));
      return;
    }
    try {
      const resp = await lcdx.post('lcdx/cabinet/permissions', {
        userName: userName(),
        targetQQNumber: member.qqNumber,
        permission: member.permission,
        note: editingNoteValue || null,
      });
      if (isOk(resp)) {
        notice(t('Maimai2.LocksPage.OperationSuccess'));
        setEditingNoteQQ(null);
        setEditingNoteValue('');
        void loadMembers();
      } else {
        notice(t('Maimai2.LocksPage.OperationFailed'));
      }
    } catch {
      notice(t('Maimai2.LocksPage.OperationFailed'));
    }
  };

  return (
    <>
      <h1 className="page-heading">{t('Maimai2.LocksPage.Title')}</h1>

      {ready && !canManage ? (
        <div className="alert alert-warning">{t('Maimai2.LocksPage.NoPermission')}</div>
      ) : (
        <div className="row">
          {/* 卡A 操作记录 */}
          <div className="col-12 mb-4">
            <div className="card shadow">
              <div className="card-header">
                <h5 className="mb-0">{t('Maimai2.LocksPage.AuditCard')}</h5>
              </div>
              <div className="card-body">
                <div className="row g-2 mb-3">
                  <div className="col-md-2">
                    <input
                      className="form-control"
                      type="number"
                      value={filterQQ ?? ''}
                      onChange={(event) =>
                        setFilterQQ(event.target.value === '' ? null : Number(event.target.value))
                      }
                      placeholder={t('Maimai2.LocksPage.FilterQQ')}
                    />
                  </div>
                  <div className="col-md-2">
                    <input
                      className="form-control"
                      value={filterKeychip}
                      onChange={(event) => setFilterKeychip(event.target.value)}
                      placeholder={t('Maimai2.LocksPage.FilterKeychip')}
                    />
                  </div>
                  <div className="col-md-2">
                    <select
                      className="form-select"
                      value={filterAction}
                      onChange={(event) => setFilterAction(event.target.value)}
                    >
                      <option value="">{t('Maimai2.LocksPage.AllActions')}</option>
                      {ACTIONS.map((action) => (
                        <option key={action} value={action}>
                          {action}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <input
                      className="form-control"
                      type="datetime-local"
                      value={filterSince}
                      onChange={(event) => setFilterSince(event.target.value)}
                    />
                  </div>
                  <div className="col-md-2">
                    <input
                      className="form-control"
                      type="datetime-local"
                      value={filterUntil}
                      onChange={(event) => setFilterUntil(event.target.value)}
                    />
                  </div>
                  <div className="col-md-2">
                    <button className="btn btn-primary w-100" onClick={applyFilter}>
                      {t('Maimai2.LocksPage.Filter')}
                    </button>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle">
                    <thead>
                      <tr>
                        <th>{t('Maimai2.LocksPage.ColTime')}</th>
                        <th>QQ</th>
                        <th>{t('Maimai2.LocksPage.ColAction')}</th>
                        <th>{t('Maimai2.LocksPage.ColCabinet')}</th>
                        <th>{t('Maimai2.LocksPage.ColParams')}</th>
                        <th>{t('Maimai2.LocksPage.ColResult')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locks.map((lock) => (
                        <tr key={`${lock.time}-${lock.qqNumber}-${lock.action}`}>
                          <td className="text-nowrap">{formatFullDateTime(lock.time)}</td>
                          <td>{lock.qqNumber}</td>
                          <td>
                            <code>{lock.action}</code>
                          </td>
                          <td className="text-nowrap">{lock.fullKeychip || '-'}</td>
                          <td
                            className="text-truncate"
                            style={{ maxWidth: 220 }}
                            title={lock.params || ''}
                          >
                            {lock.params || '-'}
                          </td>
                          <td>
                            <span className={`badge ${resultBadge(lock.result)}`}>{lock.result}</span>
                            {lock.detail && (
                              <small
                                className="d-block text-muted text-truncate"
                                style={{ maxWidth: 160 }}
                                title={lock.detail}
                              >
                                {lock.detail}
                              </small>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Maimai2Pagination
                  current={page}
                  pageSize={PAGE_SIZE}
                  totalItems={total}
                  onPageChange={(next) => {
                    setPage(next);
                    void loadLocks(next);
                  }}
                />
              </div>
            </div>
          </div>

          {/* 卡B 机台管理授权 */}
          <div className="col-12 mb-4">
            <div className="card shadow">
              <div className="card-header">
                <h5 className="mb-0">{t('Maimai2.LocksPage.GrantsCard')}</h5>
              </div>
              <div className="card-body">
                <div className="row g-2 mb-3 align-items-end">
                  <div className="col-md-4">
                    <label className="form-label">{t('Maimai2.LocksPage.TargetQQ')}</label>
                    <input
                      className="form-control"
                      type="number"
                      value={grantQQ ?? ''}
                      onChange={(event) =>
                        setGrantQQ(event.target.value === '' ? null : Number(event.target.value))
                      }
                    />
                  </div>
                  <div className="col-md-4 cabinet-select-col">
                    <label className="form-label">{t('Maimai2.Cabinets.SelectCabinet')}</label>
                    <select
                      className="form-select cabinet-select"
                      value={grantNick}
                      onChange={(event) => setGrantNick(event.target.value)}
                    >
                      <option value="" disabled>
                        {t('Maimai2.LocksPage.SelectGrantCabinet')}
                      </option>
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
                    <button
                      className="btn btn-success w-100"
                      disabled={grantQQ == null || !grantNick}
                      onClick={() => void addGrant()}
                    >
                      {t('Maimai2.LocksPage.AddGrant')}
                    </button>
                  </div>
                </div>

                <p className="text-muted small mb-3">{t('Maimai2.LocksPage.GrantAutoTierHint')}</p>

                <div className="row g-2 mb-3">
                  <div className="col-md-4">
                    <input
                      className="form-control"
                      type="number"
                      value={grantSearchQQ ?? ''}
                      onChange={(event) => {
                        setGrantSearchQQ(
                          event.target.value === '' ? null : Number(event.target.value),
                        );
                        setGrantPage(1);
                      }}
                      placeholder={t('Maimai2.LocksPage.SearchQQ')}
                    />
                  </div>
                  <div className="col-md-4">
                    <select
                      className="form-select"
                      value={grantPageSize}
                      onChange={(event) => {
                        setGrantPageSize(Number(event.target.value));
                        setGrantPage(1);
                      }}
                      aria-label={t('Maimai2.LocksPage.PageSize')}
                    >
                      {GRANT_PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle">
                    <thead>
                      <tr>
                        <th>QQ</th>
                        <th>{t('Maimai2.LocksPage.ColCabinet')}</th>
                        <th>{t('Maimai2.LocksPage.ColStatus')}</th>
                        <th>{t('Maimai2.LocksPage.ColGrantedAt')}</th>
                        <th>{t('Maimai2.LocksPage.ColGrantedBy')}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedGrants.map((g) => (
                        <tr
                          className={g.enabled ? undefined : 'table-secondary'}
                          key={`${g.qqNumber}-${g.fullKeychip}-${g.grantedAt}`}
                        >
                          <td>{g.qqNumber}</td>
                          <td className="text-nowrap">{g.nickName || g.fullKeychip}</td>
                          <td>
                            {g.enabled ? (
                              <span className="badge text-bg-success">
                                {t('Maimai2.LocksPage.Enabled')}
                              </span>
                            ) : (
                              <span className="badge text-bg-secondary">
                                {t('Maimai2.LocksPage.Disabled')}
                              </span>
                            )}
                          </td>
                          <td>{formatMinutesDateTime(g.grantedAt)}</td>
                          <td>{g.grantedBy ?? '-'}</td>
                          <td>
                            {g.enabled && permission >= MANAGE_GRANTS && (
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => void removeGrant(g)}
                              >
                                {t('Maimai2.LocksPage.Revoke')}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Maimai2Pagination
                  current={grantPage}
                  pageSize={grantPageSize}
                  totalItems={filteredGrants.length}
                  onPageChange={setGrantPage}
                />
              </div>
            </div>
          </div>

          {/* 卡C Admin 授权（P≥7） */}
          {canAdmin && (
            <div className="col-12 mb-4">
              <div className="card shadow">
                <div className="card-header">
                  <h5 className="mb-0">{t('Maimai2.LocksPage.PermCard')}</h5>
                </div>
                <div className="card-body">
                  <div className="row g-2 mb-3 align-items-end">
                    <div className="col-md-3">
                      <label className="form-label">{t('Maimai2.LocksPage.PermTargetQQ')}</label>
                      <input
                        className="form-control"
                        type="number"
                        value={permQQ ?? ''}
                        onChange={(event) =>
                          setPermQQ(event.target.value === '' ? null : Number(event.target.value))
                        }
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">{t('Maimai2.LocksPage.PermLevel')}</label>
                      <select
                        className="form-select"
                        value={permLevel ?? ''}
                        onChange={(event) =>
                          setPermLevel(event.target.value === '' ? null : Number(event.target.value))
                        }
                      >
                        <option value="" disabled></option>
                        {permLevelOptions.map((level) => (
                          <option key={level} value={level}>
                            {permLevelLabel(level)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">
                        {t(
                          permLevel === ADMIN_PERMISSION
                            ? 'Maimai2.LocksPage.PermNoteRequiredLabel'
                            : 'Maimai2.LocksPage.PermNote',
                        )}
                      </label>
                      <input
                        className="form-control"
                        value={permNote}
                        onChange={(event) => setPermNote(event.target.value)}
                        placeholder={t(
                          permLevel === ADMIN_PERMISSION
                            ? 'Maimai2.LocksPage.PermNoteRequiredPlaceholder'
                            : 'Maimai2.LocksPage.PermNotePlaceholder',
                        )}
                      />
                    </div>
                    <div className="col-md-3">
                      <button
                        className="btn btn-success w-100"
                        disabled={
                          permQQ == null ||
                          permLevel == null ||
                          (permLevel === ADMIN_PERMISSION && !permNote.trim())
                        }
                        onClick={() => void setPermission()}
                      >
                        {t('Maimai2.LocksPage.SetPermission')}
                      </button>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle">
                      <thead>
                        <tr>
                          <th>
                            <span style={{ cursor: 'pointer' }} onClick={() => setMemberSort('qqNumber')}>
                              QQ{sortArrow('qqNumber')}
                            </span>
                          </th>
                          <th>
                            <span
                              style={{ cursor: 'pointer' }}
                              onClick={() => setMemberSort('permission')}
                            >
                              {t('Maimai2.LocksPage.ColPermLevel')}
                              {sortArrow('permission')}
                            </span>
                          </th>
                          <th>
                            <span style={{ cursor: 'pointer' }} onClick={() => setMemberSort('note')}>
                              {t('Maimai2.LocksPage.ColNote')}
                              {sortArrow('note')}
                            </span>
                          </th>
                          <th>
                            <span
                              style={{ cursor: 'pointer' }}
                              onClick={() => setMemberSort('addedSince')}
                            >
                              {t('Maimai2.LocksPage.ColAddedSince')}
                              {sortArrow('addedSince')}
                            </span>
                          </th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedMembers.map((m) => (
                          <tr key={m.qqNumber}>
                            <td>{m.qqNumber}</td>
                            <td>
                              <span className="badge text-bg-secondary">
                                {permLevelLabel(m.permission)}
                              </span>
                            </td>
                            <td>
                              {editingNoteQQ === m.qqNumber ? (
                                <input
                                  className="form-control form-control-sm"
                                  value={editingNoteValue}
                                  onChange={(event) => setEditingNoteValue(event.target.value)}
                                  onKeyUp={(event) => {
                                    if (event.key === 'Enter') {
                                      void submitNoteEdit(m);
                                    }
                                  }}
                                  placeholder={t(
                                    m.permission === ADMIN_PERMISSION
                                      ? 'Maimai2.LocksPage.PermNoteRequiredPlaceholder'
                                      : 'Maimai2.LocksPage.PermNotePlaceholder',
                                  )}
                                />
                              ) : m.permission <= permission ? (
                                <span
                                  className="link-secondary"
                                  role="button"
                                  onClick={() => startNoteEdit(m)}
                                  title={t('Maimai2.LocksPage.EditNoteHint')}
                                >
                                  {m.note ?? '-'}
                                </span>
                              ) : (
                                (m.note ?? '-')
                              )}
                            </td>
                            <td>{formatMinutesDateTime(m.addedSince)}</td>
                            <td>
                              {m.permission < permission && (
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => void removePermission(m)}
                                >
                                  {t('Maimai2.LocksPage.RemovePermission')}
                                </button>
                              )}
                              {editingNoteQQ === m.qqNumber && (
                                <button
                                  className="btn btn-sm btn-outline-primary ms-1"
                                  onClick={() => void submitNoteEdit(m)}
                                >
                                  {t('Maimai2.LocksPage.SubmitNote')}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <Maimai2Pagination
                      current={memberPage}
                      pageSize={PAGE_SIZE}
                      totalItems={visibleMembers.length}
                      onPageChange={setMemberPage}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
