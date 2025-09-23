export interface ApiResponse<T> {
  data: T;
  time: string;
  status: number;
}
