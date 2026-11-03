/**
 * 机台管理前端模型（等价旧版 sega/maimai2/model/CabinetModels.ts；与 LCDXNetApi CabinetDtos 对齐）。
 */

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
  /** 窗口区间起点（闭区间）。今日窗口 = 当日 00:00；其余 = snapshotTime 往前推 N 分/时 */
  from?: string;
  /** 窗口区间终点（闭区间）= 该次统计的快照时刻 */
  to?: string;
}

export interface PlayingUser {
  userId: number;
  userName: string;
  lastPlayDate: string;
}

export interface CabinetPlayers {
  nickName: string | null;
  locationName: string | null;
  today: PlayerWindow;
  halfHour: PlayerWindow;
  oneHour: PlayerWindow;
  twoHour: PlayerWindow;
  playing: PlayingUser[];
}

/** 两小时窗口内游玩过的玩家（按 userId 去重 + 次数；仅单台命中时下发） */
export interface PlayerPlayCount {
  userId: number;
  userName: string;
  plays: number;
  /** 该玩家最新一条游玩时刻（打码只影响 userName，不影响本字段） */
  lastPlayDate?: string;
}

/** dxnum 机台人数查询：单台统计项（无 fullKeychip） */
export interface CabinetDxnumItem {
  nickName: string | null;
  /** v5：仅当调用者权限 ≥ ManageGrants(4) 时才有真实位置名，否则为 null（脱敏在服务端） */
  locationName: string | null;
  /** v5：调用者是否有权看到真实位置名；false 时前端一律以别名呈现 */
  locationVisible: boolean;
  isSpecialMode: number;
  level: number;
  today: PlayerWindow;
  halfHour: PlayerWindow;
  oneHour: PlayerWindow;
  twoHour: PlayerWindow;
  /** 仅命中恰好 1 台时非空（多台命中「隐名」，后端下发 []） */
  playing: PlayingUser[];
  /** 仅命中恰好 1 台时非空；口径见设计 §2.1 */
  recentPlayers: PlayerPlayCount[];
  /** 命中多台 → true：本项不含任何玩家名字，前端据此不渲染名单 */
  namesHidden: boolean;
}

/** dxnum 响应：matchedCount 为全范围命中总数（非当页数） */
export interface CabinetDxnumResult {
  keyword: string;
  matchedCount: number;
  page: number;
  pageSize: number;
  playingWindowMinutes: number;
  /** 本次统计的快照时刻（四窗与在玩判定的基准取时）。与信封 time（响应生成时刻）语义不同 */
  snapshotTime?: string;
  items: CabinetDxnumItem[];
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
  { mode: 0, labelKey: 'Maimai2.Cabinets.Mode0' },
  { mode: 4, labelKey: 'Maimai2.Cabinets.Mode4' },
  { mode: 5, labelKey: 'Maimai2.Cabinets.Mode5' },
  { mode: 10, labelKey: 'Maimai2.Cabinets.Mode10' },
];

/** CabmodeList 目录项（后端 GET lcdx/cabinet/modes；level = 最低机台档） */
export interface CabModeItem {
  id: number;
  name: string;
  level: number;
}

export interface CabinetModesResponse {
  modes: CabModeItem[];
}

/** 机台级别 8 档（Recover..Special；级别越低配信越少警告） */
export const CABINET_LEVELS: { level: number; name: string; descKey: string }[] = [
  { level: -1, name: 'Recover', descKey: 'Maimai2.CabinetControl.LevelRecover' },
  { level: 0, name: 'Dead', descKey: 'Maimai2.CabinetControl.LevelDead' },
  { level: 1, name: 'Cold', descKey: 'Maimai2.CabinetControl.LevelCold' },
  { level: 2, name: 'Cool', descKey: 'Maimai2.CabinetControl.LevelCool' },
  { level: 3, name: 'Warm', descKey: 'Maimai2.CabinetControl.LevelWarm' },
  { level: 4, name: 'Hot', descKey: 'Maimai2.CabinetControl.LevelHot' },
  { level: 5, name: 'Burn', descKey: 'Maimai2.CabinetControl.LevelBurn' },
  { level: 6, name: 'Develop', descKey: 'Maimai2.CabinetControl.LevelDevelop' },
  { level: 7, name: 'Special', descKey: 'Maimai2.CabinetControl.LevelSpecial' },
];

