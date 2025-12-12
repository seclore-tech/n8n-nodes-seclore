export interface IFileUploadResponse {
  fileStorageId: string;
  fileName: string;
  downloadUrl: string;
  fileType: string;
  fileSize: number;
  secloreFileId: string;
  protected: boolean;
  headers?: { [key: string]: string };
}

export interface IFileDownloadResponse {
  data: Uint8Array;
  headers?: { [key: string]: string };
}

export interface IFileDeleteResponse {
  headers?: { [key: string]: string };
}
