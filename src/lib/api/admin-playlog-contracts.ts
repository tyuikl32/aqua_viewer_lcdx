/**
 * Aqua Admin Playlog API contracts.
 *
 * Copy this file into the frontend repository and adjust export style as needed.
 * It mirrors the backend implementation in AdminPlaylogDto and the three game
 * profile/playlog entities. Java long values are emitted as JSON numbers.
 */

export type Nullable<T> = T | null;

export interface ApiStatus {
  code: number;
  message: string;
}

export interface ApiResponse<T> {
  status: ApiStatus;
  /** ISO timestamp with offset, for example 2026-09-27T12:34:56.789-07:00. */
  time: string;
  data: T;
}

export interface ReducedPageResponse<T> {
  content: T[];
  /** Zero-based page number. */
  page: number;
  totalPages: number;
  totalElements: number;
}

export type AdminPlaylogGame = "maimai2" | "chunithmV2" | "ongeki";

export type AdminPlaylogSearchField =
  | "aquaUsername"
  | "aquaEmail"
  | "userName"
  | "extId"
  | "accessCode"
  | "keychipId"
  | "id"
  | "playLogId";

export interface AquaAccountSummary {
  id: number;
  username: string;
  name: string;
  email: string;
}

export interface AdminPlaylogSummary {
  game: AdminPlaylogGame;
  /** Database primary key. Use this value with the detail endpoint. */
  id: number;
  /** Only Maimai2 single-song playlogs have a business playlog ID. */
  playLogId: Nullable<number>;
  /** Null when the game card/profile is not bound to an Aqua account. */
  aquaAccount: Nullable<AquaAccountSummary>;
  userName: Nullable<string>;
  extId: Nullable<number>;
  /** Primary card access code, even when lookup matched an external access code. */
  accessCode: Nullable<string>;
  /** Last client/keychip observed on this game profile. */
  lastClientId: Nullable<string>;
  playDate: Nullable<string>;
  userPlayDate: Nullable<string>;
  musicId: number;
  level: number;
}

export interface AdminPlaylogUser<TDetail> {
  /** Null only for an orphan playlog whose game-profile relation is missing. */
  detail: Nullable<TDetail>;
}

export interface AdminPlaylogDetailBase<
  TGame extends AdminPlaylogGame,
  TUserDetail,
  TPlaylog,
> {
  game: TGame;
  /** Database primary key. */
  id: number;
  playLogId: Nullable<number>;
  aquaAccount: Nullable<AquaAccountSummary>;
  user: AdminPlaylogUser<TUserDetail>;
  detail: TPlaylog;
}

export type Maimai2AdminPlaylogDetail = AdminPlaylogDetailBase<
  "maimai2",
  Maimai2UserDetail,
  Maimai2UserPlaylog
>;

export type ChunithmV2AdminPlaylogDetail = AdminPlaylogDetailBase<
  "chunithmV2",
  ChunithmV2UserDetail,
  ChunithmV2UserPlaylog
>;

export type OngekiAdminPlaylogDetail = AdminPlaylogDetailBase<
  "ongeki",
  OngekiUserDetail,
  OngekiUserPlaylog
>;

export type AdminPlaylogDetail =
  | Maimai2AdminPlaylogDetail
  | ChunithmV2AdminPlaylogDetail
  | OngekiAdminPlaylogDetail;

