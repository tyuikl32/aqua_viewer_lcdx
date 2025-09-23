import { DisplayMaimai2Profile } from "./Maimai2Profile";
import { Maimai2UserCircleData } from "./Maimai2UserCircleData";
import { Maimai2UserCirclePointData } from "./Maimai2UserCirclePointData";

export interface Maimai2CircleMemberInfo {
  userCode: string;
  userProfile: DisplayMaimai2Profile;
  userCircleData: Maimai2UserCircleData;
  userCirclePointData: Maimai2UserCirclePointData;
}
