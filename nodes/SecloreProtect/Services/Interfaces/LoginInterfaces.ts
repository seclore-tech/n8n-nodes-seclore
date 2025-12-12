export interface ILoginRequest {
  tenantId: string;
  tenantSecret: string;
}

export interface ILoginResponse {
  accessToken: string;
  refreshToken: string;
  headers?: { [key: string]: string };
}

export interface IRefreshTokenRequest {
  refreshToken: string;
}
