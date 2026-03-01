import { Maimai2ServerMissionConditionUserInfo } from "./Maimai2ServerMissionConditionUserInfo";

export interface Maimai2ServerMissionUserInfo {
    rewardType: number;          
    rewardTypeRelatedId: number;  
    missionTitle: string;
    missionDescription: string;
    rewardDescription: string;
    refreshCycle: Maimai2ServerMissionRefreshCycle;
    conditionProgresses: Maimai2ServerMissionConditionUserInfo[];
}

export enum Maimai2ServerMissionRefreshCycle {
    None = 'None',
    EveryDay = 'EveryDay',
    EveryWeek = 'EveryWeek',
    EveryMonth = 'EveryMonth'
}