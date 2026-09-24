import { translate } from '@/lib/i18n';

export interface ApiResponse<T> {
  data: T;
  status?: {
    code: number;
    message?: string;
  };
}

export interface Maimai2ServerMissionPointData {
  totalPoints: number;
  availablePoints: number;
}

export interface Maimai2ServerMissionPointChangelog {
  reason: string;
  changedAmount: number;
  recordDate: string;
}

export interface Maimai2ServerMissionPointInfo {
  userPointData: Maimai2ServerMissionPointData;
  filterPointChangelogs: Maimai2ServerMissionPointChangelog[];
  changelogTotalCount: number;
}

export type Maimai2ServerMissionRefreshCycle =
  | 'None'
  | 'EveryDay'
  | 'EveryWeek'
  | 'EveryMonth';

export interface Maimai2ServerMissionCondition {
  current: number;
  total: number;
  isDone: boolean;
  description: string;
}

export interface Maimai2ServerMission {
  rewardType: number;
  rewardTypeRelatedId: number;
  missionTitle: string;
  missionDescription: string;
  rewardDescription: string;
  refreshCycle: Maimai2ServerMissionRefreshCycle;
  conditionProgresses: Maimai2ServerMissionCondition[];
}

export interface Maimai2ServerMissionInfo {
  serverMissionUserInfos: Maimai2ServerMission[];
}

export type Maimai2ExchangeItemTypeName =
  | 'Plate'
  | 'Title'
  | 'Icon'
  | 'Present'
  | 'Character'
  | 'Partner'
  | 'Frame'
  | 'Ticket'
  | 'Mile'
  | 'KaleidxScopeKey'
  | 'DXPass';

export type Maimai2ExchangeItemType =
  | 1
  | 2
  | 3
  | 4
  | 9
  | 10
  | 11
  | 12
  | 13
  | 15
  | 901
  | Maimai2ExchangeItemTypeName;

export interface Maimai2ExchangeItem {
  id: number;
  itemType: Maimai2ExchangeItemType;
  itemId: number;
  name: string;
  description: string;
  itemCount: number;
  exchangedCount: number;
  stockCount: number;
  costPoints: number;
  limitCount: number;
  enable: boolean;
}

export interface Maimai2ExchangeItemList {
  filterExchangeItemDataList: Maimai2ExchangeItem[];
  filterListTotalCount: number;
}

export interface Maimai2UserExchangeItem {
  id: number;
  exchangedTotalCount: number;
  exchangedItemDataId: number;
}

export interface Maimai2UserExchangeItemChangelog {
  id: number;
  exchangeCount: number;
  recordDate: string;
  exchangedItemDataId: number;
}

export interface Maimai2UserExchangeInfo {
  exchangeItemDataList: Maimai2UserExchangeItem[];
  filterExchangeItemChangelogList: Maimai2UserExchangeItemChangelog[];
  changelogTotalCount: number;
}

export const MAIMAI2_EXCHANGE_TYPES: ReadonlyArray<{
  value: number;
  key: Maimai2ExchangeItemTypeName;
}> = [
  { value: 1, key: 'Plate' },
  { value: 2, key: 'Title' },
  { value: 3, key: 'Icon' },
  { value: 4, key: 'Present' },
  { value: 9, key: 'Character' },
  { value: 10, key: 'Partner' },
  { value: 11, key: 'Frame' },
  { value: 12, key: 'Ticket' },
  { value: 13, key: 'Mile' },
  { value: 15, key: 'KaleidxScopeKey' },
  { value: 901, key: 'DXPass' },
];

export function exchangeTypeKey(type: Maimai2ExchangeItemType): Maimai2ExchangeItemTypeName | null {
  if (typeof type === 'string') {
    return MAIMAI2_EXCHANGE_TYPES.some((entry) => entry.key === type) ? type : null;
  }
  return MAIMAI2_EXCHANGE_TYPES.find((entry) => entry.value === type)?.key ?? null;
}

export function exchangeTypeLabel(type: Maimai2ExchangeItemType): string {
  const key = exchangeTypeKey(type);
  return key ? translate(`Maimai2.PointExchangesPage.Type.${key}`) : translate('Maimai2.PointExchangesPage.Type.Unknown');
}
