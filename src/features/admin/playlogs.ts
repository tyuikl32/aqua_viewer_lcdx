import { api, type QueryParams } from '@/lib/api/client';
import { StatusCode } from '@/lib/models';
import type {
  AdminPlaylogDetail,
  AdminPlaylogGame,
  AdminPlaylogSearchField,
  AdminPlaylogSummary,
  ApiResponse,
  ReducedPageResponse,
} from '@/lib/api/admin-playlog-contracts';

export interface PlaylogQuery {
  game: AdminPlaylogGame;
  field: AdminPlaylogSearchField;
  value: string;
  page: number;
}

export const PLAYLOG_PAGE_SIZE = 12;

async function getData<T>(path: string, params?: QueryParams): Promise<T> {
  const response = await api.get(path, params) as ApiResponse<T>;
  // Some API failures use HTTP 200; preserve the actionable message in data.
  if (response?.status?.code !== StatusCode.OK || response.data == null) {
    const message = typeof response?.data === 'string' ? response.data : response?.status?.message;
    throw new Error(message || '无法加载游玩记录，请重试');
  }
  return response.data;
}

export function searchPlaylogs(query: PlaylogQuery) {
  return getData<ReducedPageResponse<AdminPlaylogSummary>>(`api/admin/playlogs/${query.game}`, {
    field: query.field,
    value: query.value.trim(),
    page: query.page,
    size: PLAYLOG_PAGE_SIZE,
  });
}

export function getPlaylogDetail(game: AdminPlaylogGame, id: number) {
  if (!Number.isSafeInteger(id)) {
    return Promise.reject(new Error('记录 ID 超出浏览器可精确表示的范围，无法查询详情。'));
  }
  return getData<AdminPlaylogDetail>(`api/admin/playlogs/${game}/${id}`);
}