export interface Maimai2UserDetail {
  accessCode: Nullable<string>;
  userName: Nullable<string>;
  friendCode: string;
  isNetMember: number;
  nameplateId: number;
  iconId: number;
  trophyId: number;
  plateId: number;
  titleId: number;
  partnerId: number;
  frameId: number;
  selectMapId: number;
  totalAwake: number;
  gradeRating: number;
  musicRating: number;
  playerRating: number;
  highestRating: number;
  gradeRank: number;
  classRank: number;
  courseRank: number;
  charaSlot: Nullable<number[]>;
  charaLockSlot: Nullable<number[]>;
  contentBit: number;
  playCount: number;
  currentPlayCount: number;
  renameCredit: number;
  mapStock: Nullable<number>;
  eventWatchedDate: Nullable<string>;
  lastGameId: Nullable<string>;
  lastRomVersion: Nullable<string>;
  lastDataVersion: Nullable<string>;
  lastLoginDate: Nullable<string>;
  lastPlayDate: Nullable<string>;
  lastPlayCredit: number;
  lastPlayMode: number;
  lastPlaceId: number;
  lastPlaceName: Nullable<string>;
  lastAllNetId: number;
  lastRegionId: number;
  lastRegionName: Nullable<string>;
  lastClientId: Nullable<string>;
  lastCountryCode: Nullable<string>;
  lastSelectEMoney: number;
  lastSelectTicket: number;
  lastSelectCourse: number;
  lastCountCourse: number;
  firstGameId: Nullable<string>;
  firstRomVersion: Nullable<string>;
  firstDataVersion: Nullable<string>;
  firstPlayDate: Nullable<string>;
  compatibleCmVersion: Nullable<string>;
  dailyBonusDate: Nullable<string>;
  dailyCourseBonusDate: Nullable<string>;
  lastPairLoginDate: Nullable<string>;
  lastTrialPlayDate: Nullable<string>;
  playVsCount: number;
  playSyncCount: number;
  winCount: number;
  helpCount: number;
  comboCount: number;
  totalDeluxscore: number;
  totalBasicDeluxscore: number;
  totalAdvancedDeluxscore: number;
  totalExpertDeluxscore: number;
  totalMasterDeluxscore: number;
  totalReMasterDeluxscore: number;
  totalHiscore: number;
  totalBasicHighscore: number;
  totalAdvancedHighscore: number;
  totalExpertHighscore: number;
  totalMasterHighscore: number;
  totalReMasterHighscore: number;
  totalSync: number;
  totalBasicSync: number;
  totalAdvancedSync: number;
  totalExpertSync: number;
  totalMasterSync: number;
  totalReMasterSync: number;
  totalAchievement: number;
  totalBasicAchievement: number;
  totalAdvancedAchievement: number;
  totalExpertAchievement: number;
  totalMasterAchievement: number;
  totalReMasterAchievement: number;
  playerOldRating: number;
  playerNewRating: number;
  banState: number;
  dateTime: number;
  cmLastEmoneyBrand: number;
  cmLastEmoneyCredit: number;
  point: number;
  totalPoint: number;
  friendRegistSkip: number;
}

