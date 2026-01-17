import { Maimai2Circle } from "./Maimai2Circle";
import { Maimai2CircleFestaData } from "./Maimai2CircleFestaData";

export interface Maimai2UserResultFestaData {

  /**
   * 请注意这个eventId对应的是Festa.xml的resultEventId
   */
  eventId: number;

  circleId: number;

  circleName: string;

  festaSideId: number;

  circleRankInFestaSide: number;

  receivedRewardBorder: number;

  circleTotalFestaPoint: number;

  resultRewardGet: number;
}