/** lcset 9 项（Admin；与后端 CabinetPolicy.LcsetKeys 一致，普通子集由 botPermission 过滤）
 *  default："恢复默认值"按钮填充值；noteKey：输入格式提示（如 cc 格式(0,1)），可正常编辑提交
 *  key 是提交给后端的协议值，不随语言变化；keyLabelKey 仅供展示 */
export const LCSET_KEYS: {
  key: string;
  setting: string;
  default?: string;
  keyLabelKey?: string;
  noteKey?: string;
}[] = [
  { key: '跳过闭店', setting: 'ForceBypassCloseShop', default: '0', keyLabelKey: 'Maimai2.CabinetControl.LcsetKeyBypassCloseShop' },
  { key: 'bd', setting: 'ForceBypassCloseShop', default: '0' },
  { key: 'event', setting: 'MininumOpenEvent', default: '25091800' },
  { key: 'cam', setting: 'ReImplCam' },
  { key: 'igam', setting: 'IgnoreAMError', default: '0' },
  { key: 'cc', setting: 'CustomCameraConfig', noteKey: 'Maimai2.CabinetControl.LcsetNoteCameraConfig' },
  { key: 'skipdlc', setting: 'SkipDeliveryCheck', default: '1' },
  { key: 'disfesta', setting: 'DisableFestaMode', default: '1' },
  { key: 'ffesta', setting: 'ForceFestaMode', default: '0' },
  { key: '旧段位', setting: 'EnableOldDanCourse' },
];

/**
 * 单条指令的参数契约（与机台侧 Remoteware 参数格式对齐；前端校验仅 UX，安全边界在后端白名单与机台 daemon）。
 * 不设此字段 = 该指令不接受参数：输入框禁用，下发空串。
 */
export interface RemoteCommandArg {
  /** 指令下拉下方的提示（说明可选 / 必填 / 格式），如「参数：0 / 1 / 2（可选）」 */
  hintKey: string;
  /** 输入框 placeholder；缺省回落到通用 ParamsPlaceholder */
  placeholderKey?: string;
  /** 必填：空值即校验失败（阻止发送） */
  required?: boolean;
  /** 格式校验，作用在归一化后的值上；不匹配即失败 */
  pattern?: RegExp;
  /** 校验失败文案；缺省回落到 hintKey，保证提示永不为空 */
  invalidKey?: string;
  /** 下发前的归一化（同时用于校验），如卡号去空白；缺省原样下发 */
  normalize?: (value: string) => string;
  /** 移动端弹数字键盘 */
  numeric?: boolean;
}

export interface RemoteCommandDef {
  command: string;
  arg?: RemoteCommandArg;
}

const remoteArg = (hintKey: string, extra: Partial<RemoteCommandArg> = {}): RemoteCommandArg => ({
  hintKey,
  ...extra,
});

