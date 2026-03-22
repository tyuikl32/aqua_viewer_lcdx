export interface Maimai2CircleChallenge {
    circleId: number;
    musicId: number;
    updateDate: string;
    /// 表示这个circle是否完成了circleChallenge允许玩家获取奖励
    rewardStatus: boolean;
    //总进度
    achievement: number;
}