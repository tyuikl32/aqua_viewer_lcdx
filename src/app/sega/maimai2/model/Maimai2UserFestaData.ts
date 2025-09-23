import { Maimai2Circle } from "./Maimai2Circle";
import { Maimai2CircleFestaData } from "./Maimai2CircleFestaData";

export interface Maimai2UserFestaData {

  /**
   * 请注意这个eventId对应的是Festa.xml的openEventId
   */
  eventId: number;

  circleId: number;

  festaSideId: number;

  circleTotalFestaPoint: number;

  currentTotalFestaPoint: number;

  circleRankInFestaSide: number;

  circleRecordDate: string;

  isDailyBonus: boolean;

  participationRewardGet: boolean;

  receivedRewardBorder: number;

  circleName: string;

  placeId: number;
}
