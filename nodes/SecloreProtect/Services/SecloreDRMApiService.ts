import { IExecuteFunctions, IHttpRequestOptions, NodeApiError, LoggerProxy as Logger } from 'n8n-workflow';
import { IErrorResponse } from './Interfaces/ErrorInterfaces';
import { IFileUploadResponse, IFileDownloadResponse, IFileDeleteResponse } from './Interfaces/FileStorageInterfaces';
import { ILoginRequest, ILoginResponse, IRefreshTokenRequest } from './Interfaces/LoginInterfaces';
import {
	IProtectWithExternalRefIdRequest,
	IProtectWithExternalRefIdResponse,
	IProtectWithFileIdRequest,
	IProtectWithFileIdResponse,
	IProtectWithHotFolderRequest,
	IProtectWithHotFolderResponse,
} from './Interfaces/ProtectInterfaces';
import { IUnprotectRequest, IUnprotectResponse } from './Interfaces/UnprotectInterfaces';

export class SecloreDRMApiService {
	constructor(
		private context: IExecuteFunctions,
		private baseUrl: string,
	) { }

	/**
	 * Common error handler for HTTP responses
	 * @param error - The error object from httpRequest
	 * @param customMessages - Optional custom error messages for specific status codes
	 */
	private handleHttpError(
		error: NodeApiError,
		customMessages?: { [statusCode: number]: string },
	): never {
		const statusCode: number = parseInt(error.httpCode ?? '0');
		const errorResponse = error.errorResponse as unknown as IErrorResponse;

		if (customMessages && customMessages[statusCode]) {
			throw new Error(
				`${customMessages[statusCode]}: ${errorResponse?.errorMessage || 'Unknown error'}`,
			);
		}

		// Default error handling
		switch (statusCode) {
			case 400:
				throw new Error(`Bad Request: ${errorResponse?.errorMessage || 'Invalid request data'}`);
			case 401:
				throw new Error(`Unauthorized: ${errorResponse?.errorMessage || 'Invalid credentials'}`);
			case 413:
				throw new Error(
					`Payload Too Large: ${errorResponse?.errorMessage || 'File size exceeds limit'}`,
				);
			case 500:
				throw new Error(`Server Error: ${errorResponse?.errorMessage || 'Internal server error'}`);
			default:
				throw error;
		}
	}

	/**
	 * Login Endpoint to generate Access Token and Refresh Token for JWT Authorization.
	 * Upon successful login, all the existing previous tokens for that tenant will be invalidated.
	 *
	 * @param tenantId - The tenant ID
	 * @param tenantSecret - The tenant secret
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<ILoginResponse> - Access token and refresh token
	 * @throws Error on authentication failure or server error
	 */
	async login(
		tenantId: string,
		tenantSecret: string,
		correlationId?: string,
	): Promise<ILoginResponse> {
		const who = "SecloreDRMApiService::login:: ";
		try {
			Logger.debug(who + 'Attempting login', { tenantId, correlationId });
			
			const requestBody: ILoginRequest = {
				tenantId,
				tenantSecret,
			};

			const headers: { [key: string]: string } = {
				'Content-Type': 'application/json',
			};

			// Add correlation ID if provided
			if (correlationId) {
				headers['X-SECLORE-CORRELATION-ID'] = correlationId;
			}

			const options: IHttpRequestOptions = {
				method: 'POST',
				url: `${this.baseUrl}/seclore/drm/1.0/auth/login`,
				headers,
				body: requestBody,
				json: true,
			};

			Logger.debug(who + 'Making HTTP request', { url: options.url, method: options.method, correlationId });
			const response = await this.context.helpers.httpRequest({ ...options, returnFullResponse: true });
			Logger.debug(who + 'Login successful', { tenantId, correlationId });
			
			const loginResponse: ILoginResponse = {
				...(response.body as ILoginResponse),
				headers: response.headers as { [key: string]: string }
			};
			
			return loginResponse;
		} catch (error: unknown) {
			Logger.error(who + 'Login failed', { error, tenantId, correlationId });
			this.handleHttpError(error as NodeApiError);
		}
	}

