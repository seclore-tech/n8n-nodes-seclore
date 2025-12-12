export interface IUnprotectRequest {
  fileStorageId: string;
}

export interface IUnprotectResponse {
  fileStorageId: string;
  headers?: { [key: string]: string };
}
