import { IExecuteFunctions, LoggerProxy as Logger } from 'n8n-workflow';
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
	private tenantId: string;
	private tenantSecret: string;
	private accessToken?: string;
	private refreshToken?: string;
	private tokenExpiry?: Date;
	private refreshPromise?: Promise<void>;
	private loginPromise?: Promise<void>;

	constructor(
		context: IExecuteFunctions,
		baseUrl: string,
		tenantId: string,
		tenantSecret: string,
		private defaultRetryCount: number = 3,
	) {
		this.apiService = new SecloreDRMApiService(context, baseUrl);
		this.tenantId = tenantId;
		this.tenantSecret = tenantSecret;
	}

	/**
	 * Ensures we have a valid access token, logging in if necessary
	 * @param correlationId - Optional correlation ID for logging
	 */
	private async ensureAuthenticated(correlationId?: string): Promise<void> {
		// If we don't have a token or it's expired, login
		if (!this.accessToken || (this.tokenExpiry && new Date() >= this.tokenExpiry)) {
			// If there's already a login in progress, wait for it
			if (this.loginPromise) {
				await this.loginPromise;
				return;
			}

			// Start login and store the promise
			this.loginPromise = this.login(correlationId);
			try {
				await this.loginPromise;
			} finally {
				this.loginPromise = undefined;
			}
		}
	}

	/**
	 * Performs login and stores tokens
	 * @param correlationId - Optional correlation ID for logging
	 */
	private async login(correlationId?: string): Promise<void> {
		const who = "SecloreDRMFileService::login:: ";
		try {
			Logger.debug(who + 'Attempting login', { tenantId: this.tenantId, correlationId });
			const loginResponse = await this.apiService.login(
				this.tenantId,
				this.tenantSecret,
				correlationId,
			);

			this.accessToken = loginResponse.accessToken;
			this.refreshToken = loginResponse.refreshToken;

			// Set token expiry to 50 minutes from now (assuming 1 hour token life)
			this.tokenExpiry = new Date(Date.now() + 50 * 60 * 1000);
			Logger.info(who + 'Login successful', { tenantId: this.tenantId, correlationId });
		} catch (error) {
			Logger.error(who + 'Login failed', { error, tenantId: this.tenantId, correlationId });
			this.clearTokens();
			throw error;
		}
	}

	/**
	 * Attempts to refresh the access token with concurrency protection
	 * @param correlationId - Optional correlation ID for logging
	 */
	private async refreshAccessToken(correlationId?: string): Promise<void> {
		// If there's already a refresh in progress, wait for it
		if (this.refreshPromise) {
			await this.refreshPromise;
			return;
		}

		if (!this.refreshToken) {
			throw new Error('No refresh token available');
		}

		// Start refresh and store the promise
		this.refreshPromise = this.performTokenRefresh(correlationId);
		try {
			await this.refreshPromise;
		} finally {
			this.refreshPromise = undefined;
		}
	}

	/**
	 * Performs the actual token refresh
	 * @param correlationId - Optional correlation ID for logging
	 */
	private async performTokenRefresh(correlationId?: string): Promise<void> {
		const who = "SecloreDRMFileService::performTokenRefresh:: ";
		try {
			Logger.debug(who + 'Attempting token refresh', { correlationId });
			const refreshResponse = await this.apiService.refreshToken(this.refreshToken!, correlationId);

			this.accessToken = refreshResponse.accessToken;
			this.refreshToken = refreshResponse.refreshToken;

			// Set token expiry to 50 minutes from now
			this.tokenExpiry = new Date(Date.now() + 50 * 60 * 1000);
			Logger.info(who + 'Token refresh successful', { correlationId });
		} catch (error) {
			Logger.error(who + 'Token refresh failed', { error, correlationId });
			this.clearTokens();
			throw error;
		}
	}

	/**
	 * Clears stored tokens and pending promises
	 */
	private clearTokens(): void {
		this.accessToken = undefined;
		this.refreshToken = undefined;
		this.tokenExpiry = undefined;
		this.refreshPromise = undefined;
		this.loginPromise = undefined;
	}

	/**
	 * Executes an API call with automatic authentication and retry logic
	 * @param apiCall - The API call function to execute
	 * @param retryCount - Number of retries (defaults to class default)
	 * @param correlationId - Optional correlation ID for logging
	 */
	private async executeWithRetry<T>(
		apiCall: (accessToken: string) => Promise<T>,
		retryCount: number = this.defaultRetryCount,
		correlationId?: string,
	): Promise<T> {
		let lastError: Error;

		for (let attempt = 0; attempt <= retryCount; attempt++) {
			try {
				// Ensure we have a valid token
				await this.ensureAuthenticated(correlationId);

				if (!this.accessToken) {
					throw new Error('Failed to obtain access token');
				}

				// Execute the API call
				return await apiCall(this.accessToken);
			} catch (error: unknown) {
				lastError = error as Error;
				// If it's an authentication error and we have retries left, try to refresh token
				if ((error as Error).message.includes('Unauthorized') && attempt < retryCount) {
					try {
						await this.refreshAccessToken(correlationId);
						continue; // Retry with new token
					} catch (refreshError: unknown) {
						Logger.error('SecloreDRMFileService::executeWithRetry:: Token refresh failed', { refreshError, correlationId });
						// If refresh fails, clear tokens and try full login on next attempt
						this.clearTokens();
					}
				}

				// If it's the last attempt or not an auth error, throw
				if (attempt === retryCount) {
					throw lastError;
				}

				// Wait before retry (exponential backoff)
				await new Promise((resolve) => {
					const delay = Math.pow(2, attempt) * 1000;
					// Use a simple delay implementation
					const start = Date.now();
					while (Date.now() - start < delay) {
						// Busy wait for delay
					}
					resolve(undefined);
				});
			}
		}

		throw lastError!;
	}

	/**
	 * Protect file using external identifier with automatic authentication and retry
	 */
	async protectWithExternalRefId(
		protectRequest: IProtectWithExternalRefIdRequest,
		correlationId?: string,
		retryCount?: number,
	): Promise<IProtectWithExternalRefIdResponse> {
		const who = "SecloreDRMFileService::protectWithExternalRefId:: ";
		try {
			Logger.debug(who + 'Protecting file with external ref ID', { fileStorageId: protectRequest.fileStorageId, hotfolderExternalReferenceId: protectRequest.hotfolderExternalReference.externalReferenceId, correlationId });
			const result = await this.executeWithRetry(
				(accessToken) =>
					this.apiService.protectWithExternalRefId(protectRequest, accessToken, correlationId),
				retryCount,
				correlationId,
			);
			Logger.info(who + 'File protected with external ref ID successfully', { fileStorageId: protectRequest.fileStorageId, secloreFileId: result.secloreFileId, correlationId });
			return result;
		} catch (error) {
			Logger.error(who + 'Protect with external ref ID failed', { error, fileStorageId: protectRequest.fileStorageId, correlationId });
			throw error;
		}
	}

	/**
	 * Protect file using existing protected file ID with automatic authentication and retry
	 */
	async protectWithFileId(
		protectRequest: IProtectWithFileIdRequest,
		correlationId?: string,
		retryCount?: number,
	): Promise<IProtectWithFileIdResponse> {
		const who = "SecloreDRMFileService::protectWithFileId:: ";
		try {
			Logger.debug(who + 'Protecting file with file ID', { existingProtectedFileId: protectRequest.existingProtectedFileId, fileStorageId: protectRequest.fileStorageId, correlationId });
			const result = await this.executeWithRetry(
				(accessToken) =>
					this.apiService.protectWithFileId(protectRequest, accessToken, correlationId),
				retryCount,
				correlationId,
			);
			Logger.info(who + 'File protected with file ID successfully', { existingProtectedFileId: protectRequest.existingProtectedFileId, secloreFileId: result.secloreFileId, correlationId });
			return result;
		} catch (error) {
			Logger.error(who + 'Protect with file ID failed', { error, existingProtectedFileId: protectRequest.existingProtectedFileId, correlationId });
			throw error;
		}
	}

	/**
	 * Protect file using HotFolder ID with automatic authentication and retry
	 */
	async protectWithHotFolder(
		protectRequest: IProtectWithHotFolderRequest,
		correlationId?: string,
		retryCount?: number,
	): Promise<IProtectWithHotFolderResponse> {
		const who = "SecloreDRMFileService::protectWithHotFolder:: ";
		try {
			Logger.debug(who + 'Protecting file with hot folder', { hotfolderId: protectRequest.hotfolderId, fileStorageId: protectRequest.fileStorageId, correlationId });
			const result = await this.executeWithRetry(
				(accessToken) =>
					this.apiService.protectWithHotFolder(protectRequest, accessToken, correlationId),
				retryCount,
				correlationId,
			);
			Logger.info(who + 'File protected with hot folder successfully', { hotfolderId: protectRequest.hotfolderId, fileStorageId: protectRequest.fileStorageId, secloreFileId: result.secloreFileId, correlationId });
			return result;
		} catch (error) {
			Logger.error(who + 'Protect with hot folder failed', { error, hotfolderId: protectRequest.hotfolderId, fileStorageId: protectRequest.fileStorageId, correlationId });
			throw error;
		}
	}

	/**
	 * Unprotect file with automatic authentication and retry
	 */
	async unprotect(
		unprotectRequest: IUnprotectRequest,
		correlationId?: string,
		retryCount?: number,
	): Promise<IUnprotectResponse> {
		const who = "SecloreDRMFileService::unprotect:: ";
		try {
			Logger.debug(who + 'Unprotecting file', { fileStorageId: unprotectRequest.fileStorageId, correlationId });
			const result = await this.executeWithRetry(
				(accessToken) => this.apiService.unprotect(unprotectRequest, accessToken, correlationId),
				retryCount,
				correlationId,
			);
			Logger.info(who + 'File unprotected successfully', { originalFileStorageId: unprotectRequest.fileStorageId, unprotectedFileStorageId: result.fileStorageId, correlationId });
			return result;
		} catch (error) {
			Logger.error(who + 'Unprotect file failed', { error, fileStorageId: unprotectRequest.fileStorageId, correlationId });
			throw error;
		}
	}

	/**
	 * Upload file with automatic authentication and retry
	 */
	async uploadFile(
		fileBuffer: Uint8Array,
		fileName: string,
		correlationId?: string,
		retryCount?: number,
	): Promise<IFileUploadResponse> {
		const who = "SecloreDRMFileService::uploadFile:: ";
		try {
			Logger.debug(who + 'Uploading file', { fileName, correlationId });
			const result = await this.executeWithRetry(
			(accessToken) => this.apiService.uploadFile(fileBuffer, fileName, accessToken, correlationId),
				retryCount,
				correlationId,
			);
			Logger.info(who + 'File uploaded successfully', { fileName, correlationId });
			return result;
		} catch (error) {
			Logger.error(who + 'Upload file failed', { error, fileName, correlationId });
			throw error;
		}
	}

	/**
	 * Download file with automatic authentication and retry
	 * NOTE: Files whose fileStorageId has 'DL_' prefix will be deleted from the file storage after download.
	 */
	async downloadFile(
		fileStorageId: string,
		correlationId?: string,
		retryCount?: number,
	): Promise<IFileDownloadResponse> {
		const who = "SecloreDRMFileService::downloadFile:: ";
		try {
			Logger.debug(who + 'Downloading file', { fileStorageId, correlationId });
			const result = await this.executeWithRetry(
				(accessToken) => this.apiService.downloadFile(fileStorageId, accessToken, correlationId),
				retryCount,
				correlationId,
			);
			Logger.info(who + 'File downloaded successfully', { fileStorageId, fileSize: result.data.length, correlationId });
			return result;
		} catch (error) {
			Logger.error(who + 'Download file failed', { error, fileStorageId, correlationId });
			throw error;
		}
	}

	/**
	 * Delete file with automatic authentication and retry
	 */
	async deleteFile(
		fileStorageId: string,
		correlationId?: string,
		retryCount?: number,
	): Promise<void> {
		const who = "SecloreDRMFileService::deleteFile:: ";
		try {
			Logger.debug(who + 'Deleting file', { fileStorageId, correlationId });
			await this.executeWithRetry(
				(accessToken) => this.apiService.deleteFile(fileStorageId, accessToken, correlationId),
				retryCount,
				correlationId,
			);
			Logger.info(who + 'File deleted successfully', { fileStorageId, correlationId });
		} catch (error) {
			Logger.error(who + 'Delete file failed', { error, fileStorageId, correlationId });
			throw error;
		}
	}

	/**
	 * Get current access token (for debugging/monitoring)
	 */
	getAccessToken(): string | undefined {
		return this.accessToken;
	}

	/**
	 * Check if currently authenticated
	 */
	isAuthenticated(): boolean {
		return !!this.accessToken && (!this.tokenExpiry || new Date() < this.tokenExpiry);
	}
}