	/**
	 * Endpoint for generating new Access Token and Refresh Token using an existing valid Refresh Token.
	 * Upon successful response, all the previous existing Access Tokens and Refresh Tokens of that tenant will be invalidated.
	 *
	 * @param refreshToken - The existing valid refresh token
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<ILoginResponse> - New access token and refresh token
	 * @throws Error on authentication failure or server error
	 */
	async refreshToken(refreshToken: string, correlationId?: string): Promise<ILoginResponse> {
		const who = "SecloreDRMApiService::refreshToken:: ";
		try {
			Logger.debug(who + 'Attempting token refresh', { correlationId });
			
			const requestBody: IRefreshTokenRequest = {
				refreshToken,
			};

			const headers: { [key: string]: string } = {
				'Content-Type': 'application/json',
			};

			// Add correlation ID if provided
			if (correlationId) {
				headers['X-SECLORE-CORRELATION-ID'] = correlationId;
			}

			const options: IHttpRequestOptions = {
				method: 'POST',
				url: `${this.baseUrl}/seclore/drm/1.0/auth/refresh`,
				headers,
				body: requestBody,
				json: true,
			};

			Logger.debug(who + 'Making HTTP request', { url: options.url, method: options.method, correlationId });
			const response = await this.context.helpers.httpRequest({ ...options, returnFullResponse: true });
			Logger.debug(who + 'Token refresh successful', { correlationId });
			
			const refreshResponse: ILoginResponse = {
				...(response.body as ILoginResponse),
				headers: response.headers as { [key: string]: string }
			};
			
			return refreshResponse;
		} catch (error: unknown) {
			Logger.error(who + 'Token refresh failed', { error, correlationId });
			this.handleHttpError(error as NodeApiError, { 401: 'Unauthorized' });
		}
	}

	/**
	 * Protect file using external identifier of protected File and HotFolder with PS configured against the logged in Tenant in application.
	 *
	 * @param protectRequest - The protection request details
	 * @param accessToken - JWT access token for authorization
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IProtectWithExternalRefIdResponse> - File storage ID and Seclore file ID
	 * @throws Error on bad request, authentication failure or server error
	 */
	async protectWithExternalRefId(
		protectRequest: IProtectWithExternalRefIdRequest,
		accessToken: string,
		correlationId?: string,
	): Promise<IProtectWithExternalRefIdResponse> {
		const who = "SecloreDRMApiService::protectWithExternalRefId:: ";
		try {
			Logger.debug(who + 'Protecting file with external ref ID', { 
				fileStorageId: protectRequest.fileStorageId,
				hotfolderExternalReferenceId: protectRequest.hotfolderExternalReference.externalReferenceId,
				correlationId 
			});
			
			const headers: { [key: string]: string } = {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			};

			// Add correlation ID if provided
			if (correlationId) {
				headers['X-SECLORE-CORRELATION-ID'] = correlationId;
			}

			const options: IHttpRequestOptions = {
				method: 'POST',
				url: `${this.baseUrl}/seclore/drm/1.0/protect/externalref`,
				headers,
				body: protectRequest,
				json: true,
			};

			Logger.debug(who + 'Making HTTP request', { url: options.url, method: options.method, correlationId });
			const response = await this.context.helpers.httpRequest({ ...options, returnFullResponse: true });
			Logger.debug(who + 'Protection with external ref ID successful', { 
				fileStorageId: protectRequest.fileStorageId,
				secloreFileId: (response.body as IProtectWithExternalRefIdResponse).secloreFileId,
				correlationId 
			});
			
			const protectResponse: IProtectWithExternalRefIdResponse = {
				...(response.body as IProtectWithExternalRefIdResponse),
				headers: response.headers as { [key: string]: string }
			};
			
			return protectResponse;
		} catch (error: unknown) {
			Logger.error(who + 'Protection with external ref ID failed', { 
				error, 
				fileStorageId: protectRequest.fileStorageId, 
				correlationId 
			});
			this.handleHttpError(error as NodeApiError);
		}
	}