/** Remoteware 指令 17 条（Admin；普通子集 2 条由 botPermission 过滤） */
export const REMOTE_COMMANDS: RemoteCommandDef[] = [
  { command: 'ping' },
  { command: 'game-reboot' },
  { command: 'game-switch' },
  { command: 'game-force-reboot' },
  {
    command: 'printscr',
    arg: remoteArg('Maimai2.RemoteControl.ArgPrintScr', {
      placeholderKey: 'Maimai2.RemoteControl.PlaceholderPrintScr',
      invalidKey: 'Maimai2.RemoteControl.ArgPrintScrInvalid',
      pattern: /^[012]$/,
      // 单字符取值：校验与下发都用 trim 后的值，避免把「2 」（尾随空格）原样发给机台
      normalize: (value) => value.trim(),
      numeric: true,
    }),
  },
  {
    command: 'remote-card',
    arg: remoteArg('Maimai2.RemoteControl.ArgCardNumber', {
      required: true,
      placeholderKey: 'Maimai2.RemoteControl.PlaceholderCardNumber',
      invalidKey: 'Maimai2.RemoteControl.PlaceholderCardNumber',
      pattern: /^\d{20}$/,
      // 允许「1234 5678 9012 3456 7890」这类从别处粘来的分组卡号
      normalize: (value) => value.replace(/\s+/g, ''),
      numeric: true,
    }),
  },
  { command: 'download', arg: remoteArg('Maimai2.RemoteControl.ArgDownload', { placeholderKey: 'Maimai2.RemoteControl.PlaceholderDownload' }) },
  { command: 'downloadpro', arg: remoteArg('Maimai2.RemoteControl.ArgDownload', { placeholderKey: 'Maimai2.RemoteControl.PlaceholderDownload' }) },
  { command: 'unzip', arg: remoteArg('Maimai2.RemoteControl.ArgPath') },
  { command: 'logsince', arg: remoteArg('Maimai2.RemoteControl.ArgDate') },
  { command: 'logsave', arg: remoteArg('Maimai2.RemoteControl.ArgName') },
  { command: 'remote-cmd', arg: remoteArg('Maimai2.RemoteControl.ArgCmd') },
  { command: 'remote-cmd-with-user', arg: remoteArg('Maimai2.RemoteControl.ArgUserCmd') },
  { command: 'remote-bat', arg: remoteArg('Maimai2.RemoteControl.ArgBat') },
  { command: 'remote-bat-with-user', arg: remoteArg('Maimai2.RemoteControl.ArgUserBat') },
  { command: 'remote-url-bat', arg: remoteArg('Maimai2.RemoteControl.ArgUrl') },
  { command: 'remote-url-bat-with-user', arg: remoteArg('Maimai2.RemoteControl.ArgUserUrlBat') },
];

/** 校验用值：有 normalize 用归一化值；否则 trim（防止全空格绕过必填） */
function checkValue(arg: RemoteCommandArg, raw: string): string {
  return arg.normalize ? arg.normalize(raw) : raw.trim();
}

/** 参数是否非法：空值只在 required 时算非法；无参指令恒 false */
export function isArgInvalid(arg: RemoteCommandArg | undefined, raw: string): boolean {
  if (!arg) {
    return false;
  }
  const value = checkValue(arg, raw);
  if (value === '') {
    return Boolean(arg.required);
  }
  return Boolean(arg.pattern && !arg.pattern.test(value));
}

/** 真正下发给机台的值：无参指令恒空串；有 normalize 的按归一化值；其余原样（不 trim 命令行类参数） */
export function commandArgValue(arg: RemoteCommandArg | undefined, raw: string): string {
  if (!arg) {
    return '';
  }
  return arg.normalize ? arg.normalize(raw) : raw;
}

/** 参数格式签名：签名相同即视为同一参数格式（download / downloadpro 共享），切换时保留已填值 */
export function argFormatKey(arg: RemoteCommandArg | undefined): string {
  return arg ? arg.hintKey : '';
}

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

// ---------- 日期格式化（等价旧版 Angular date 管道） ----------

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/** yyyy-MM-dd HH:mm:ss（本地时区，等价 `| date: 'yyyy-MM-dd HH:mm:ss'`） */
export function formatFullDateTime(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}:${twoDigits(date.getSeconds())}`;
}

/** HH:mm:ss（等价 `| date: 'HH:mm:ss'`） */
export function formatClock(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}:${twoDigits(date.getSeconds())}`;
}

/** yyyy-MM-dd HH:mm（等价 `| date: 'yyyy-MM-dd HH:mm'`；授权/加入时间列） */
export function formatMinutesDateTime(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

/** MM-dd HH:mm（等价 `| date: 'MM-dd HH:mm'`） */export function formatShortDateTime(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return `${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}
