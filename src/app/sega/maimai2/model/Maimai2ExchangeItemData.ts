export enum Maimai2ExchangeItemType {
    Plate = 1,
    Title = 2,
    Icon = 3,
    Present = 4,
    // Music = 5,
    // MusicMas = 6,
    // MusicRem = 7,
    // MusicSrg = 8,
    Character = 9,
    Partner = 10,
    Frame = 11,
    Ticket = 12,
    Mile = 13,
    // IntimateItem = 14,
    KaleidxScopeKey = 15,
    DXPass = 901
}

export enum Maimai2ExchangeItemTypeName {
    Plate = "姓名框",
    Title = "称号",
    Icon = "头像",
    Present = "礼物",
    // Music = 5,
    // MusicMas = 6,
    // MusicRem = 7,
    // MusicSrg = 8,
    Character = "角色",
    Partner = "伙伴",
    Frame = "背景图",
    Ticket = "功能卷",
    Mile = "Mile",
    // IntimateItem = 14,
    KaleidxScopeKey = "门钥匙",
    DXPass = "DXPass"
}

export interface Maimai2ExchangeItemData {
    id: number;
    itemType: Maimai2ExchangeItemType;
    itemId: number;
    name: string;
    description: string;
    itemCount: number;
    exchangedCount: number;
    stockCount: number;
    costPoints: number;
    limitCount: number;
    enable: boolean;
}