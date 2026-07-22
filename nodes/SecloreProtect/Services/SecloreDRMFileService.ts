import { IExecuteFunctions } from 'n8n-workflow';
import {
	IClassifyRequest,
	IClassifyResponse,
	IDeclassifyRequest,
	IDeclassifyResponse,
	IGetFileClassificationResponse,
	IGetLabelsRequest,
	IGetLabelsResponse,
	IReclassifyRequest,
	IReclassifyResponse,
} from './Interfaces/ClassifyInterfaces';
import { IFileDownloadResponse, IFileUploadResponse } from './Interfaces/FileStorageInterfaces';
import {
	IProtectWithExternalRefIdRequest,
	IProtectWithExternalRefIdResponse,
	IProtectWithFileIdRequest,
	IProtectWithFileIdResponse,
	IProtectWithHotFolderRequest,
	IProtectWithHotFolderResponse,
} from './Interfaces/ProtectInterfaces';
import { IUnprotectRequest, IUnprotectResponse } from './Interfaces/UnprotectInterfaces';
import { SecloreDRMApiService } from './SecloreDRMApiService';

export class SecloreDRMFileService {
	private apiService: SecloreDRMApiService;

	constructor(
		context: IExecuteFunctions,
		baseUrl: string,
	) {
		this.apiService = new SecloreDRMApiService(context, baseUrl);
	}

	/**
	 * Protect file using external identifier with automatic authentication
	 */
	async protectWithExternalRefId(
		protectRequest: IProtectWithExternalRefIdRequest,
		correlationId?: string,
	): Promise<IProtectWithExternalRefIdResponse> {
		
		const result = await this.apiService.protectWithExternalRefId(protectRequest, correlationId);
		return result;
	}

	/**
	 * Protect file using existing protected file ID with automatic authentication
	 */
	async protectWithFileId(
		protectRequest: IProtectWithFileIdRequest,
		correlationId?: string,
	): Promise<IProtectWithFileIdResponse> {
		const result = await this.apiService.protectWithFileId(protectRequest, correlationId);
		return result;
	}

	/**
	 * Protect file using HotFolder ID with automatic authentication
	 */
	async protectWithHotFolder(
		protectRequest: IProtectWithHotFolderRequest,
		correlationId?: string,
	): Promise<IProtectWithHotFolderResponse> {
		const result = await this.apiService.protectWithHotFolder(protectRequest, correlationId);
		return result;
	}

	/**
	 * Unprotect file with automatic authentication
	 */
	async unprotect(
		unprotectRequest: IUnprotectRequest,
		correlationId?: string,
	): Promise<IUnprotectResponse> {
		const result = await this.apiService.unprotect(unprotectRequest, correlationId);
		return result;
	}

	/**
	 * Classify file with automatic authentication
	 */
	async classify(
		classifyRequest: IClassifyRequest,
		correlationId?: string,
	): Promise<IClassifyResponse> {
		const result = await this.apiService.classify(classifyRequest, correlationId);
		return result;
	}

	/**
	 * Reclassify file with automatic authentication
	 */
	async reclassify(
		reclassifyRequest: IReclassifyRequest,
		correlationId?: string,
	): Promise<IReclassifyResponse> {
		const result = await this.apiService.reclassify(reclassifyRequest, correlationId);
		return result;
	}

	/**
	 * Declassify file with automatic authentication
	 */
	async declassify(
		declassifyRequest: IDeclassifyRequest,
		correlationId?: string,
	): Promise<IDeclassifyResponse> {
		const result = await this.apiService.declassify(declassifyRequest, correlationId);
		return result;
	}

	/**
	 * Get the current classification of a file with automatic authentication
	 */
	async getFileClassification(
		fileStorageId: string,
		correlationId?: string,
	): Promise<IGetFileClassificationResponse> {
		const result = await this.apiService.getFileClassification(fileStorageId, correlationId);
		return result;
	}

	/**
	 * Get all classification labels with automatic authentication
	 */
	async getLabels(
		getLabelsRequest: IGetLabelsRequest,
		correlationId?: string,
	): Promise<IGetLabelsResponse> {
		const result = await this.apiService.getLabels(getLabelsRequest, correlationId);
		return result;
	}

	/**
	 * Upload file with automatic authentication
	 */
	async uploadFile(
		fileBuffer: Uint8Array,
		fileName: string,
		correlationId?: string,
	): Promise<IFileUploadResponse> {
		const result = await this.apiService.uploadFile(fileBuffer, fileName, correlationId);
		return result;
	}

	/**
	 * Download file with automatic authentication
	 * NOTE: Files whose fileStorageId has 'DL_' prefix will be deleted from the file storage after download.
	 */
	async downloadFile(
		fileStorageId: string,
		correlationId?: string,
	): Promise<IFileDownloadResponse> {
		const result = await this.apiService.downloadFile(fileStorageId, correlationId);
		return result;
	}

	/**
	 * Delete file with automatic authentication
	 */
	async deleteFile(
		fileStorageId: string,
		correlationId?: string,
	): Promise<void> {
		await this.apiService.deleteFile(fileStorageId, correlationId);
	}

}
