import { DisplayMaimai2Profile } from "./Maimai2Profile";

export interface Maimai2RequestJoinCircleUser {
  userProfile: DisplayMaimai2Profile;
  requestTime: string;
  userCode: string;
}
