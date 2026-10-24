import { lcdx } from '@/lib/api/client';
import type { ApiResponse } from '@/lib/models';

/** 机台登入二维码生成结果。`payload` 是 40 字符 NCBT 码，只在内存里流转。 */
export interface CardQrPayload {
  payload: string;
  expiresInSeconds: number;
}

/**
 * 为当前账号的主卡生成一枚机台登入二维码。
 *
 * 失败以 `status.code` 表达（HTTP 200）：94001 卡号不支持 / 94031 非本人卡 /
 * 94032 太频繁 / 95001 暂时无法校验归属。
 */
export function fetchCardQr(userName: string, cardId: string): Promise<ApiResponse<CardQrPayload>> {
  return lcdx.post(`lcdx/cardQr/${encodeURIComponent(userName)}`, { cardId }) as Promise<
    ApiResponse<CardQrPayload>
  >;
}