export interface Maimai2UserPlaylog {
  orderId: number;
  /** Note the lowercase "l" in this raw game field. */
  playlogId: number;
  version: number;
  placeId: number;
  placeName: Nullable<string>;
  loginDate: number;
  playDate: Nullable<string>;
  userPlayDate: Nullable<string>;
  type: number;
  musicId: number;
  level: number;
  trackNo: number;
  vsMode: number;
  vsUserName: Nullable<string>;
  vsStatus: number;
  vsUserRating: number;
  vsUserAchievement: number;
  vsUserGradeRank: number;
  vsRank: number;
  playerNum: number;
  playedUserId1: number;
  playedUserName1: Nullable<string>;
  playedMusicLevel1: number;
  playedUserId2: number;
  playedUserName2: Nullable<string>;
  playedMusicLevel2: number;
  playedUserId3: number;
  playedUserName3: Nullable<string>;
  playedMusicLevel3: number;
  characterId1: number;
  characterLevel1: number;
  characterAwakening1: number;
  characterId2: number;
  characterLevel2: number;
  characterAwakening2: number;
  characterId3: number;
  characterLevel3: number;
  characterAwakening3: number;
  characterId4: number;
  characterLevel4: number;
  characterAwakening4: number;
  characterId5: number;
  characterLevel5: number;
  characterAwakening5: number;
  achievement: number;
  deluxscore: number;
  scoreRank: number;
  maxCombo: number;
  totalCombo: number;
  maxSync: number;
  totalSync: number;
  tapCriticalPerfect: number;
  tapPerfect: number;
  tapGreat: number;
  tapGood: number;
  tapMiss: number;
  holdCriticalPerfect: number;
  holdPerfect: number;
  holdGreat: number;
  holdGood: number;
  holdMiss: number;
  slideCriticalPerfect: number;
  slidePerfect: number;
  slideGreat: number;
  slideGood: number;
  slideMiss: number;
  touchCriticalPerfect: number;
  touchPerfect: number;
  touchGreat: number;
  touchGood: number;
  touchMiss: number;
  breakCriticalPerfect: number;
  breakPerfect: number;
  breakGreat: number;
  breakGood: number;
  breakMiss: number;
  isTap: boolean;
  isHold: boolean;
  isSlide: boolean;
  isTouch: boolean;
  isBreak: boolean;
  isCriticalDisp: boolean;
  isFastLateDisp: boolean;
  fastCount: number;
  lateCount: number;
  isAchieveNewRecord: boolean;
  isDeluxscoreNewRecord: boolean;
  comboStatus: number;
  syncStatus: number;
  isClear: boolean;
  beforeRating: number;
  afterRating: number;
  beforeGrade: number;
  afterGrade: number;
  afterGradeRank: number;
  beforeDeluxRating: number;
  afterDeluxRating: number;
  isPlayTutorial: boolean;
  isEventMode: boolean;
  isFreedomMode: boolean;
  playMode: number;
  isNewFree: boolean;
  trialPlayAchievement: number;
  extNum1: number;
  extNum2: number;
  extNum4: Nullable<number>;
  extBool1: Nullable<boolean>;
  extBool2: Nullable<boolean>;
  extBool3: Nullable<boolean>;
}

export interface ChunithmV2UserEmoney {
  type: number;
  emoneyCredit: number;
  emoneyBrand: number;
  ext1: number;
  ext2: number;
  ext3: number;
}

export interface ChunithmV2UserDetail {
  accessCode: Nullable<string>;
  userName: Nullable<string>;
  level: number;
  reincarnationNum: number;
  exp: Nullable<string>;
  point: number;
  totalPoint: number;
  playCount: number;
  multiPlayCount: number;
  playerRating: number;
  highestRating: number;
  nameplateId: number;
  frameId: number;
  characterId: number;
  mateId: number;
  trophyId: number;
  trophyIdSub1: number;
  trophyIdSub2: number;
  playedTutorialBit: number;
  firstTutorialCancelNum: number;
  masterTutorialCancelNum: number;
  totalMapNum: number;
  totalHiScore: number;
  totalBasicHighScore: number;
  totalAdvancedHighScore: number;
  totalExpertHighScore: number;
  totalMasterHighScore: number;
  totalUltimaHighScore: number;
  eventWatchedDate: Nullable<string>;
  friendCount: number;
  firstGameId: Nullable<string>;
  firstRomVersion: Nullable<string>;
  firstDataVersion: Nullable<string>;
  firstPlayDate: Nullable<string>;
  lastGameId: Nullable<string>;
  lastRomVersion: Nullable<string>;
  lastDataVersion: Nullable<string>;
  lastPlayDate: Nullable<string>;
  lastPlaceId: number;
  lastPlaceName: Nullable<string>;
  lastRegionId: Nullable<string>;
  lastRegionName: Nullable<string>;
  lastAllNetId: Nullable<string>;
  lastClientId: Nullable<string>;
  lastCountryCode: Nullable<string>;
  userNameEx: Nullable<string>;
  compatibleCmVersion: Nullable<string>;
  medal: number;
  mapIconId: number;
  voiceId: number;
  avatarWear: number;
  avatarHead: number;
  avatarFace: number;
  avatarSkin: number;
  avatarItem: number;
  avatarFront: number;
  avatarBack: number;
  classEmblemBase: number;
  classEmblemMedal: number;
  stockedGridCount: number;
  exMapLoopCount: number;
  netBattlePlayCount: number;
  netBattleWinCount: number;
  netBattleLoseCount: number;
  netBattleConsecutiveWinCount: number;
  charaIllustId: number;
  skillId: number;
  stageId?: number;
  overPowerPoint: number;
  overPowerRate: number;
  overPowerLowerRank: number;
  avatarPoint: number;
  battleRankId: number;
  battleRankPoint: number;
  eliteRankPoint: number;
  netBattle1stCount: number;
  netBattle2ndCount: number;
  netBattle3rdCount: number;
  netBattle4thCount: number;
  netBattleCorrection: number;
  netBattleErrCnt: number;
  netBattleHostErrCnt: number;
  battleRewardStatus: number;
  battleRewardIndex: number;
  battleRewardCount: number;
  ext1: number;
  ext2: number;
  ext3: number;
  ext4: number;
  ext5: number;
  ext6: number;
  ext7: number;
  ext8: number;
  ext9: number;
  ext10: number;
  extStr1: Nullable<string>;
  extStr2: Nullable<string>;
  extLong1: number;
  extLong2: number;
  rankUpChallengeResults: unknown;
  isNetBattleHost: boolean;
  netBattleEndState: number;
  userEmoney?: ChunithmV2UserEmoney;
}