	/**
	 * Protects file using File ID of already protected file with PS configured against the logged in Tenant in application.
	 *
	 * @param protectRequest - The protection request details with existing protected file ID
	 * @param accessToken - JWT access token for authorization
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IProtectWithFileIdResponse> - File storage ID and Seclore file ID
	 * @throws Error on bad request, authentication failure or server error
	 */
	async protectWithFileId(
		protectRequest: IProtectWithFileIdRequest,
		accessToken: string,
		correlationId?: string,
	): Promise<IProtectWithFileIdResponse> {
		const who = "SecloreDRMApiService::protectWithFileId:: ";
		try {
			Logger.debug(who + 'Protecting file with file ID', { 
				existingProtectedFileId: protectRequest.existingProtectedFileId,
				fileStorageId: protectRequest.fileStorageId,
				correlationId 
			});
			
			const headers: { [key: string]: string } = {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			};

			// Add correlation ID if provided
			if (correlationId) {
				headers['X-SECLORE-CORRELATION-ID'] = correlationId;
			}

			const options: IHttpRequestOptions = {
				method: 'POST',
				url: `${this.baseUrl}/seclore/drm/1.0/protect/fileid`,
				headers,
				body: protectRequest,
				json: true,
			};

			Logger.debug(who + 'Making HTTP request', { url: options.url, method: options.method, correlationId });
			const response = await this.context.helpers.httpRequest({ ...options, returnFullResponse: true });
			Logger.debug(who + 'Protection with file ID successful', { 
				existingProtectedFileId: protectRequest.existingProtectedFileId,
				secloreFileId: (response.body as IProtectWithFileIdResponse).secloreFileId,
				correlationId 
			});
			
			const protectResponse: IProtectWithFileIdResponse = {
				...(response.body as IProtectWithFileIdResponse),
				headers: response.headers as { [key: string]: string }
			};
			
			return protectResponse;
		} catch (error: unknown) {
			Logger.error(who + 'Protection with file ID failed', { 
				error, 
				existingProtectedFileId: protectRequest.existingProtectedFileId, 
				correlationId 
			});
			this.handleHttpError(error as NodeApiError);
		}
	}

	/**
	 * Protects file using HotFolder ID with PS configured against the logged in Tenant in application.
	 *
	 * @param protectRequest - The protection request details with hotfolder ID
	 * @param accessToken - JWT access token for authorization
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IProtectWithHotFolderResponse> - File storage ID and Seclore file ID
	 * @throws Error on bad request, authentication failure or server error
	 */
	async protectWithHotFolder(
		protectRequest: IProtectWithHotFolderRequest,
		accessToken: string,
		correlationId?: string,
	): Promise<IProtectWithHotFolderResponse> {
		const who = "SecloreDRMApiService::protectWithHotFolder:: ";
		try {
			Logger.debug(who + 'Protecting file with hot folder', { 
				hotfolderId: protectRequest.hotfolderId,
				fileStorageId: protectRequest.fileStorageId,
				correlationId 
			});
			
			const headers: { [key: string]: string } = {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			};

			// Add correlation ID if provided
			if (correlationId) {
				headers['X-SECLORE-CORRELATION-ID'] = correlationId;
			}

			const options: IHttpRequestOptions = {
				method: 'POST',
				url: `${this.baseUrl}/seclore/drm/1.0/protect/hf`,
				headers,
				body: protectRequest,
				json: true,
			};

			Logger.debug(who + 'Making HTTP request', { url: options.url, method: options.method, correlationId });
			const response = await this.context.helpers.httpRequest({ ...options, returnFullResponse: true });
			Logger.debug(who + 'Protection with hot folder successful', { 
				hotfolderId: protectRequest.hotfolderId,
				secloreFileId: (response.body as IProtectWithHotFolderResponse).secloreFileId,
				correlationId 
			});
			
			const protectResponse: IProtectWithHotFolderResponse = {
				...(response.body as IProtectWithHotFolderResponse),
				headers: response.headers as { [key: string]: string }
			};
			
			return protectResponse;
		} catch (error: unknown) {
			Logger.error(who + 'Protection with hot folder failed', { 
				error, 
				hotfolderId: protectRequest.hotfolderId, 
				fileStorageId: protectRequest.fileStorageId, 
				correlationId 
			});
			this.handleHttpError(error as NodeApiError);
		}
	}

