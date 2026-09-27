import { useEffect, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Pagination } from '@/components/shared/Pagination';
import type {
  AdminPlaylogDetail,
  AdminPlaylogGame,
  AdminPlaylogSearchField,
  AdminPlaylogSummary,
  ReducedPageResponse,
} from '@/lib/api/admin-playlog-contracts';
import { getPlaylogDetail, PLAYLOG_PAGE_SIZE, searchPlaylogs, type PlaylogQuery } from './playlogs';

const GAMES: Record<AdminPlaylogGame, string> = {
  maimai2: 'maimai DX',
  chunithmV2: 'CHUNITHM V2',
  ongeki: 'O.N.G.E.K.I.',
};

const FIELDS: Record<AdminPlaylogSearchField, string> = {
  aquaUsername: 'Aqua 用户名',
  aquaEmail: 'Aqua 邮箱',
  userName: '游戏内用户名',
  extId: 'ExtId',
  accessCode: '卡号 / Access Code',
  keychipId: 'Keychip ID',
  id: '数据库 Playlog ID',
  playLogId: 'Maimai2 PlayLog ID',
};

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function InfoTable({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <div className="table-responsive mb-3">
      <table className="table table-sm small mb-0"><tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th scope="row" className="text-nowrap text-secondary fw-normal">{label}</th>
            <td className="text-break">{value ?? '—'}</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}

function scoreRows(data: AdminPlaylogDetail): Array<[string, ReactNode]> {
  switch (data.game) {
    case 'maimai2':
      return [
        ['达成率', `${(data.detail.achievement / 10_000).toFixed(4)}%`],
        ['DX 分数', data.detail.deluxscore],
        ['最大连击', data.detail.maxCombo],
      ];
    case 'chunithmV2':
      return [
        ['分数', data.detail.score],
        ['最大连击', data.detail.maxCombo],
        ['JUSTICE CRITICAL', data.detail.judgeCritical + data.detail.judgeHeaven],
        ['JUSTICE / ATTACK / MISS', `${data.detail.judgeJustice} / ${data.detail.judgeAttack} / ${data.detail.judgeGuilty}`],
      ];
    case 'ongeki':
      return [
        ['技术分', data.detail.techScore],
        ['战斗分', data.detail.battleScore],
        ['白金分', data.detail.platinumScore],
        ['最大连击', data.detail.maxCombo],
      ];
  }
}

function PlaylogDetailDialog({ item, onClose }: { item: AdminPlaylogSummary; onClose: () => void }) {
  const [data, setData] = useState<AdminPlaylogDetail | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    void getPlaylogDetail(item.game, item.id).then(
      (response) => { if (active) setData(response); },
      (reason: unknown) => { if (active) setError(errorText(reason)); },
    );
    return () => { active = false; };
  }, [item.game, item.id, attempt]);

  const profile = data?.user.detail;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        aria-describedby={undefined}
        className="admin-dialog-content compat-modal compat-lg compat-scrollable bg-popover text-popover-foreground"
        overlayClassName="admin-dialog-overlay modal-backdrop fade show"
        overlayUnstyled
        showCloseButton={false}
      >
        <div className="modal-header flex-shrink-0">
          <DialogTitle asChild unstyled>
            <h5 className="modal-title">{GAMES[item.game]} · 游玩记录 {item.id}</h5>
          </DialogTitle>
          <button type="button" className="btn-close shadow-none" aria-label="关闭游玩记录详情" onClick={onClose} />
        </div>
        <div className="modal-body overflow-y-auto">
          {!data && !error && <p role="status" className="text-secondary mb-0">正在加载详情…</p>}
          {error && (
            <div className="alert alert-danger mb-0" role="alert">
              {error}
              <button type="button" className="btn btn-outline-danger btn-sm ms-2" onClick={() => setAttempt(attempt + 1)}>重试</button>
            </div>
          )}
          {data && (
            <>
              <h6>Aqua 账户</h6>
              {data.aquaAccount ? <InfoTable rows={[
                ['账户 ID', data.aquaAccount.id], ['登录名', data.aquaAccount.username],
                ['昵称', data.aquaAccount.name], ['邮箱', data.aquaAccount.email],
              ]} /> : <p className="small text-secondary">未绑定 Aqua</p>}
              <h6>游戏用户资料（当前）</h6>
              {profile ? <InfoTable rows={[
                ['游戏内用户名', profile.userName], ['ExtId', item.extId],
                ['主卡 Access Code', profile.accessCode],
                ['Rating', data.game === 'maimai2' ? profile.playerRating : (profile.playerRating / 100).toFixed(2)],
                ['最近 Keychip ID', profile.lastClientId], ['最近店铺', profile.lastPlaceName],
              ]} /> : <p className="small text-secondary">游戏资料已不存在</p>}
              <h6>单曲游玩记录</h6>
              <InfoTable rows={[
                ['数据库 ID', data.id],
                ...(data.game === 'maimai2' ? [['PlayLog ID', data.playLogId] as [string, ReactNode]] : []),
                ['曲目 ID', data.detail.musicId], ['谱面难度值', data.detail.level],
                ['游玩时间', data.detail.playDate], ['用户游玩时间', data.detail.userPlayDate],
                ['游玩店铺', data.detail.placeName], ...scoreRows(data),
              ]} />
              <details className="border rounded p-2 small">
                <summary>完整 JSON</summary>
                <pre className="small mb-0 mt-2">{JSON.stringify(data, null, 2)}</pre>
              </details>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AdminPlaylogs() {
  const [game, setGame] = useState<AdminPlaylogGame>('maimai2');
  const [field, setField] = useState<AdminPlaylogSearchField>('extId');
  const [value, setValue] = useState('');
  const [validation, setValidation] = useState('');
  const [query, setQuery] = useState<PlaylogQuery | null>(null);
  const [result, setResult] = useState<ReducedPageResponse<AdminPlaylogSummary> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AdminPlaylogSummary | null>(null);

  useEffect(() => {
    if (!query) return;
    let active = true;
    setLoading(true);
    setError('');
    setResult(null);
    void searchPlaylogs(query).then(
      (response) => { if (active) setResult(response); },
      (reason: unknown) => { if (active) setError(errorText(reason)); },
    ).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);

  function search() {
    const trimmed = value.trim();
    if (!trimmed) {
      setValidation('请输入查询值');
      return;
    }
    if (['id', 'extId', 'playLogId'].includes(field) && !/^\d+$/.test(trimmed)) {
      setValidation(`${FIELDS[field]} 必须是十进制整数`);
      return;
    }
    setValidation('');
    setQuery({ game, field, value: trimmed, page: 0 });
  }

  return (
    <section aria-label="游玩记录查询">
      <form className="mb-2" onSubmit={(event) => { event.preventDefault(); search(); }}>
        <div className="row g-1 mb-2">
          <div className="col-12 col-sm-3">
            <label className="form-label small" htmlFor="playlog-game">游戏</label>
            <select id="playlog-game" className="form-select form-select-sm" value={game} onChange={(event) => {
              const next = event.target.value as AdminPlaylogGame;
              setGame(next);
              setValidation('');
              if (next !== 'maimai2' && field === 'playLogId') {
                setField('id');
                setValue('');
              }
            }}>
              {Object.entries(GAMES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div className="col-12 col-sm-3">
            <label className="form-label small" htmlFor="playlog-field">查询条件</label>
            <select id="playlog-field" className="form-select form-select-sm" value={field} onChange={(event) => {
              setField(event.target.value as AdminPlaylogSearchField);
              setValidation('');
            }}>
              {Object.entries(FIELDS).filter(([key]) => key !== 'playLogId' || game === 'maimai2').map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="col-12 col-sm-6">
            <label className="form-label small" htmlFor="playlog-value">查询值</label>
            <input
              id="playlog-value" className="form-control form-control-sm" placeholder="输入查询值"
              value={value} aria-invalid={Boolean(validation)} aria-describedby={validation ? 'playlog-validation' : undefined}
              inputMode={['id', 'extId', 'playLogId'].includes(field) ? 'numeric' : 'text'}
              onChange={(event) => { setValue(event.target.value); setValidation(''); }}
            />
          </div>
        </div>
        {field === 'keychipId' && <p className="small text-secondary mb-2">按游戏资料当前的最近 Keychip 查询，不代表每条记录的历史游玩设备。</p>}
        {field === 'accessCode' && <p className="small text-secondary mb-2">可使用主卡号或关联卡号查询，结果显示主卡号。</p>}
        {field === 'userName' && <p className="small text-secondary mb-2">游戏内用户名支持包含匹配，忽略大小写。</p>}
        {validation && <p className="small text-danger mb-2" id="playlog-validation" role="alert">{validation}</p>}
        <button type="submit" className="btn btn-primary btn-sm w-100">查询记录</button>
      </form>

      {!query && <p className="small text-secondary">请选择条件并输入查询值。</p>}
      {query && <p className="small text-secondary text-break mb-2">{GAMES[query.game]} · {FIELDS[query.field]}：{query.value}</p>}
      {loading && <p role="status" className="small text-secondary">正在查询…</p>}
      {error && <div className="alert alert-danger" role="alert">
        {error}
        <button type="button" className="btn btn-outline-danger btn-sm ms-2" onClick={() => { if (query) setQuery({ ...query }); }}>重试</button>
      </div>}
      {result && query && (
        <>
          <p className="small text-secondary mb-2" role="status">共 {result.totalElements} 条记录</p>
          {result.content.length === 0 ? <div className="card"><div className="card-body small text-secondary">未找到记录</div></div> : (
            <div className="card mb-2">
              <div className="table-responsive">
                <table className="table table-sm table-hover small mb-0 align-middle" style={{ minWidth: 960 }}>
                  <thead className="text-nowrap"><tr>
                    <th>数据库 ID</th><th>游戏用户 / Aqua 账户</th><th>卡片</th><th>最近 Keychip</th>
                    <th>曲目 / 难度值</th><th>游玩时间</th><th>操作</th>
                  </tr></thead>
                  <tbody>{result.content.map((item) => <tr key={`${item.game}-${item.id}`}>
                    <td className="text-nowrap">
                      {item.id}
                      {item.game === 'maimai2' && <div className="text-secondary">PlayLog ID：{item.playLogId ?? '—'}</div>}
                    </td>
                    <td className="text-break" style={{ minWidth: 160 }}>
                      <div>{item.userName ?? '—'}</div>
                      {item.aquaAccount ? <div className="text-secondary">Aqua：{item.aquaAccount.username}<br />{item.aquaAccount.email}</div> : <span className="text-secondary">未绑定 Aqua</span>}
                    </td>
                    <td className="text-nowrap">ExtId：{item.extId ?? '—'}<div className="font-monospace">{item.accessCode ?? '—'}</div></td>
                    <td className="text-nowrap">{item.lastClientId ?? '—'}</td>
                    <td>{item.musicId} / {item.level}</td>
                    <td className="text-nowrap">{item.playDate ?? item.userPlayDate ?? '—'}</td>
                    <td><button type="button" className="btn btn-outline-primary btn-sm text-nowrap" aria-label={`查看详情 ${item.id}`} onClick={() => setSelected(item)}>详情</button></td>
                  </tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
          <Pagination current={result.page + 1} pageSize={PLAYLOG_PAGE_SIZE} totalItems={result.totalElements} onPageChange={(page) => setQuery({ ...query, page: page - 1 })} />
        </>
      )}
      {selected && <PlaylogDetailDialog key={`${selected.game}-${selected.id}`} item={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
