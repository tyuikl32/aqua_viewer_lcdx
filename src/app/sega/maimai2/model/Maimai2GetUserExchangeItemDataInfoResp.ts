import { Maimai2UserExchangeItemData } from './Maimai2UserExchangeItemData';
import { Maimai2UserExchangeItemChangelog } from './Maimai2UserExchangeItemChangelog';

export interface Maimai2GetUserExchangeItemDataInfoResp {
    exchangeItemDataList: Maimai2UserExchangeItemData[];
    filterExchangeItemChangelogList: Maimai2UserExchangeItemChangelog[];
    changelogTotalCount: number;
}