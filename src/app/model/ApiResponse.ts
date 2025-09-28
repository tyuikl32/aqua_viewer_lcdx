export interface ApiResponse<T> {
  data: T;
  time: string;
  status: {
    code: number,
    message: string
  };
}

export function isOk<T>(resp: ApiResponse<T>) {
  return resp?.status?.code == 9_200_1;
}