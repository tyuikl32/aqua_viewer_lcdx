import { Maimai2FestaSideData } from "./Maimai2FestaSideData";

export interface Maimai2GameFestaData {
  eventId: number;
  isRallyPeriod: boolean;
  isCircleJoinNotAllowed: boolean;
  jackingFestaSideId: number;
  festaSideDataList: Maimai2FestaSideData[];
}
