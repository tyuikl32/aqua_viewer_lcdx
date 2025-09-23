import { Maimai2FestaSideData } from "./Maimai2FestaSideData";

type Maimai2ResultFestaSideData = Maimai2FestaSideData;

export interface Maimai2GameResultFestaData {
  eventId: number;
  resultFestaSideDataList: Maimai2ResultFestaSideData[];
}
