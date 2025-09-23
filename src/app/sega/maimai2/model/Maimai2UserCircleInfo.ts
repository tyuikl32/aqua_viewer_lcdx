import { Maimai2Circle } from "./Maimai2Circle";
import { Maimai2UserCircleData } from "./Maimai2UserCircleData";
import { Maimai2UserCirclePointData } from "./Maimai2UserCirclePointData";
import { Maimai2UserCirclePointRankingResult } from "./Maimai2UserCirclePointRankingResult";

export interface Maimai2UserCircleInfo {
  joinedCircle: Maimai2Circle;
  userCircleData: Maimai2UserCircleData;
  userCirclePointData: Maimai2UserCirclePointData,
  userCirclePointRankingResult: Maimai2UserCirclePointRankingResult;
  isCircleOwner: boolean;
}