export interface ChunithmV2UserPlaylog {
  romVersion: Nullable<string>;
  orderId: number;
  sortNumber: number;
  placeId: number;
  playDate: Nullable<string>;
  userPlayDate: Nullable<string>;
  musicId: number;
  level: number;
  customId: number;
  playedUserId1: number;
  playedUserId2: number;
  playedUserId3: number;
  playedUserName1: Nullable<string>;
  playedUserName2: Nullable<string>;
  playedUserName3: Nullable<string>;
  playedMusicLevel1: number;
  playedMusicLevel2: number;
  playedMusicLevel3: number;
  playedCustom1: number;
  playedCustom2: number;
  playedCustom3: number;
  track: number;
  score: number;
  rank: number;
  maxCombo: number;
  maxChain: number;
  rateTap: number;
  rateHold: number;
  rateSlide: number;
  rateAir: number;
  rateFlick: number;
  judgeGuilty: number;
  judgeAttack: number;
  judgeJustice: number;
  judgeCritical: number;
  judgeHeaven: number;
  eventId: number;
  playerRating: number;
  isNewRecord: boolean;
  isFullCombo: boolean;
  fullChainKind: number;
  isAllJustice: boolean;
  isContinue: boolean;
  isFreeToPlay: boolean;
  characterId: number;
  charaIllustId: number;
  skillId: number;
  playKind: number;
  isClear: boolean;
  skillLevel: number;
  skillEffect: number;
  placeName: Nullable<string>;
  commonId: number;
  regionId: number;
  machineType: number;
  ticketId: number;
  monthPoint: number;
  eventPoint: number;
}

