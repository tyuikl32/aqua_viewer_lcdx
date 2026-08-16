import { Maimai2Circle } from "./Maimai2Circle";
import { Maimai2CircleChallenge } from "./Maimai2CircleChallenge";
import { Maimai2UserCircleChallenge } from "./Maimai2UserCircleChallenge";
import { Maimai2UserCircleData } from "./Maimai2UserCircleData";
import { Maimai2UserCirclePointData } from "./Maimai2UserCirclePointData";
import { Maimai2UserCirclePointRankingResult } from "./Maimai2UserCirclePointRankingResult";

export interface Maimai2UserCircleInfo {
  joinedCircle: Maimai2Circle;
  circleChallenge: Maimai2CircleChallenge;
  userCircleData: Maimai2UserCircleData;
  userCirclePointData: Maimai2UserCirclePointData,
  userCirclePointRankingResult: Maimai2UserCirclePointRankingResult;
  userCircleChallenge: Maimai2UserCircleChallenge;
  isCircleOwner: boolean;
}
