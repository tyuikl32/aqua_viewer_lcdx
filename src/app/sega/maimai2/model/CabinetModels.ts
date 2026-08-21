/** 机台管理前端模型（后端契约见设计基线 §6；与 LCDXNetApi CabinetDtos 对齐） */

export interface CabinetSummary {
  nickName: string | null;
  fullKeychip: string;
  locationName: string | null;
  isSpecialMode: number;
  level: number;
  isRebooting: boolean;
  lastOnline: string;
}

export interface CabinetSettingItem {
  settingName: string;
  settingValue: string;
}

export interface CabinetInfo {
  nickName: string | null;
  locationName: string | null;
  level: number;
  isSpecialMode: number;
  isNoGui: boolean;
  isRebooting: boolean;
  lastOnline: string;
  lastError: string | null;
  currentMemoryUsage: number;
  currentSinmaiMemoryUsage: number;
  pagefileMessage: string | null;
  settings: CabinetSettingItem[];
}

export interface PlayerWindow {
  players: number;
  plays: number;
}

export interface PlayingUser {
  userId: number;
  userName: string;
  lastPlayDate: string;
}

export interface CabinetPlayers {
  nickName: string | null;
  locationName: string | null;
  halfHour: PlayerWindow;
  oneHour: PlayerWindow;
  twoHour: PlayerWindow;
  playing: PlayingUser[];
}

export interface DeliveryImage {
  rfState: number;
  deliveryTitle: string | null;
  currentVersion: string | null;
  deliveryVersion: string | null;
  totalSize: number;
  downloadedSize: number;
  startTime: string | null;
  releaseTime: string | null;
}

export interface DeliveryStatus {
  app: DeliveryImage | null;
  option: DeliveryImage | null;
}

export interface DownloadProgressItem {
  fileName: string;
  progress: number;
  progressText: string;
  reportDate: string;
}

export interface DownloadProgress {
  items: DownloadProgressItem[];
}

export interface CabinetLevelResult {
  level: number;
  levelName: string;
  warning: string;
}

export interface RemoteCommandResult {
  status: 'pending' | 'done' | 'timeout';
  command: string;
  message: string | null;
  imageUrl: string | null;
}

export interface RemoteLockItem {
  qqNumber: number;
  fullKeychip: string | null;
  action: string;
  params: string | null;
  result: string;
  detail: string | null;
  time: string;
}

export interface RemoteLockList {
  total: number;
  items: RemoteLockItem[];
}

export interface GrantItem {
  qqNumber: number;
  fullKeychip: string;
  /** 机台别名（EP-15 后端 join Cabinets 解析）；机台行缺失时为 null */
  nickName: string | null;
  enabled: boolean;
  grantedAt: string;
  grantedBy: number | null;
}

export interface GrantList {
  total: number;
  items: GrantItem[];
}

/** Admin 授权成员行（EP-20L） */
export interface MemberPermissionItem {
  qqNumber: number;
  permission: number;
  note: string | null;
  addedSince: string;
}

export interface MemberPermissionList {
  total: number;
  items: MemberPermissionItem[];
}

/** LC 模式文案映射（实体无 GameType，前端映射 0/4/5/10，设计 §8 展示规则） */
export const LC_MODES: { mode: number; labelKey: string }[] = [
  {mode: 0, labelKey: 'Maimai2.Cabinets.Mode0'},
  {mode: 4, labelKey: 'Maimai2.Cabinets.Mode4'},
  {mode: 5, labelKey: 'Maimai2.Cabinets.Mode5'},
  {mode: 10, labelKey: 'Maimai2.Cabinets.Mode10'},
];

/** 机台级别 8 档（Recover..Special；级别越低配信越少警告） */
export const CABINET_LEVELS: { level: number; name: string; descKey: string }[] = [
  {level: -1, name: 'Recover', descKey: 'Maimai2.CabinetControl.LevelRecover'},
  {level: 0, name: 'Dead', descKey: 'Maimai2.CabinetControl.LevelDead'},
  {level: 1, name: 'Cold', descKey: 'Maimai2.CabinetControl.LevelCold'},
  {level: 2, name: 'Cool', descKey: 'Maimai2.CabinetControl.LevelCool'},
  {level: 3, name: 'Warm', descKey: 'Maimai2.CabinetControl.LevelWarm'},
  {level: 4, name: 'Hot', descKey: 'Maimai2.CabinetControl.LevelHot'},
  {level: 5, name: 'Burn', descKey: 'Maimai2.CabinetControl.LevelBurn'},
  {level: 6, name: 'Develop', descKey: 'Maimai2.CabinetControl.LevelDevelop'},
  {level: 7, name: 'Special', descKey: 'Maimai2.CabinetControl.LevelSpecial'},
];