	/**
	 * Unprotects file with PS configured against the logged in Tenant in application.
	 *
	 * @param unprotectRequest - The unprotect request details with file storage ID
	 * @param accessToken - JWT access token for authorization
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IUnprotectResponse> - File storage ID of unprotected file
	 * @throws Error on bad request, authentication failure or server error
	 */
	async unprotect(
		unprotectRequest: IUnprotectRequest,
		accessToken: string,
		correlationId?: string,
	): Promise<IUnprotectResponse> {
		const who = "SecloreDRMApiService::unprotect:: ";
		try {
			Logger.debug(who + 'Unprotecting file', { 
				fileStorageId: unprotectRequest.fileStorageId,
				correlationId 
			});
			
			const headers: { [key: string]: string } = {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			};

			// Add correlation ID if provided
			if (correlationId) {
				headers['X-SECLORE-CORRELATION-ID'] = correlationId;
			}

			const options: IHttpRequestOptions = {
				method: 'POST',
				url: `${this.baseUrl}/seclore/drm/1.0/unprotect`,
				headers,
				body: unprotectRequest,
				json: true,
			};

			Logger.debug(who + 'Making HTTP request', { url: options.url, method: options.method, correlationId });
			const response = await this.context.helpers.httpRequest({ ...options, returnFullResponse: true });
			Logger.debug(who + 'Unprotection successful', { 
				originalFileStorageId: unprotectRequest.fileStorageId,
				unprotectedFileStorageId: (response.body as IUnprotectResponse).fileStorageId,
				correlationId 
			});
			
			const unprotectResponse: IUnprotectResponse = {
				...(response.body as IUnprotectResponse),
				headers: response.headers as { [key: string]: string }
			};
			
			return unprotectResponse;
		} catch (error: unknown) {
			Logger.error(who + 'Unprotection failed', { 
				error, 
				fileStorageId: unprotectRequest.fileStorageId, 
				correlationId 
			});
			this.handleHttpError(error as NodeApiError);
		}
	}

	/**
	 * Adds a new file to the file storage for currently logged in Tenant.
	 *
	 * @param fileBuffer - The file buffer data
	 * @param fileName - The name of the file
	 * @param accessToken - JWT access token for authorization
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IFileUploadResponse> - File storage details including file ID and metadata
	 * @throws Error on authentication failure, payload too large, or server error
	 */
	async uploadFile(
		fileBuffer: Uint8Array,
		fileName: string,
		accessToken: string,
		correlationId?: string,
	): Promise<IFileUploadResponse> {
		const who = "SecloreDRMApiService::uploadFile:: ";
		try {
			Logger.debug(who + 'Uploading file', { 
				fileName,
				fileSize: fileBuffer.length,
				correlationId 
			});
			
			const headers: { [key: string]: string } = {
				Authorization: `Bearer ${accessToken}`,
			};

			// Add correlation ID if provided
			if (correlationId) {
				headers['X-SECLORE-CORRELATION-ID'] = correlationId;
			}

			// Create FormData for multipart/form-data upload
			const formData = new FormData();
			const file = new Blob([fileBuffer], { type: 'application/octet-stream' });
			formData.append('file', file, fileName);

			const options: IHttpRequestOptions = {
				method: 'POST',
				url: `${this.baseUrl}/seclore/drm/filestorage/1.0/upload`,
				headers,
				body: formData,
			};

			Logger.debug(who + 'Making HTTP request', { url: options.url, method: options.method, fileName, correlationId });
			const response = await this.context.helpers.httpRequest({ ...options, returnFullResponse: true });
			Logger.debug(who + 'File upload successful', { 
				fileName,
				fileStorageId: (response.body as IFileUploadResponse).fileStorageId,
				correlationId 
			});
			
			const uploadResponse: IFileUploadResponse = {
				...(response.body as IFileUploadResponse),
				headers: response.headers as { [key: string]: string }
			};
			
			return uploadResponse;
		} catch (error: unknown) {
			Logger.error(who + 'File upload failed', { 
				error, 
				fileName, 
				fileSize: fileBuffer.length, 
				correlationId 
			});
			this.handleHttpError(error as NodeApiError);
		}
	}

