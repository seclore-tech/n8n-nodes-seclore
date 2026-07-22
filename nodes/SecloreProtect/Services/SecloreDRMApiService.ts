import { IExecuteFunctions, IHttpRequestOptions, NodeApiError } from 'n8n-workflow';
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
		try {
			
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

			const response = await this.context.helpers.httpRequestWithAuthentication.call(this.context, 'secloreProtectApi', { ...options, returnFullResponse: true });
			
			const loginResponse: ILoginResponse = {
				...(response.body as ILoginResponse),
				headers: response.headers as { [key: string]: string }
			};
			
			return loginResponse;
		} catch (error: unknown) {
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
		try {
			
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

			const response = await this.context.helpers.httpRequestWithAuthentication.call(this.context, 'secloreProtectApi', { ...options, returnFullResponse: true });
			
			const refreshResponse: ILoginResponse = {
				...(response.body as ILoginResponse),
				headers: response.headers as { [key: string]: string }
			};
			
			return refreshResponse;
		} catch (error: unknown) {
			this.handleHttpError(error as NodeApiError, { 401: 'Unauthorized' });
		}
	}

	/**
	 * Protect file using external identifier of protected File and HotFolder with PS configured against the logged in Tenant in application.
	 *
	 * @param protectRequest - The protection request details
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IProtectWithExternalRefIdResponse> - File storage ID and Seclore file ID
	 * @throws Error on bad request, authentication failure or server error
	 */
	async protectWithExternalRefId(
		protectRequest: IProtectWithExternalRefIdRequest,
		correlationId?: string,
	): Promise<IProtectWithExternalRefIdResponse> {
		try {
			
			const headers: { [key: string]: string } = {
				'Content-Type': 'application/json',
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

			const response = await this.context.helpers.httpRequestWithAuthentication.call(this.context, 'secloreProtectApi', { ...options, returnFullResponse: true });
			
			const protectResponse: IProtectWithExternalRefIdResponse = {
				...(response.body as IProtectWithExternalRefIdResponse),
				headers: response.headers as { [key: string]: string }
			};
			
			return protectResponse;
		} catch (error: unknown) {
			this.handleHttpError(error as NodeApiError);
		}
	}

	/**
	 * Protects file using File ID of already protected file with PS configured against the logged in Tenant in application.
	 *
	 * @param protectRequest - The protection request details with existing protected file ID
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IProtectWithFileIdResponse> - File storage ID and Seclore file ID
	 * @throws Error on bad request, authentication failure or server error
	 */
	async protectWithFileId(
		protectRequest: IProtectWithFileIdRequest,
		correlationId?: string,
	): Promise<IProtectWithFileIdResponse> {
		try {
			
			const headers: { [key: string]: string } = {
				'Content-Type': 'application/json',
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

			const response = await this.context.helpers.httpRequestWithAuthentication.call(this.context, 'secloreProtectApi', { ...options, returnFullResponse: true });
			
			const protectResponse: IProtectWithFileIdResponse = {
				...(response.body as IProtectWithFileIdResponse),
				headers: response.headers as { [key: string]: string }
			};
			
			return protectResponse;
		} catch (error: unknown) {
			this.handleHttpError(error as NodeApiError);
		}
	}

	/**
	 * Protects file using HotFolder ID with PS configured against the logged in Tenant in application.
	 *
	 * @param protectRequest - The protection request details with hotfolder ID
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IProtectWithHotFolderResponse> - File storage ID and Seclore file ID
	 * @throws Error on bad request, authentication failure or server error
	 */
	async protectWithHotFolder(
		protectRequest: IProtectWithHotFolderRequest,
		correlationId?: string,
	): Promise<IProtectWithHotFolderResponse> {
		try {
			
			const headers: { [key: string]: string } = {
				'Content-Type': 'application/json'
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

			const response = await this.context.helpers.httpRequestWithAuthentication.call(this.context, 'secloreProtectApi', { ...options, returnFullResponse: true });
			
			const protectResponse: IProtectWithHotFolderResponse = {
				...(response.body as IProtectWithHotFolderResponse),
				headers: response.headers as { [key: string]: string }
			};
			
			return protectResponse;
		} catch (error: unknown) {
			this.handleHttpError(error as NodeApiError);
		}
	}

	/**
	 * Unprotects file with PS configured against the logged in Tenant in application.
	 *
	 * @param unprotectRequest - The unprotect request details with file storage ID
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IUnprotectResponse> - File storage ID of unprotected file
	 * @throws Error on bad request, authentication failure or server error
	 */
	async unprotect(
		unprotectRequest: IUnprotectRequest,
		correlationId?: string,
	): Promise<IUnprotectResponse> {
		try {
			
			const headers: { [key: string]: string } = {
				'Content-Type': 'application/json',
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

			const response = await this.context.helpers.httpRequestWithAuthentication.call(this.context, 'secloreProtectApi', { ...options, returnFullResponse: true });
			
			const unprotectResponse: IUnprotectResponse = {
				...(response.body as IUnprotectResponse),
				headers: response.headers as { [key: string]: string }
			};
			
			return unprotectResponse;
		} catch (error: unknown) {
			this.handleHttpError(error as NodeApiError);
		}
	}

	/**
	 * Throws a detailed error for classification endpoints, surfacing the endpoint name,
	 * HTTP status and the raw response body returned by the server.
	 *
	 * @param error - The error object from httpRequest
	 * @param endpoint - The endpoint name to include in the error message
	 */
	private throwDetailedError(error: NodeApiError, endpoint: string): never {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const anyError = error as any;
		const rawBody =
			error.errorResponse ?? anyError?.cause?.response?.data ?? anyError?.context?.data;
		let detail = '';
		if (rawBody) {
			try {
				detail = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
			} catch {
				// ignore serialization failure
			}
		}
		if (!detail) {
			detail =
				(typeof error.description === 'string' && error.description) ||
				error.message ||
				'Unknown error';
		}
		throw new Error(`[${endpoint}] HTTP ${error.httpCode ?? 'error'}: ${detail}`);
	}

	/**
	 * Applies a classification label to a file using a labelId configured in the Policy Server.
	 *
	 * @param classifyRequest - The classify request details with file storage ID and label ID
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IClassifyResponse> - File storage ID, label ID and label name of the classified file
	 * @throws Error on bad request, authentication failure or server error
	 */
	async classify(
		classifyRequest: IClassifyRequest,
		correlationId?: string,
	): Promise<IClassifyResponse> {
		try {

			const headers: { [key: string]: string } = {
				'Content-Type': 'application/json',
			};

			// Add correlation ID if provided
			if (correlationId) {
				headers['X-SECLORE-CORRELATION-ID'] = correlationId;
			}

			const options: IHttpRequestOptions = {
				method: 'POST',
				url: `${this.baseUrl}/seclore/drm/1.0/classification/classify`,
				headers,
				body: classifyRequest,
				json: true,
			};

			const response = await this.context.helpers.httpRequestWithAuthentication.call(this.context, 'secloreProtectApi', { ...options, returnFullResponse: true });

			// Some server versions return the result wrapped in an array
			const responseBody = Array.isArray(response.body) ? response.body[0] : response.body;

			const classifyResponse: IClassifyResponse = {
				...(responseBody as IClassifyResponse),
				headers: response.headers as { [key: string]: string }
			};

			return classifyResponse;
		} catch (error: unknown) {
			this.throwDetailedError(error as NodeApiError, 'classification/classify');
		}
	}

	/**
	 * Updates the classification label on an already-classified file.
	 *
	 * @param reclassifyRequest - The reclassify request details with file storage ID and new label ID
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IReclassifyResponse> - File storage ID, current label and old label
	 * @throws Error on bad request, authentication failure or server error
	 */
	async reclassify(
		reclassifyRequest: IReclassifyRequest,
		correlationId?: string,
	): Promise<IReclassifyResponse> {
		try {

			const headers: { [key: string]: string } = {
				'Content-Type': 'application/json',
			};

			// Add correlation ID if provided
			if (correlationId) {
				headers['X-SECLORE-CORRELATION-ID'] = correlationId;
			}

			const options: IHttpRequestOptions = {
				method: 'POST',
				url: `${this.baseUrl}/seclore/drm/1.0/classification/reclassify`,
				headers,
				body: reclassifyRequest,
				json: true,
			};

			const response = await this.context.helpers.httpRequestWithAuthentication.call(this.context, 'secloreProtectApi', { ...options, returnFullResponse: true });

			// Some server versions return the result wrapped in an array
			const responseBody = Array.isArray(response.body) ? response.body[0] : response.body;

			const reclassifyResponse: IReclassifyResponse = {
				...(responseBody as IReclassifyResponse),
				headers: response.headers as { [key: string]: string }
			};

			return reclassifyResponse;
		} catch (error: unknown) {
			this.throwDetailedError(error as NodeApiError, 'classification/reclassify');
		}
	}

	/**
	 * Removes the classification label from a file. DRM protection is unaffected —
	 * only the label is removed.
	 *
	 * @param declassifyRequest - The declassify request details with file storage ID
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IDeclassifyResponse> - File storage ID with null label ID and label name
	 * @throws Error on bad request, authentication failure or server error
	 */
	async declassify(
		declassifyRequest: IDeclassifyRequest,
		correlationId?: string,
	): Promise<IDeclassifyResponse> {
		try {

			const headers: { [key: string]: string } = {
				'Content-Type': 'application/json',
			};

			// Add correlation ID if provided
			if (correlationId) {
				headers['X-SECLORE-CORRELATION-ID'] = correlationId;
			}

			const options: IHttpRequestOptions = {
				method: 'POST',
				url: `${this.baseUrl}/seclore/drm/1.0/classification/declassify`,
				headers,
				body: declassifyRequest,
				json: true,
			};

			const response = await this.context.helpers.httpRequestWithAuthentication.call(this.context, 'secloreProtectApi', { ...options, returnFullResponse: true });

			// Some server versions return the result wrapped in an array
			const responseBody = Array.isArray(response.body) ? response.body[0] : response.body;

			const declassifyResponse: IDeclassifyResponse = {
				...(responseBody as IDeclassifyResponse),
				headers: response.headers as { [key: string]: string }
			};

			return declassifyResponse;
		} catch (error: unknown) {
			this.throwDetailedError(error as NodeApiError, 'classification/declassify');
		}
	}

	/**
	 * Retrieves all classification labels configured in the Policy Server.
	 *
	 * @param getLabelsRequest - The request details with context file storage ID
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IGetLabelsResponse> - All labels configured in the Policy Server
	 * @throws Error on bad request, authentication failure or server error
	 */
	async getLabels(
		getLabelsRequest: IGetLabelsRequest,
		correlationId?: string,
	): Promise<IGetLabelsResponse> {
		try {

			const headers: { [key: string]: string } = {};

			// Add correlation ID if provided
			if (correlationId) {
				headers['X-SECLORE-CORRELATION-ID'] = correlationId;
			}

			const options: IHttpRequestOptions = {
				method: 'GET',
				url: `${this.baseUrl}/seclore/drm/1.0/classification/labels`,
				headers,
				qs: {
					fileStorageId: getLabelsRequest.fileStorageId,
					...(getLabelsRequest.forceLabelRefresh !== undefined
						? { forceLabelRefresh: getLabelsRequest.forceLabelRefresh }
						: {}),
				},
				json: true,
			};

			const response = await this.context.helpers.httpRequestWithAuthentication.call(this.context, 'secloreProtectApi', { ...options, returnFullResponse: true });

			const labelsResponse: IGetLabelsResponse = {
				labels: response.body,
				headers: response.headers as { [key: string]: string }
			};

			return labelsResponse;
		} catch (error: unknown) {
			this.throwDetailedError(error as NodeApiError, 'classification/labels');
		}
	}

	/**
	 * Returns the current classification label on a specific file.
	 *
	 * @param fileStorageId - Storage ID of the file to inspect
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IGetFileClassificationResponse> - Whether the file is classified and its classification info
	 * @throws Error on bad request, authentication failure or server error
	 */
	async getFileClassification(
		fileStorageId: string,
		correlationId?: string,
	): Promise<IGetFileClassificationResponse> {
		try {

			const headers: { [key: string]: string } = {};

			// Add correlation ID if provided
			if (correlationId) {
				headers['X-SECLORE-CORRELATION-ID'] = correlationId;
			}

			const options: IHttpRequestOptions = {
				method: 'GET',
				url: `${this.baseUrl}/seclore/drm/1.0/classification/${fileStorageId}`,
				headers,
				json: true,
			};

			const response = await this.context.helpers.httpRequestWithAuthentication.call(this.context, 'secloreProtectApi', { ...options, returnFullResponse: true });

			// Some server versions return the result wrapped in an array
			const responseBody = Array.isArray(response.body) ? response.body[0] : response.body;

			const classificationResponse: IGetFileClassificationResponse = {
				...(responseBody as IGetFileClassificationResponse),
				headers: response.headers as { [key: string]: string }
			};

			return classificationResponse;
		} catch (error: unknown) {
			this.throwDetailedError(error as NodeApiError, 'classification/get');
		}
	}

	/**
	 * Adds a new file to the file storage for currently logged in Tenant.
	 *
	 * @param fileBuffer - The file buffer data
	 * @param fileName - The name of the file
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IFileUploadResponse> - File storage details including file ID and metadata
	 * @throws Error on authentication failure, payload too large, or server error
	 */
	async uploadFile(
		fileBuffer: Uint8Array,
		fileName: string,
		correlationId?: string,
	): Promise<IFileUploadResponse> {
		try {
			
			const headers: { [key: string]: string } = {};

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

			const response = await this.context.helpers.httpRequestWithAuthentication.call(this.context, 'secloreProtectApi', { ...options, returnFullResponse: true });
			
			const uploadResponse: IFileUploadResponse = {
				...(response.body as IFileUploadResponse),
				headers: response.headers as { [key: string]: string }
			};
			
			return uploadResponse;
		} catch (error: unknown) {
			this.handleHttpError(error as NodeApiError);
		}
	}

	/**
	 * Downloads file with fileStorageId from file storage of currently logged in Tenant.
	 * NOTE: Files whose fileStorageId has 'DL_' prefix will be deleted from the file storage after download.
	 *
	 * @param fileStorageId - Storage ID of the file to be retrieved
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IFileDownloadResponse> - The downloaded file data with headers
	 * @throws Error on authentication failure or server error
	 */
	async downloadFile(
		fileStorageId: string,
		correlationId?: string,
	): Promise<IFileDownloadResponse> {
		try {
			
			const headers: { [key: string]: string } = {};

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

			const response = await this.context.helpers.httpRequestWithAuthentication.call(this.context, 'secloreProtectApi', { ...options, returnFullResponse: true });
			const fileData = new Uint8Array(response.body as ArrayBuffer);
			
			const downloadResponse: IFileDownloadResponse = {
				data: fileData,
				headers: response.headers as { [key: string]: string }
			};
			
			return downloadResponse;
		} catch (error: unknown) {
			this.handleHttpError(error as NodeApiError);
		}
	}

	/**
	 * Deletes a file with fileStorageId from file storage of currently logged in Tenant.
	 *
	 * @param fileStorageId - Storage ID of the file to be deleted
	 * @param correlationId - Optional request ID for logging purpose
	 * @returns Promise<IFileDeleteResponse> - Response headers on successful deletion
	 * @throws Error on authentication failure or server error
	 */
	async deleteFile(
		fileStorageId: string,
		correlationId?: string,
	): Promise<IFileDeleteResponse> {
		try {
			
			const headers: { [key: string]: string } = {};

			// Add correlation ID if provided
			if (correlationId) {
				headers['X-SECLORE-CORRELATION-ID'] = correlationId;
			}

			const options: IHttpRequestOptions = {
				method: 'DELETE',
				url: `${this.baseUrl}/seclore/drm/filestorage/1.0/${fileStorageId}`,
				headers,
			};

			const response = await this.context.helpers.httpRequestWithAuthentication.call(this.context, 'secloreProtectApi', { ...options, returnFullResponse: true });
			
			const deleteResponse: IFileDeleteResponse = {
				headers: response.headers as { [key: string]: string }
			};
			
			return deleteResponse;
		} catch (error: unknown) {
			this.handleHttpError(error as NodeApiError);
		}
	}
}