/** lcset 全量 19 项（Admin；与后端 CabinetPolicy.LcsetKeys 一致，普通子集由 BotPermissionService 过滤） */
export const LCSET_KEYS: { key: string; setting: string }[] = [
  {key: '3456', setting: 'QuickRetry'},
  {key: '跳过闭店', setting: 'ForceBypassCloseShop'},
  {key: 'bd', setting: 'ForceBypassCloseShop'},
  {key: 'event', setting: 'MininumOpenEvent'},
  {key: 'chevent', setting: 'MininumOpenEventChn'},
  {key: 'ui', setting: 'UIStyle'},
  {key: '3456cn', setting: 'QuickRetryCommon'},
  {key: 'hide', setting: 'HideTrueVersionInfo'},
  {key: 'cam', setting: 'ReImplCam'},
  {key: 'igam', setting: 'IgnoreAMError'},
  {key: 'cc', setting: 'CustomCameraConfig'},
  {key: 'freekl', setting: 'KaleidxFree'},
  {key: 'freekld', setting: 'KaleidxFreeDuration'},
  {key: 'skipdlc', setting: 'SkipDeliveryCheck'},
  {key: '缓和1', setting: 'KaleidxLcPhase'},
  {key: '缓和2', setting: 'KaleidxLcPhaseEx'},
  {key: 'kldhope', setting: 'KaleidxHopeKeyEnable'},
  {key: 'disfesta', setting: 'DisableFestaMode'},
  {key: 'ffesta', setting: 'ForceFestaMode'},
];

/** Remoteware 指令 17 条（Admin；普通子集 2 条由 BotPermissionService 过滤） */
export const REMOTE_COMMANDS: { command: string; hasArg: boolean; argHintKey: string }[] = [
  {command: 'ping', hasArg: false, argHintKey: ''},
  {command: 'game-reboot', hasArg: false, argHintKey: ''},
  {command: 'game-switch', hasArg: false, argHintKey: ''},
  {command: 'game-force-reboot', hasArg: false, argHintKey: ''},
  {command: 'printscr', hasArg: false, argHintKey: ''},
  {command: 'remote-card', hasArg: false, argHintKey: ''},
  {command: 'download', hasArg: true, argHintKey: 'Maimai2.RemoteControl.ArgUrl'},
  {command: 'downloadpro', hasArg: true, argHintKey: 'Maimai2.RemoteControl.ArgUrl'},
  {command: 'unzip', hasArg: true, argHintKey: 'Maimai2.RemoteControl.ArgPath'},
  {command: 'logsince', hasArg: true, argHintKey: 'Maimai2.RemoteControl.ArgDate'},
  {command: 'logsave', hasArg: true, argHintKey: 'Maimai2.RemoteControl.ArgName'},
  {command: 'remote-cmd', hasArg: true, argHintKey: 'Maimai2.RemoteControl.ArgCmd'},
  {command: 'remote-cmd-with-user', hasArg: true, argHintKey: 'Maimai2.RemoteControl.ArgUserCmd'},
  {command: 'remote-bat', hasArg: true, argHintKey: 'Maimai2.RemoteControl.ArgBat'},
  {command: 'remote-bat-with-user', hasArg: true, argHintKey: 'Maimai2.RemoteControl.ArgUserBat'},
  {command: 'remote-url-bat', hasArg: true, argHintKey: 'Maimai2.RemoteControl.ArgUrl'},
  {command: 'remote-url-bat-with-user', hasArg: true, argHintKey: 'Maimai2.RemoteControl.ArgUserUrlBat'},
];

/** fileName 截断：去第 20 位起 7 字符（越界保护，设计展示规则） */
export function truncateFileName(name: string): string {
  if (!name) {
    return '';
  }
  if (name.length <= 27) {
    return name;
  }
  return name.slice(0, 20) + '…' + name.slice(name.length - 7);
}
