import { lcdx } from '@/lib/api/client';
import type { ApiResponse } from '@/lib/models';

/** 机台登入二维码生成结果。`payload` 是 40 字符 NCBT 码，只在内存里流转。 */
export interface CardQrPayload {
  payload: string;
  /** 相对秒数（兼容字段，540 = 最坏可用时长）。 */
  expiresInSeconds: number;
  /**
   * 绝对失效时刻（ISO 8601 带偏移）。由服务端推导，**权威值**：
   * 相对秒数从响应送达起算，会比真实失效晚一个请求耗时。
   * 旧后端不返回此字段，调用方必须能回退到 `expiresInSeconds`。
   */
  expiresAt?: string;
  /** true = 服务端复用了已发行的同一枚码（页面刷新 / 重挂载）；旧后端不返回。 */
  resumed?: boolean;
}

/**
 * 为当前账号的主卡取机台登入二维码。
 *
 * `resume = true`：尽量拿回**已发行的同一枚码**（页面刷新、组件重挂载用），
 * 服务端命中时不重新发码、不占频控、不写审计。
 * `resume = false`：要求发新码（用户点「刷新」），受 10 秒频控约束。
 *
 * 失败以 `status.code` 表达（HTTP 200）：94001 卡号不支持 / 94031 非本人卡 /
 * 94032 太频繁 / 95001 暂时无法校验归属。
 */
export function fetchCardQr(
  userName: string,
  cardId: string,
  resume = false,
): Promise<ApiResponse<CardQrPayload>> {
  return lcdx.post(`lcdx/cardQr/${encodeURIComponent(userName)}`, { cardId, resume }) as Promise<
    ApiResponse<CardQrPayload>
  >;
}