	/**
	 * Downloads file with fileStorageId from file storage of currently logged in Tenant.
	 * NOTE: Files whose fileStorageId has 'DL_' prefix will be deleted from the file storage after download.
	 *
	 * @param fileStorageId - Storage ID of the file to be retrieved
	 * @param accessToken - JWT access token for authorization
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IFileDownloadResponse> - The downloaded file data with headers
	 * @throws Error on authentication failure or server error
	 */
	async downloadFile(
		fileStorageId: string,
		accessToken: string,
		correlationId?: string,
	): Promise<IFileDownloadResponse> {
		const who = "SecloreDRMApiService::downloadFile:: ";
		try {
			Logger.debug(who + 'Downloading file', { 
				fileStorageId,
				correlationId 
			});
			
			const headers: { [key: string]: string } = {
				Authorization: `Bearer ${accessToken}`,
			};

			// Add correlation ID if provided
			if (correlationId) {
				headers['X-SECLORE-CORRELATION-ID'] = correlationId;
			}

			const options: IHttpRequestOptions = {
				method: 'GET',
				url: `${this.baseUrl}/seclore/drm/filestorage/1.0/download/${fileStorageId}`,
				headers,
				encoding: 'arraybuffer',
			};

			Logger.debug(who + 'Making HTTP request', { url: options.url, method: options.method, fileStorageId, correlationId });
			const response = await this.context.helpers.httpRequest({ ...options, returnFullResponse: true });
			const fileData = new Uint8Array(response.body as ArrayBuffer);
			Logger.debug(who + 'File download successful', { 
				fileStorageId,
				fileSize: fileData.length,
				correlationId 
			});
			
			const downloadResponse: IFileDownloadResponse = {
				data: fileData,
				headers: response.headers as { [key: string]: string }
			};
			
			return downloadResponse;
		} catch (error: unknown) {
			Logger.error(who + 'File download failed', { 
				error, 
				fileStorageId, 
				correlationId 
			});
			this.handleHttpError(error as NodeApiError);
		}
	}

	/**
	 * Deletes a file with fileStorageId from file storage of currently logged in Tenant.
	 *
	 * @param fileStorageId - Storage ID of the file to be deleted
	 * @param accessToken - JWT access token for authorization
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IFileDeleteResponse> - Response headers on successful deletion
	 * @throws Error on authentication failure or server error
	 */
	async deleteFile(
		fileStorageId: string,
		accessToken: string,
		correlationId?: string,
	): Promise<IFileDeleteResponse> {
		const who = "SecloreDRMApiService::deleteFile:: ";
		try {
			Logger.debug(who + 'Deleting file', { 
				fileStorageId,
				correlationId 
			});
			
			const headers: { [key: string]: string } = {
				Authorization: `Bearer ${accessToken}`,
			};

			// Add correlation ID if provided
			if (correlationId) {
				headers['X-SECLORE-CORRELATION-ID'] = correlationId;
			}

			const options: IHttpRequestOptions = {
				method: 'DELETE',
				url: `${this.baseUrl}/seclore/drm/filestorage/1.0/${fileStorageId}`,
				headers,
			};

			Logger.debug(who + 'Making HTTP request', { url: options.url, method: options.method, fileStorageId, correlationId });
			const response = await this.context.helpers.httpRequest({ ...options, returnFullResponse: true });
			Logger.debug(who + 'File deletion successful', { 
				fileStorageId,
				correlationId 
			});
			
			const deleteResponse: IFileDeleteResponse = {
				headers: response.headers as { [key: string]: string }
			};
			
			return deleteResponse;
		} catch (error: unknown) {
			Logger.error(who + 'File deletion failed', { 
				error, 
				fileStorageId, 
				correlationId 
			});
			this.handleHttpError(error as NodeApiError);
		}
	}
}
