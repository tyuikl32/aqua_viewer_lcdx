/**
 * 国服卡号解码与判定（前端镜像，供设置页「国服数据引继」门控与卡片页「登机二维码」入口使用）。
 *
 * 唯一事实源：`LCDXNetApi/Helper/NcbtQrGenerator.cs` 的 `TryResolveClientId`。
 * 两种码段，靠**第 11 位**区分：
 *
 *   新码  `2430443067` + padLeft10(cid × 83 + 4579)
 *   旧码  `243044306799` + 8 位 cid
 *
 * 为什么第 11 位可靠：合法 cid 区间 [10_000_000, 20_000_000) 内
 * `cid × 83 + 4579 ∈ [830,004,579, 1,660,004,496]`，补零后首位只能是 '0' 或 '1'；
 * 旧码第 11 位恒为 '9'。三者互斥（线上 74 条实测零例外）。
 *
 * 最终统一做 cid 区间校验：既挡「旧码巧合满足新码公式」，也挡明文首位碰撞
 * （cid 50000000 与 10000000 去掉首位后相同）。
 *
 * **改这里的判定必须同时改后端**，否则前端会出现「能点但必失败」（引继）或
 * 「能点但出不了码」（二维码）。
 */

const GUOFU_CARD_PREFIX = '2430443067';
const LEGACY_CARD_PREFIX = '243044306799';
const GUOFU_CARD_ENCODE_MULTIPLIER = 83;
const GUOFU_CARD_ENCODE_OFFSET = 4579;
const ACCESS_CODE_LENGTH = 20;
const DIGITS_ONLY = /^\d+$/;

/** 可编码进游戏离线码的 clientId 区间（8 位且首位为 1）。 */
const MIN_CLIENT_ID = 10_000_000;
const MAX_CLIENT_ID_EXCLUSIVE = 20_000_000;

/**
 * 20 位卡号 → clientId；不可解返回 null。
 * 新码优先、旧码兜底，两种码段都做区间校验。纯函数，不做任何 IO。
 */
export function decodeGuofuCardId(cardNumber: string | null | undefined): number | null {
  const value = cardNumber ?? '';
  if (value.length !== ACCESS_CODE_LENGTH || !DIGITS_ONLY.test(value)) {
    return null;
  }
  if (!value.startsWith(GUOFU_CARD_PREFIX)) {
    return null;
  }

  const discriminator = value.at(GUOFU_CARD_PREFIX.length);
  let clientId: number | null = null;

  if (discriminator === '9') {
    // 旧码：243044306799 + 8 位 clientId
    if (value.startsWith(LEGACY_CARD_PREFIX)) {
      const legacy = Number(value.slice(LEGACY_CARD_PREFIX.length));
      if (Number.isSafeInteger(legacy)) {
        clientId = legacy;
      }
    }
  } else if (discriminator === '0' || discriminator === '1') {
    // 新码：2430443067 + pad10(cid * 83 + 4579)
    const suffix = Number(value.slice(GUOFU_CARD_PREFIX.length));
    if (Number.isSafeInteger(suffix)) {
      const raw = suffix - GUOFU_CARD_ENCODE_OFFSET;
      if (raw >= 0 && raw % GUOFU_CARD_ENCODE_MULTIPLIER === 0) {
        clientId = raw / GUOFU_CARD_ENCODE_MULTIPLIER;
      }
    }
  }

  if (clientId === null || clientId < MIN_CLIENT_ID || clientId >= MAX_CLIENT_ID_EXCLUSIVE) {
    return null;
  }

  return clientId;
}

/**
 * 是否是可参与国服业务的卡号（新码或旧码）。物理卡、别名卡、空值、非法长度一律 false。
 */
export function isGuofuCardNumber(cardNumber: string | null | undefined): boolean {
  return decodeGuofuCardId(cardNumber) !== null;
}
