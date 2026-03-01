import { Maimai2ServerMissionUserPointChangelog } from "./Maimai2ServerMissionUserPointChangelog";
import { Maimai2ServerMissionUserPointData } from "./Maimai2ServerMissionUserPointData";

export class Maimai2UserServerMissionPointInfoResp {
    userPointData: Maimai2ServerMissionUserPointData;
    filterPointChangelogs: Maimai2ServerMissionUserPointChangelog[];

    changelogTotalCount: number;
}