export interface IClassifyRequest {
  fileStorageId: string;
  labelId: string;
  forceLabelRefresh?: boolean;
}

export interface IClassifyResponse {
  fileStorageId: string;
  labelId: string;
  labelName: string;
  headers?: { [key: string]: string };
}

export interface ILabelInfo {
  labelId: string;
  labelName: string;
}

export interface IReclassifyRequest {
  fileStorageId: string;
  labelId: string;
  forceLabelRefresh?: boolean;
}

export interface IReclassifyResponse {
  fileStorageId: string;
  currentLabel: ILabelInfo;
  oldLabel: ILabelInfo;
  headers?: { [key: string]: string };
}

export interface IDeclassifyRequest {
  fileStorageId: string;
  forceLabelRefresh?: boolean;
}

export interface IDeclassifyResponse {
  fileStorageId: string;
  labelId: string | null;
  labelName: string | null;
  headers?: { [key: string]: string };
}

export interface IGetFileClassificationResponse {
  classified: boolean;
  classificationInfo: unknown;
  headers?: { [key: string]: string };
}

export interface IGetLabelsRequest {
  fileStorageId: string;
  forceLabelRefresh?: boolean;
}

export interface IGetLabelsResponse {
  labels: unknown;
  headers?: { [key: string]: string };
}
