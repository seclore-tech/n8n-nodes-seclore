export interface IExtRefProtectionDetail {
  externalReferenceId: string;
  externalReferenceName?: string;
  externalReferenceData?: string;
  externalAppId?: string;
}

export interface IProtectWithExternalRefIdRequest {
  hotfolderExternalReference: IExtRefProtectionDetail;
  fileExternalReference?: IExtRefProtectionDetail;
  fileStorageId: string;
}

export interface IProtectWithExternalRefIdResponse {
  fileStorageId: string;
  secloreFileId: string;
  headers?: { [key: string]: string };
}

export interface IProtectWithFileIdRequest {
  existingProtectedFileId: string;
  fileStorageId: string;
}

export interface IProtectWithFileIdResponse {
  fileStorageId: string;
  secloreFileId: string;
  headers?: { [key: string]: string };
}

export interface IProtectWithHotFolderRequest {
  hotfolderId: string;
  fileStorageId: string;
}

export interface IProtectWithHotFolderResponse {
  fileStorageId: string;
  secloreFileId: string;
  headers?: { [key: string]: string };
}
