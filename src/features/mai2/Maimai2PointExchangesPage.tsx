import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { getCurrentUser, loadUser } from '@/lib/user';
import { maiAssetsHost, enableImages } from '@/lib/utils';
import {
  MAIMAI2_EXCHANGE_TYPES,
  exchangeTypeKey,
  exchangeTypeLabel,
  type ApiResponse,
  type Maimai2ExchangeItem,
  type Maimai2ExchangeItemList,
  type Maimai2ServerMissionPointData,
  type Maimai2ServerMissionPointInfo,
  type Maimai2UserExchangeInfo,
  type Maimai2UserExchangeItem,
} from './server-mission-models';
import './Maimai2PointExchangesPage.css';
import { translate } from '@/lib/i18n';

const PAGE_SIZE = 20;
const EMPTY_POINTS: Maimai2ServerMissionPointData = { totalPoints: 0, availablePoints: 0 };

function responseData<T>(response: ApiResponse<T>): T | null {
  if (response?.status?.code === 92001 && response.data) return response.data;
  notice(translate('Common.OperationFailed'));
  return null;
}

function itemTypeClass(item: Maimai2ExchangeItem): string {
  const key = exchangeTypeKey(item.itemType);
  return key ? `bg-${key === 'KaleidxScopeKey' ? 'kaleidxScopeKey' : key.toLowerCase()}` : 'bg-unknown';
}

function cardSizeClass(item: Maimai2ExchangeItem): string {
  const value = MAIMAI2_EXCHANGE_TYPES.find((entry) => entry.key === exchangeTypeKey(item.itemType))?.value;
  return value ? `col-type-${value}` : 'card-size-default';
}

function exchangeImage(item: Maimai2ExchangeItem): string {
  const key = exchangeTypeKey(item.itemType);
  let prefix = 'UI_Icon_';
  let directory = 'icon';
  let specialPath: string | null = null;

  switch (key) {
    case 'Plate':
      prefix = 'UI_Plate_';
      directory = 'nameplate';
      break;
    case 'Title':
      specialPath = 'assets/mai2/common/UI_CLC_Base_GetUserTitle.webp';
      break;
    case 'Icon':
      break;
    case 'Present':
      specialPath = 'assets/mai2/common/UI_CHR_Icon_Present.webp';
      break;
    case 'Character':
      prefix = 'UI_Chara_';
      directory = 'chara';
      break;
    case 'Partner':
      prefix = 'UI_Partner_';
      directory = 'partner';
      break;
    case 'Frame':
      prefix = 'UI_Frame_';
      directory = 'frame';
      break;
    case 'Ticket':
      specialPath = 'assets/mai2/common/UI_CMN_Tix_LinkTix_L.webp';
      break;
    case 'Mile':
      specialPath = 'assets/mai2/common/UI_CLC_Maimile.webp';
      break;
    case 'KaleidxScopeKey':
      specialPath = `assets/mai2/common/UI_KLD_DiscoverCourseKey_0${item.itemId}.webp`;
      break;
    case 'DXPass':
      specialPath = `assets/mai2/common/dxpass_${item.itemId}.webp`;
      break;
  }

  if (specialPath) return `${maiAssetsHost}${specialPath}`;
  return `${maiAssetsHost}assets/mai2/${directory}/${prefix}${String(item.itemId).padStart(6, '0')}.webp`;
}

