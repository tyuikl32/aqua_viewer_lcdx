/**
 * 国服卡号判定（前端镜像，供 maimai2 设置页的「国服数据引继」入口门控使用）。
 *
 * 唯一事实源：`LCDXNetApi/Services/UserService.cs` 的 `TryConvertCardIdToUserId`。
 * 卡号编码 = `"2430443067"` + padLeft10(国服 userId × 83 + 4579)，
 * 反推 userId = (后 10 位 − 4579) / 83，必须整除。
 *
 * 引继相关端点（`lcdx/mergeRegistry/*`）只接受这种卡号，其余一律回落
 * `94001 Invalid card id`；因此默认卡不是国服卡号时，整块入口都不渲染。
 * **改这里的判定必须同时改后端**，否则前端会出现「能点但必失败」的按钮。
 *
 * 旧方案 `243044306799` + 8 位原始 clientId（LCTitleServer 仍兼容）在这里刻意不放行：
 * LCDXNetApi 目前会拒掉它，前端放行只会把一个必然失败的按钮重新露出来。
 */

const GUOFU_CARD_PREFIX = '2430443067';
const GUOFU_CARD_ENCODE_MULTIPLIER = 83;
const GUOFU_CARD_ENCODE_OFFSET = 4579;
const ACCESS_CODE_LENGTH = 20;
const DIGITS_ONLY = /^\d+$/;

/**
 * 20 位国服卡号 → true；其余（实体 Aime 卡、旧方案卡号、空值、非法长度）→ false。
 * 纯函数，不做任何 IO。
 */
export function isGuofuCardNumber(cardNumber: string | null | undefined): boolean {
  const value = cardNumber ?? '';
  if (value.length !== ACCESS_CODE_LENGTH || !DIGITS_ONLY.test(value)) {
    return false;
  }
  if (!value.startsWith(GUOFU_CARD_PREFIX)) {
    return false;
  }

  const suffix = Number(value.slice(GUOFU_CARD_PREFIX.length));
  if (!Number.isSafeInteger(suffix) || suffix <= GUOFU_CARD_ENCODE_OFFSET) {
    return false;
  }
  return (suffix - GUOFU_CARD_ENCODE_OFFSET) % GUOFU_CARD_ENCODE_MULTIPLIER === 0;
}
