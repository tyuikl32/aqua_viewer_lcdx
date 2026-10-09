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

async function getData<T>(path: string, params: QueryParams | undefined, fallbackMessage: string): Promise<T> {
  const response = await api.get(path, params) as ApiResponse<T>;
  // Some API failures use HTTP 200; preserve the actionable message in data.
  if (response?.status?.code !== StatusCode.OK || response.data == null) {
    const message = typeof response?.data === 'string' ? response.data : response?.status?.message;
    throw new Error(message || fallbackMessage);
  }
  return response.data;
}

export function searchPlaylogs(query: PlaylogQuery, fallbackMessage: string) {
  return getData<ReducedPageResponse<AdminPlaylogSummary>>(`api/admin/playlogs/${query.game}`, {
    field: query.field,
    value: query.value.trim(),
    page: query.page,
    size: PLAYLOG_PAGE_SIZE,
  }, fallbackMessage);
}

export function getPlaylogDetail(game: AdminPlaylogGame, id: number, outOfRangeMessage: string) {
  if (!Number.isSafeInteger(id)) {
    return Promise.reject(new Error(outOfRangeMessage));
  }
  return getData<AdminPlaylogDetail>(`api/admin/playlogs/${game}/${id}`, undefined, outOfRangeMessage);
}
