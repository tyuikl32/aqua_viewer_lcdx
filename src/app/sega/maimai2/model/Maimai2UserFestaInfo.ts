import { Maimai2Circle } from "./Maimai2Circle";
import { Maimai2CircleFestaData } from "./Maimai2CircleFestaData";
import { Maimai2UserFestaData } from "./Maimai2UserFestaData";
import { Maimai2UserResultFestaData } from "./Maimai2UserResultFestaData";

export interface Maimai2UserFestaInfo {
  circle: Maimai2Circle;
  circleFestaData: Maimai2CircleFestaData;
  userFestaData: Maimai2UserFestaData;
  userResultFestaData: Maimai2UserResultFestaData;
}