function ExchangeConfirmDialog({
  item,
  points,
  onCancel,
  onConfirm,
}: {
  item: Maimai2ExchangeItem | null;
  points: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        aria-describedby={undefined}
        className="maimai2-point-exchange-confirm-dialog d-block modal fade show"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        overlayClassName="maimai2-point-exchange-confirm-overlay modal-backdrop fade show"
        overlayUnstyled
        showCloseButton={false}
        unstyled
      >
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header bg-dark text-light border-secondary">
              <DialogTitle asChild unstyled>
                <h5 className="modal-title">{t('Maimai2.PointExchangesPage.ConfirmExchange')}</h5>
              </DialogTitle>
              <button
                type="button"
                className="btn-close btn-close-white"
                aria-label="Close"
                onClick={onCancel}
              />
            </div>
            <div className="modal-body bg-dark text-light">
              {item && (
                <div className="exchange-confirm">
                  <div className="d-flex align-items-center mb-4">
                    <div className="flex-shrink-0 me-3">
                      <div className="placeholder-image d-flex justify-content-center align-items-center bg-dark border-secondary rounded">
                        <i className="bi bi-box-seam fs-2 text-secondary" />
                      </div>
                    </div>
                    <div className="flex-grow-1">
                      <h5 className="mb-1">{item.name}</h5>
                      <p className="small text-secondary mb-0">
                        {item.description.split('\n').map((line, index, lines) => (
                          <span key={`${line}-${index}`}>
                            {line}
                            {index < lines.length - 1 && <br />}
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                  <div className="info-row d-flex justify-content-between mb-2 p-2 bg-dark border-secondary rounded">
                    <span>{t('Maimai2.PointExchangesPage.ExchangeCount')}</span>
                    <span className="fw-bold">{item.itemCount} {t('Maimai2.PointExchangesPage.ItemsSuffix')}</span>
                  </div>
                  <div className="info-row d-flex justify-content-between mb-2 p-2 bg-dark border-secondary rounded">
                    <span>{t('Maimai2.PointExchangesPage.RequiredPoints')}</span>
                    <span className="fw-bold text-warning">{item.costPoints} {t('Maimai2.PointExchangesPage.PointsSuffix')}</span>
                  </div>
                  {item.stockCount >= 0 && (
                    <div className="info-row d-flex justify-content-between mb-2 p-2 bg-dark border-secondary rounded">
                      <span>{t('Maimai2.PointExchangesPage.Stock')}</span>
                      <span className="fw-bold">{item.exchangedCount} / {item.stockCount}</span>
                    </div>
                  )}
                  <div className="info-row d-flex justify-content-between p-2 bg-dark border-secondary rounded">
                    <span>{t('Maimai2.PointExchangesPage.RemainingAfter')}</span>
                    <span className="fw-bold text-danger">{points - item.costPoints} {t('Maimai2.PointExchangesPage.PointsSuffix')}</span>
                  </div>
                  <div className="alert alert-warning mt-3 mb-0" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-2" />
                    {t('Maimai2.PointExchangesPage.ConfirmUse', { points: item.costPoints })}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer bg-dark border-secondary">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
                {t('Common.Cancel')}
              </button>
              {item && (
                <button type="button" className="btn btn-success" onClick={onConfirm}>
                  {t('Maimai2.PointExchangesPage.ConfirmExchange')}
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Maimai2PointExchangesPanel({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();
  const [aimeId, setAimeId] = useState('');
  const [items, setItems] = useState<Maimai2ExchangeItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [filterItemType, setFilterItemType] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [onlyEnable, setOnlyEnable] = useState(true);
  const [points, setPoints] = useState<Maimai2ServerMissionPointData>(EMPTY_POINTS);
  const [userExchangeInfo, setUserExchangeInfo] = useState<Map<number, Maimai2UserExchangeItem>>(new Map());
  const [selectedItem, setSelectedItem] = useState<Maimai2ExchangeItem | null>(null);

  async function loadPoints(id: string) {
    try {
      const response = (await api.get('api/game/maimai2/userServerMissionPointInfo', {
        aimeId: id,
        page: 0,
        size: 1,
      })) as ApiResponse<Maimai2ServerMissionPointInfo>;
      const data = responseData(response);
      if (data) setPoints(data.userPointData);
    } catch (error) {
      notice(translate('Common.OperationFailed'));
    }
  }

  async function loadUserExchangeInfo(id: string) {
    try {
      const response = (await api.get('api/game/maimai2/userExchangeItemDataInfo', {
        aimeId: id,
      })) as ApiResponse<Maimai2UserExchangeInfo>;
      const data = responseData(response);
      if (data) {
        setUserExchangeInfo(new Map(data.exchangeItemDataList.map((entry) => [entry.exchangedItemDataId, entry])));
      }
    } catch (error) {
      notice(translate('Common.OperationFailed'));
    }
  }

  async function loadItems(
    id: string,
    requestedPage: number,
    options: { type?: number | null; search?: string; enabled?: boolean } = {},
  ) {
    const type = options.type === undefined ? filterItemType : options.type;
    const search = options.search === undefined ? searchKeyword : options.search;
    const enabled = options.enabled === undefined ? onlyEnable : options.enabled;
    try {
      const response = (await api.get('api/game/maimai2/exchangeItemDataList', {
        aimeId: id,
        page: requestedPage,
        size: PAGE_SIZE,
        onlyEnable: enabled,
        filterItemType: type ?? 0,
        searchPattern: search,
      })) as ApiResponse<Maimai2ExchangeItemList>;
      const data = responseData(response);
      if (data) {
        setItems(data.filterExchangeItemDataList);
        setPage(requestedPage);
        setTotalCount(data.filterListTotalCount);
      }
    } catch (error) {
      notice(translate('Common.OperationFailed'));
    }
  }

  async function loadAll(id: string, requestedPage: number) {
    await Promise.all([
      loadItems(id, requestedPage),
      loadUserExchangeInfo(id),
      loadPoints(id),
    ]);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await loadUser();
        if (!active) return;
        const id = String(getCurrentUser()?.defaultCard?.extId ?? '');
        setAimeId(id);
        await loadAll(id, 0);
      } catch (error) {
        if (active) notice(translate('Common.OperationFailed'));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const userExchangeCount = (itemId: number) => userExchangeInfo.get(itemId)?.exchangedTotalCount ?? 0;

  function canExchange(item: Maimai2ExchangeItem): boolean {
    if (!item.enable) return false;
    if (item.limitCount >= 0 && userExchangeCount(item.id) >= item.limitCount) return false;
    if (item.stockCount >= 0 && item.exchangedCount >= item.stockCount) return false;
    return points.availablePoints >= item.costPoints;
  }

  function cannotExchangeReason(item: Maimai2ExchangeItem): string {
    if (!item.enable) return t('Maimai2.PointExchangesPage.Reason.NotOpened');
    if (item.limitCount >= 0 && userExchangeCount(item.id) >= item.limitCount) return t('Maimai2.PointExchangesPage.Reason.LimitReached');
    if (item.stockCount >= 0 && item.exchangedCount >= item.stockCount) return t('Maimai2.PointExchangesPage.Reason.OutOfStock');
    if (points.availablePoints < item.costPoints) return t('Maimai2.PointExchangesPage.Reason.NotEnoughPoints');
    return t('Maimai2.PointExchangesPage.Reason.Unavailable');
  }

  const maxPage = Math.ceil(totalCount / PAGE_SIZE) - 1;
  const pageNumbers = useMemo(() => {
    const numbers: number[] = [];
    const start = Math.max(0, page - 2);
    const end = Math.min(maxPage, page + 2);
    for (let value = start; value <= end; value += 1) numbers.push(value);
    return numbers;
  }, [maxPage, page]);

  function applyFilter() {
    void loadItems(aimeId, 0);
  }

  function handleSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') applyFilter();
  }

  async function confirmExchange() {
    if (!selectedItem) return;
    const exchanged = selectedItem;
    setSelectedItem(null);
    try {
      const response = (await api.post('api/game/maimai2/exchangeItem', {
        aimeId,
        exchangeId: exchanged.id,
      })) as ApiResponse<boolean>;
      if (response?.status?.code === 92001) {
        notice(translate('Maimai2.PointExchangesPage.ExchangeSuccess', { name: exchanged.name }), 'success');
        await loadAll(aimeId, page);
      } else {
        responseData(response);
      }
    } catch (error) {
      notice(translate('Common.OperationFailed'));
    }
  }

  return (
    <div className="maimai2-point-exchanges-page container-fluid mt-3">
      <div className="row mb-3">
        <div className="col-12">
          <div className="card bg-dark border-secondary">
            <div className="card-header bg-dark text-light border-secondary d-flex justify-content-between align-items-center">
              <h4 className="mb-0">{t('Maimai2.PointExchangesPage.PageTitle')}</h4>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger btn-outline-secondary"
                onClick={() => onClose?.()}
              >
                <i className="bi bi-x-lg" /> {t('Maimai2.PointExchangesPage.Close')}
              </button>
            </div>
            <div className="card-body">
              <div className="row align-items-end">
                <div className="col-md-6">
                  <label className="form-label text-light fw-bold">{t('Maimai2.PointExchangesPage.TypeFilter')}</label>
                  <select
                    className="form-select bg-dark text-light border-secondary"
                    value={filterItemType ?? ''}
                    onChange={(event) => {
                      const type = event.target.value === '' ? null : Number(event.target.value);
                      setFilterItemType(type);
                      void loadItems(aimeId, 0, { type });
                    }}
                  >
                    <option value="">{t('Maimai2.PointExchangesPage.AllTypes')}</option>
                    {MAIMAI2_EXCHANGE_TYPES.map((type) => (
                      <option value={type.value} key={type.value}>{exchangeTypeLabel(type.key)}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6 text-end text-light">
                  <span className="me-3">{t('Maimai2.PointExchangesPage.MyPoints')} <span>{points.availablePoints}</span></span>
                </div>
              </div>
              <div className="row align-items-end mt-2">
                <div className="col-md-8">
                  <label className="form-label text-light fw-bold">{t('Maimai2.PointExchangesPage.SearchLabel')}</label>
                  <div className="input-group">
                    <span className="input-group-text bg-dark text-light border-secondary"><i className="bi bi-search" /></span>
                    <input
                      type="text"
                      className="form-control bg-dark text-light border-secondary"
                      placeholder={t('Maimai2.PointExchangesPage.SearchPlaceholder')}
                      value={searchKeyword}
                      onChange={(event) => setSearchKeyword(event.target.value)}
                      onKeyUp={handleSearchKey}
                    />
                  </div>
                </div>
                <div className="col-md-4 d-flex align-items-end">
                  <div className="form-check form-switch hide-completed-toggle">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="onlyEnable"
                      checked={onlyEnable}
                      onChange={(event) => setOnlyEnable(event.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="onlyEnable">{t('Maimai2.PointExchangesPage.OnlyExchangeable')}</label>
                  </div>
                  <button className="btn btn-outline-primary w-50" onClick={applyFilter}>
                    <i className="bi bi-filter" /> {t('Maimai2.PointExchangesPage.ApplyFilter')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-4 mb-3">
        {items.map((item) => (
          <div className={`col ${cardSizeClass(item)}`} key={item.id}>
            <div className="card h-100 bg-dark text-light border-secondary exchange-card">
              <div
                className="card-img-top d-flex justify-content-center align-items-center p-3 bg-dark"
                style={{ minHeight: 120, height: 140 }}
              >
                {enableImages ? (
                  <img
                    src={exchangeImage(item)}
                    className="img-fluid exchange-item-img"
                    style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }}
                    alt={item.name}
                  />
                ) : (
                  <div
                    className="placeholder-image d-flex justify-content-center align-items-center"
                    style={{ maxWidth: '100%', maxHeight: '100%', width: 80, height: 80 }}
                  >
                    <i className="bi bi-box-seam fs-1 text-secondary" />
                  </div>
                )}
              </div>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <h5 className="card-title text-truncate mb-0" title={item.name}>{item.name}</h5>
                  <span className={`badge ${itemTypeClass(item)}`}>{exchangeTypeLabel(item.itemType)}</span>
                </div>
                <p className="card-text small text-secondary-emphasis text-truncate-2 mb-2" title={item.description}>
                  {item.description || t('Maimai2.PointExchangesPage.NoDescription')}
                </p>
                <div className="item-details small">
                  <div className="d-flex justify-content-between mb-1"><span>{t('Maimai2.PointExchangesPage.ExchangeObtained')}</span><span className="fw-bold">{item.itemCount} {t('Maimai2.PointExchangesPage.ItemsSuffix')}</span></div>
                  <div className="d-flex justify-content-between mb-1"><span>{t('Maimai2.PointExchangesPage.PointsRequired')}</span><span className="fw-bold text-warning">{item.costPoints} {t('Maimai2.PointExchangesPage.PointsSuffix')}</span></div>
                  {item.limitCount >= 0 && (
                    <div className="d-flex justify-content-between mb-1">
                      <span>{t('Maimai2.PointExchangesPage.AlreadyExchanged')}</span>
                      <span className="fw-bold">{userExchangeCount(item.id)} / {item.limitCount === -1 ? '∞' : item.limitCount}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="card-footer bg-transparent border-secondary">
                {canExchange(item) ? (
                  <button className="btn btn-outline-success w-100 fw-bold" onClick={() => setSelectedItem(item)}>{t('Maimai2.PointExchangesPage.Exchange')}</button>
                ) : (
                  <button className="btn btn-secondary w-100" disabled>
                    <i className="bi bi-lock-fill me-2" />{cannotExchangeReason(item)}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="row mt-5">
          <div className="col-12 text-center text-light py-5">
            <i className="bi bi-inbox fs-1 d-block mb-3" />
            <h5>{t('Maimai2.PointExchangesPage.NoItems')}</h5>
            <p className="text-secondary">{t('Maimai2.PointExchangesPage.NoItemsFiltered')}</p>
          </div>
        </div>
      )}

      {totalCount > PAGE_SIZE && (
        <div className="row mt-4">
          <div className="col-12">
            <nav aria-label={t('Maimai2.PointExchangesPage.PaginationLabel')}>
              <ul className="pagination justify-content-center">
                <li className={`page-item${page === 0 ? ' disabled' : ''}`}>
                  <a className="page-link bg-dark text-light border-secondary" onClick={() => page > 0 && void loadItems(aimeId, page - 1)}>
                    <span aria-hidden="true">«</span>
                  </a>
                </li>
                {pageNumbers.map((number) => (
                  <li className={`page-item${number === page ? ' active' : ''}`} key={number}>
                    <a
                      className={`page-link ${number === page ? 'bg-primary text-white' : 'bg-dark text-light border-secondary'}`}
                      onClick={() => void loadItems(aimeId, number)}
                    >
                      {number + 1}
                    </a>
                  </li>
                ))}
                <li className={`page-item${page >= maxPage ? ' disabled' : ''}`}>
                  <a className="page-link bg-dark text-light border-secondary" onClick={() => page < maxPage && void loadItems(aimeId, page + 1)}>
                    <span aria-hidden="true">»</span>
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      )}

      <ExchangeConfirmDialog
        item={selectedItem}
        points={points.availablePoints}
        onCancel={() => setSelectedItem(null)}
        onConfirm={() => void confirmExchange()}
      />
    </div>
  );
}

export function Maimai2PointExchangesDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="maimai2-point-exchange-outer-dialog d-block modal fade show"
        onInteractOutside={(event) => event.preventDefault()}
        overlayClassName="maimai2-point-exchange-outer-overlay modal-backdrop fade show"
        overlayUnstyled
        showCloseButton={false}
        unstyled
      >
        <DialogTitle className="visually-hidden">{t('Maimai2.PointExchangesPage.PageTitle')}</DialogTitle>
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content">
            <Maimai2PointExchangesPanel onClose={onClose} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Maimai2PointExchangesPage() {
  return <Maimai2PointExchangesPanel />;
}
