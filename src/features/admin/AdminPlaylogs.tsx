import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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

const GAME_LABELS: Record<AdminPlaylogGame, string> = {
  maimai2: 'maimai DX',
  chunithmV2: 'CHUNITHM V2',
  ongeki: 'O.N.G.E.K.I.',
};

const FIELD_KEYS: Record<AdminPlaylogSearchField, string> = {
  aquaUsername: 'Field.AquaUsername',
  aquaEmail: 'Field.AquaEmail',
  userName: 'Field.UserName',
  extId: 'Field.ExtId',
  accessCode: 'Field.AccessCode',
  keychipId: 'Field.KeychipId',
  id: 'Field.Id',
  playLogId: 'Field.PlayLogId',
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

function PlaylogDetailDialog({ item, onClose }: { item: AdminPlaylogSummary; onClose: () => void }) {
  const { t } = useTranslation();
  const [data, setData] = useState<AdminPlaylogDetail | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    void getPlaylogDetail(item.game, item.id, t('AdminPage.Playlogs.Error.IdOutOfRange')).then(
      (response) => { if (active) setData(response); },
      (reason: unknown) => { if (active) setError(errorText(reason)); },
    );
    return () => { active = false; };
  }, [item.game, item.id, attempt, t]);

  const profile = data?.user.detail;
  const scoreRows = (detail: AdminPlaylogDetail): Array<[string, ReactNode]> => {
    switch (detail.game) {
      case 'maimai2':
        return [
          [t('AdminPage.Playlogs.Score.Achievement'), `${(detail.detail.achievement / 10_000).toFixed(4)}%`],
          [t('AdminPage.Playlogs.Score.DxScore'), detail.detail.deluxscore],
          [t('AdminPage.Playlogs.Score.MaxCombo'), detail.detail.maxCombo],
        ];
      case 'chunithmV2':
        return [
          [t('AdminPage.Playlogs.Score.Score'), detail.detail.score],
          [t('AdminPage.Playlogs.Score.MaxCombo'), detail.detail.maxCombo],
          ['JUSTICE CRITICAL', detail.detail.judgeCritical + detail.detail.judgeHeaven],
          ['JUSTICE / ATTACK / MISS', `${detail.detail.judgeJustice} / ${detail.detail.judgeAttack} / ${detail.detail.judgeGuilty}`],
        ];
      case 'ongeki':
        return [
          [t('AdminPage.Playlogs.Score.TechScore'), detail.detail.techScore],
          [t('AdminPage.Playlogs.Score.BattleScore'), detail.detail.battleScore],
          [t('AdminPage.Playlogs.Score.PlatinumScore'), detail.detail.platinumScore],
          [t('AdminPage.Playlogs.Score.MaxCombo'), detail.detail.maxCombo],
        ];
    }
  };

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
            <h5 className="modal-title">{t('AdminPage.Playlogs.DetailTitle', { game: GAME_LABELS[item.game], id: item.id })}</h5>
          </DialogTitle>
          <button type="button" className="btn-close shadow-none" aria-label={t('AdminPage.Playlogs.CloseDetail')} onClick={onClose} />
        </div>
        <div className="modal-body overflow-y-auto">
          {!data && !error && <p role="status" className="text-secondary mb-0">{t('AdminPage.Playlogs.LoadingDetail')}</p>}
          {error && (
            <div className="alert alert-danger mb-0" role="alert">
              {error}
              <button type="button" className="btn btn-outline-danger btn-sm ms-2" onClick={() => setAttempt(attempt + 1)}>{t('AdminPage.Playlogs.Retry')}</button>
            </div>
          )}
          {data && (
            <>
              <h6>{t('AdminPage.Playlogs.Section.AquaAccount')}</h6>
              {data.aquaAccount ? <InfoTable rows={[
                [t('AdminPage.Playlogs.Field.AccountId'), data.aquaAccount.id],
                [t('AdminPage.Playlogs.Field.LoginName'), data.aquaAccount.username],
                [t('AdminPage.Playlogs.Field.Nickname'), data.aquaAccount.name],
                [t('AdminPage.Playlogs.Field.Email'), data.aquaAccount.email],
              ]} /> : <p className="small text-secondary">{t('AdminPage.Playlogs.NotBoundAqua')}</p>}
              <h6>{t('AdminPage.Playlogs.Section.CurrentProfile')}</h6>
              {profile ? <InfoTable rows={[
                [t('AdminPage.Playlogs.Field.GameUserName'), profile.userName],
                ['ExtId', item.extId],
                [t('AdminPage.Playlogs.Field.MainAccessCode'), profile.accessCode],
                ['Rating', data.game === 'maimai2' ? profile.playerRating : (profile.playerRating / 100).toFixed(2)],
                [t('AdminPage.Playlogs.Field.LastKeychipId'), profile.lastClientId],
                [t('AdminPage.Playlogs.Field.LastPlace'), profile.lastPlaceName],
              ]} /> : <p className="small text-secondary">{t('AdminPage.Playlogs.ProfileGone')}</p>}
              <h6>{t('AdminPage.Playlogs.Section.SinglePlaylog')}</h6>
              <InfoTable rows={[
                [t('AdminPage.Playlogs.Field.DbId'), data.id],
                ...(data.game === 'maimai2' ? [['PlayLog ID', data.playLogId] as [string, ReactNode]] : []),
                [t('AdminPage.Playlogs.Field.MusicId'), data.detail.musicId],
                [t('AdminPage.Playlogs.Field.Level'), data.detail.level],
                [t('AdminPage.Playlogs.Field.PlayDate'), data.detail.playDate],
                [t('AdminPage.Playlogs.Field.UserPlayDate'), data.detail.userPlayDate],
                [t('AdminPage.Playlogs.Field.Place'), data.detail.placeName],
                ...scoreRows(data),
              ]} />
              <details className="border rounded p-2 small">
                <summary>{t('AdminPage.Playlogs.RawJson')}</summary>
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
  const { t } = useTranslation();
  const [game, setGame] = useState<AdminPlaylogGame>('maimai2');
  const [field, setField] = useState<AdminPlaylogSearchField>('extId');
  const [value, setValue] = useState('');
  const [validation, setValidation] = useState('');
  const [query, setQuery] = useState<PlaylogQuery | null>(null);
  const [result, setResult] = useState<ReducedPageResponse<AdminPlaylogSummary> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AdminPlaylogSummary | null>(null);

  const fieldLabel = (key: AdminPlaylogSearchField) => t(`AdminPage.Playlogs.${FIELD_KEYS[key]}`);

  useEffect(() => {
    if (!query) return;
    let active = true;
    setLoading(true);
    setError('');
    setResult(null);
    void searchPlaylogs(query, t('AdminPage.Playlogs.Error.LoadFailed')).then(
      (response) => { if (active) setResult(response); },
      (reason: unknown) => { if (active) setError(errorText(reason)); },
    ).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, t]);

  function search() {
    const trimmed = value.trim();
    if (!trimmed) {
      setValidation(t('AdminPage.Playlogs.Validation.Required'));
      return;
    }
    if (['id', 'extId', 'playLogId'].includes(field) && !/^\d+$/.test(trimmed)) {
      setValidation(t('AdminPage.Playlogs.Validation.Integer', { field: fieldLabel(field) }));
      return;
    }
    setValidation('');
    setQuery({ game, field, value: trimmed, page: 0 });
  }

  return (
    <section aria-label={t('AdminPage.Playlogs.SectionLabel')}>
      <form className="mb-2" onSubmit={(event) => { event.preventDefault(); search(); }}>
        <div className="row g-1 mb-2">
          <div className="col-12 col-sm-3">
            <label className="form-label small" htmlFor="playlog-game">{t('AdminPage.Playlogs.Game')}</label>
            <select id="playlog-game" className="form-select form-select-sm" value={game} onChange={(event) => {
              const next = event.target.value as AdminPlaylogGame;
              setGame(next);
              setValidation('');
              if (next !== 'maimai2' && field === 'playLogId') {
                setField('id');
                setValue('');
              }
            }}>
              {Object.entries(GAME_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div className="col-12 col-sm-3">
            <label className="form-label small" htmlFor="playlog-field">{t('AdminPage.Playlogs.SearchField')}</label>
            <select id="playlog-field" className="form-select form-select-sm" value={field} onChange={(event) => {
              setField(event.target.value as AdminPlaylogSearchField);
              setValidation('');
            }}>
              {(Object.keys(FIELD_KEYS) as AdminPlaylogSearchField[]).filter((key) => key !== 'playLogId' || game === 'maimai2').map((key) => (
                <option key={key} value={key}>{fieldLabel(key)}</option>
              ))}
            </select>
          </div>
          <div className="col-12 col-sm-6">
            <label className="form-label small" htmlFor="playlog-value">{t('AdminPage.Playlogs.SearchValue')}</label>
            <input
              id="playlog-value" className="form-control form-control-sm" placeholder={t('AdminPage.Playlogs.SearchValuePlaceholder')}
              value={value} aria-invalid={Boolean(validation)} aria-describedby={validation ? 'playlog-validation' : undefined}
              inputMode={['id', 'extId', 'playLogId'].includes(field) ? 'numeric' : 'text'}
              onChange={(event) => { setValue(event.target.value); setValidation(''); }}
            />
          </div>
        </div>
        {field === 'keychipId' && <p className="small text-secondary mb-2">{t('AdminPage.Playlogs.Hint.KeychipId')}</p>}
        {field === 'accessCode' && <p className="small text-secondary mb-2">{t('AdminPage.Playlogs.Hint.AccessCode')}</p>}
        {field === 'userName' && <p className="small text-secondary mb-2">{t('AdminPage.Playlogs.Hint.UserName')}</p>}
        {validation && <p className="small text-danger mb-2" id="playlog-validation" role="alert">{validation}</p>}
        <button type="submit" className="btn btn-primary btn-sm w-100">{t('AdminPage.Playlogs.Search')}</button>
      </form>

      {!query && <p className="small text-secondary">{t('AdminPage.Playlogs.Prompt')}</p>}
      {query && <p className="small text-secondary text-break mb-2">{GAME_LABELS[query.game]} · {fieldLabel(query.field)}{t('Common.Colon')}{query.value}</p>}
      {loading && <p role="status" className="small text-secondary">{t('AdminPage.Playlogs.Searching')}</p>}
      {error && <div className="alert alert-danger" role="alert">
        {error}
        <button type="button" className="btn btn-outline-danger btn-sm ms-2" onClick={() => { if (query) setQuery({ ...query }); }}>{t('AdminPage.Playlogs.Retry')}</button>
      </div>}
      {result && query && (
        <>
          <p className="small text-secondary mb-2" role="status">{t('AdminPage.Playlogs.Total', { count: result.totalElements })}</p>
          {result.content.length === 0 ? <div className="card"><div className="card-body small text-secondary">{t('AdminPage.Playlogs.NoRecords')}</div></div> : (
            <div className="card mb-2">
              <div className="table-responsive">
                <table className="table table-sm table-hover small mb-0 align-middle" style={{ minWidth: 960 }}>
                  <thead className="text-nowrap"><tr>
                    <th>{t('AdminPage.Playlogs.Column.DbId')}</th>
                    <th>{t('AdminPage.Playlogs.Column.User')}</th>
                    <th>{t('AdminPage.Playlogs.Column.Card')}</th>
                    <th>{t('AdminPage.Playlogs.Column.LastKeychip')}</th>
                    <th>{t('AdminPage.Playlogs.Column.Music')}</th>
                    <th>{t('AdminPage.Playlogs.Column.PlayDate')}</th>
                    <th>{t('AdminPage.Playlogs.Column.Actions')}</th>
                  </tr></thead>
                  <tbody>{result.content.map((item) => <tr key={`${item.game}-${item.id}`}>
                    <td className="text-nowrap">
                      {item.id}
                      {item.game === 'maimai2' && <div className="text-secondary">{t('AdminPage.Playlogs.PlayLogIdLabel', { id: item.playLogId ?? '—' })}</div>}
                    </td>
                    <td className="text-break" style={{ minWidth: 160 }}>
                      <div>{item.userName ?? '—'}</div>
                      {item.aquaAccount ? <div className="text-secondary">{t('AdminPage.Playlogs.AquaLabel', { username: item.aquaAccount.username })}<br />{item.aquaAccount.email}</div> : <span className="text-secondary">{t('AdminPage.Playlogs.NotBoundAqua')}</span>}
                    </td>
                    <td className="text-nowrap">{t('AdminPage.Playlogs.ExtIdLabel', { id: item.extId ?? '—' })}<div className="font-monospace">{item.accessCode ?? '—'}</div></td>
                    <td className="text-nowrap">{item.lastClientId ?? '—'}</td>
                    <td>{item.musicId} / {item.level}</td>
                    <td className="text-nowrap">{item.playDate ?? item.userPlayDate ?? '—'}</td>
                    <td><button type="button" className="btn btn-outline-primary btn-sm text-nowrap" aria-label={t('AdminPage.Playlogs.ViewDetail', { id: item.id })} onClick={() => setSelected(item)}>{t('AdminPage.Playlogs.Detail')}</button></td>
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