export interface OngekiUserDetail {
  accessCode: Nullable<string>;
  userName: Nullable<string>;
  level: number;
  reincarnationNum: number;
  exp: number;
  point: number;
  totalPoint: number;
  playCount: number;
  jewelCount: number;
  totalJewelCount: number;
  medalCount: number;
  shizukuCount?: number;
  playerRating: number;
  highestRating: number;
  newPlayerRating?: number;
  newHighestRating?: number;
  battlePoint: number;
  bestBattlePoint: number;
  overDamageBattlePoint: number;
  isDialogWatchedSuggestMemory: boolean;
  nameplateId: number;
  trophyId: number;
  cardId: number;
  characterId: number;
  characterVoiceNo: number;
  tabSetting: number;
  tabSortSetting: number;
  cardCategorySetting: number;
  cardSortSetting: number;
  rivalScoreCategorySetting: number;
  playedTutorialBit: number;
  firstTutorialCancelNum: number;
  sumTechHighScore: number;
  sumTechBasicHighScore: number;
  sumTechAdvancedHighScore: number;
  sumTechExpertHighScore: number;
  sumTechMasterHighScore: number;
  sumTechLunaticHighScore: number;
  sumBattleHighScore: number;
  sumBattleBasicHighScore: number;
  sumBattleAdvancedHighScore: number;
  sumBattleExpertHighScore: number;
  sumBattleMasterHighScore: number;
  sumBattleLunaticHighScore: number;
  sumPlatinumScoreStar?: number;
  sumBasicPlatinumScoreStar?: number;
  sumAdvancedPlatinumScoreStar?: number;
  sumExpertPlatinumScoreStar?: number;
  sumMasterPlatinumScoreStar?: number;
  sumLunaticPlatinumScoreStar?: number;
  eventWatchedDate: Nullable<string>;
  cmEventWatchedDate: Nullable<string>;
  firstGameId: Nullable<string>;
  firstRomVersion: Nullable<string>;
  firstDataVersion: Nullable<string>;
  firstPlayDate: Nullable<string>;
  lastGameId: Nullable<string>;
  lastRomVersion: Nullable<string>;
  lastDataVersion: Nullable<string>;
  compatibleCmVersion: Nullable<string>;
  lastPlayDate: Nullable<string>;
  lastPlaceId: number;
  lastPlaceName: Nullable<string>;
  lastRegionId: number;
  lastRegionName: Nullable<string>;
  lastAllNetId: number;
  lastClientId: Nullable<string>;
  lastUsedDeckId: number;
  lastPlayMusicLevel: number;
  lastEmoneyBrand: number;
}

export interface OngekiUserPlaylog {
  sortNumber: number;
  placeId: number;
  placeName: Nullable<string>;
  playDate: Nullable<string>;
  userPlayDate: Nullable<string>;
  musicId: number;
  level: number;
  playKind: number;
  eventId: number;
  eventName: Nullable<string>;
  eventPoint: number;
  playedUserId1: number;
  playedUserId2: number;
  playedUserId3: number;
  playedUserName1: Nullable<string>;
  playedUserName2: Nullable<string>;
  playedUserName3: Nullable<string>;
  playedMusicLevel1: number;
  playedMusicLevel2: number;
  playedMusicLevel3: number;
  cardId1: number;
  cardId2: number;
  cardId3: number;
  cardLevel1: number;
  cardLevel2: number;
  cardLevel3: number;
  cardAttack1: number;
  cardAttack2: number;
  cardAttack3: number;
  bossCharaId: number;
  bossLevel: number;
  bossAttribute: number;
  clearStatus: number;
  techScore: number;
  techScoreRank: number;
  battleScore: number;
  battleScoreRank: number;
  platinumScore: number;
  platinumScoreStar?: number;
  maxCombo: number;
  judgeMiss: number;
  judgeHit: number;
  judgeBreak: number;
  judgeCriticalBreak: number;
  rateTap: number;
  rateHold: number;
  rateFlick: number;
  rateSideTap: number;
  rateSideHold: number;
  bellCount: number;
  totalBellCount: number;
  damageCount: number;
  overDamage: number;
  isTechNewRecord: boolean;
  isBattleNewRecord: boolean;
  isOverDamageNewRecord: boolean;
  isFullCombo: boolean;
  isFullBell: boolean;
  isAllBreak: boolean;
  playerRating: number;
  battlePoint: number;
}

export type AquaRoleName = "ROLE_USER" | "ROLE_ADMIN";

export interface AdminUserSearchItem {
  user: {
    id: number;
    username: string;
    name: string;
    email: string;
    roles: Array<{ name: AquaRoleName }>;
    oauth2s: Array<{
      id: number;
      provider: string;
      email: string;
    }>;
  };
  gameProfiles: Array<{
    card: {
      extId: Nullable<number>;
      luid: Nullable<string>;
      default: boolean;
    };
    chusan: Nullable<{
      userName: Nullable<string>;
      playerRating: number;
      banState: number;
    }>;
    ongeki: Nullable<{
      userName: Nullable<string>;
      playerRating: number;
      banStatus: number;
    }>;
    maimai2: Nullable<{
      userName: Nullable<string>;
      playerRating: number;
      banState: number;
    }>;
  }>;
}
