import {
	IExecuteFunctions,
	INodeExecutionData,
	NodeOperationError,
	NodeOutput,
	LoggerProxy as Logger,
} from 'n8n-workflow';
import crypto from 'node:crypto';
import { SecloreDRMFileService } from '../Services/SecloreDRMFileService';
import { getFileNameFromHeaders } from '../Services/Utils';

/**
 * Deletes a file from storage with error handling (does not throw errors)
 * @param fileService - The SecloreDRMFileService instance
 * @param fileStorageId - The file storage ID to delete
 * @param correlationId - Optional correlation ID for tracking
 * @param retryCount - Number of retries for operations
 */
async function deleteFile(
	fileService: SecloreDRMFileService,
	fileStorageId: string,
	correlationId?: string,
	retryCount: number = 3,
): Promise<void> {
	const who = "protectWithHotFolder::deleteFile:: ";
	try {
		Logger.debug(who + 'Attempting to delete file', { fileStorageId, correlationId, retryCount });
		
		await fileService.deleteFile(
			fileStorageId,
			correlationId,
			retryCount,
		);
		
		Logger.debug(who + 'File deleted successfully', { fileStorageId, correlationId });
	} catch (error) {
		// Log error but don't throw - this is for cleanup operations
		Logger.error(who + 'File deletion failed, continuing operation', { 
			error, 
			fileStorageId, 
			correlationId,
			message: 'This is a cleanup operation, continuing despite deletion failure'
		});
	}
}

/**
 * Uploads a file, protects it with hot folder, and downloads the protected version
 * @param fileService - The SecloreDRMFileService instance
 * @param fileBuffer - The file buffer to upload
 * @param fileName - The name of the file
 * @param hotfolderId - The hot folder ID to use for protection
 * @param correlationId - Optional correlation ID for tracking
 * @param retryCount - Number of retries for operations
 * @returns Promise containing the protected file data and metadata
 */
async function protectFileWithHotFolder(
	fileService: SecloreDRMFileService,
	fileBuffer: Buffer,
	fileName: string,
	hotfolderId: string,
	correlationId?: string,
	retryCount: number = 3,
): Promise<{
	protectedFileData: Uint8Array;
	originalFileStorageId: string;
	protectedFileStorageId: string;
	secloreFileId: string;
	fileName: string;
	fileSize: number;
}> {
	const who = "protectWithHotFolder::protectFileWithHotFolder:: ";
	let originalFileStorageId: string = '';
	try {
		Logger.debug(who + 'Starting protect file with hot folder operation', { fileName, fileSize: fileBuffer.length, hotfolderId, correlationId, retryCount });
		
		// Upload the file first
		Logger.debug(who + 'Uploading file', { fileName, fileSize: fileBuffer.length, correlationId });
		const uploadResult = await fileService.uploadFile(
			new Uint8Array(fileBuffer),
			fileName,
			correlationId,
			retryCount,
		);

		Logger.debug(who + 'File uploaded successfully', { fileStorageId: uploadResult.fileStorageId, fileName, correlationId });

		// check if the file is already protected
		if (uploadResult.protected) {
			throw new Error('File is already protected');
		}

		originalFileStorageId = uploadResult.fileStorageId;

		// Protect the uploaded file with HotFolder
		Logger.debug(who + 'Protecting file with hot folder', { fileStorageId: uploadResult.fileStorageId, hotfolderId, fileName, correlationId });
		const protectResult = await fileService.protectWithHotFolder(
			{
				hotfolderId,
				fileStorageId: uploadResult.fileStorageId,
			},
			correlationId,
			retryCount,
		);

		Logger.debug(who + 'File protected successfully', { 
			originalFileStorageId: uploadResult.fileStorageId, 
			protectedFileStorageId: protectResult.fileStorageId, 
			secloreFileId: protectResult.secloreFileId,
			hotfolderId,
			fileName, 
			correlationId 
		});

		// Download the protected file
		Logger.debug(who + 'Downloading protected file', { fileStorageId: protectResult.fileStorageId, fileName, correlationId });
		const protectedFileData = await fileService.downloadFile(
			protectResult.fileStorageId,
			correlationId,
			retryCount,
		);

		// Try to get the actual filename from response headers, fallback to constructed name
		const actualFileName = getFileNameFromHeaders(protectedFileData.headers) || fileName;
		
		Logger.debug(who + 'Protected file downloaded successfully', { 
			fileStorageId: protectResult.fileStorageId, 
			fileSize: protectedFileData.data.length, 
			originalFileName: fileName,
			actualFileName,
			correlationId 
		});

		const result = {
			protectedFileData: protectedFileData.data,
			originalFileStorageId: uploadResult.fileStorageId,
			protectedFileStorageId: protectResult.fileStorageId,
			secloreFileId: protectResult.secloreFileId,
			fileName: actualFileName,
			fileSize: protectedFileData.data.length,
		};
		
		Logger.debug(who + 'Protect file with hot folder operation completed successfully', { 
			fileName: result.fileName,
			originalFileStorageId: result.originalFileStorageId,
			protectedFileStorageId: result.protectedFileStorageId,
			secloreFileId: result.secloreFileId,
			fileSize: result.fileSize,
			hotfolderId,
			correlationId
		});
		
		return result;
	} catch (error) {
		Logger.error(who + 'Protect file with hot folder operation failed', { error, fileName, hotfolderId, correlationId });
		throw error;
	} finally {
		if (originalFileStorageId !== '') {
			await deleteFile(fileService, originalFileStorageId, correlationId, retryCount);
		}
	}
}

export async function protectWithHotFolder(this: IExecuteFunctions): Promise<NodeOutput> {
	const who = "protectWithHotFolder::protectWithHotFolder:: ";
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];

	// Initialize logger with the current execution context
	Logger.init(this.logger);

	Logger.debug(who + 'Seclore Protect with HotFolder operation started', { itemCount: items.length });

	// Get credentials
	Logger.debug(who + 'Getting credentials', {});
	const credentials = await this.getCredentials('secloreProtectApi');
	const baseUrl = credentials.baseUrl as string;
	const tenantId = credentials.tenantId as string;
	const tenantSecret = credentials.tenantSecret as string;

	// Initialize the file service
	Logger.debug(who + 'Initializing file service', { baseUrl, tenantId });
	const fileService = new SecloreDRMFileService(this, baseUrl, tenantId, tenantSecret);

	for (let i = 0; i < items.length; i++) {
		Logger.debug(who + 'Processing item', { itemIndex: i });
		try {
			// Get parameters for this item
			Logger.debug(who + 'Getting node parameters', { itemIndex: i });
			const hotfolderId = this.getNodeParameter('hotfolderId', i) as string;
			const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
			const correlationId = crypto.randomUUID();
			const retryCount = this.getNodeParameter('retryCount', i) as number;

			// Validate required parameters
			if (!hotfolderId) {
				throw new NodeOperationError(this.getNode(), 'HotFolder ID is required', {
					itemIndex: i,
				});
			}

			Logger.debug(who + 'Asserting binary data', { binaryPropertyName, itemIndex: i });
			// Get input binary data
			const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);

			Logger.debug(who + 'Getting binary data buffer', { binaryPropertyName, itemIndex: i });
			const fileBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

			Logger.debug(who + 'Binary data retrieved', {
				fileName: binaryData.fileName,
				fileSize: fileBuffer.length,
				mimeType: binaryData.mimeType,
				itemIndex: i,
				correlationId,
				retryCount
			});

			// Use the combined upload, protect, and download function
			try {
				Logger.debug(who + 'Starting protect file with hot folder operation', { 
					fileName: binaryData.fileName, 
					hotfolderId,
					correlationId, 
					retryCount,
					itemIndex: i 
				});

				const result = await protectFileWithHotFolder(
					fileService,
					fileBuffer,
					binaryData.fileName || 'file',
					hotfolderId,
					correlationId,
					retryCount,
				);

				Logger.debug(who + 'Protect file with hot folder operation completed successfully', { 
					fileName: result.fileName,
					originalFileStorageId: result.originalFileStorageId,
					protectedFileStorageId: result.protectedFileStorageId,
					secloreFileId: result.secloreFileId,
					fileSize: result.fileSize,
					hotfolderId,
					itemIndex: i,
					correlationId
				});

				// Create output binary data
				Logger.debug(who + 'Preparing binary data for output', { 
					fileName: result.fileName,
					mimeType: binaryData.mimeType,
					fileSize: result.fileSize,
					itemIndex: i
				});
				const outputBinaryData = await this.helpers.prepareBinaryData(
					Buffer.from(result.protectedFileData),
					result.fileName,
					binaryData.mimeType,
				);

				// Create return item with binary data and metadata
				const returnItem: INodeExecutionData = {
					json: {
						success: true,
						originalFileStorageId: result.originalFileStorageId,
						protectedFileStorageId: result.protectedFileStorageId,
						secloreFileId: result.secloreFileId,
						hotfolderId,
						fileName: result.fileName,
						fileSize: result.fileSize,
						correlationId: correlationId,
					},
					binary: {
						data: outputBinaryData,
					},
				};

				Logger.debug(who + 'Adding result to return data', { itemIndex: i, success: true });
				returnData.push(returnItem);
			} catch (protectError) {
				Logger.error(who + 'Protect file with hot folder operation failed', { protectError, itemIndex: i });

				// Re-throw the error to be handled by the outer catch block
				throw protectError;
			}
		} catch (error) {
			// Handle errors gracefully
			Logger.error(who + 'Item processing failed', { error, itemIndex: i });
			if (this.continueOnFail()) {
				Logger.debug(who + 'Continuing on fail, adding error item', { itemIndex: i, errorMessage: error.message });
				const returnItem: INodeExecutionData = {
					json: {
						success: false,
						error: error.message,
						itemIndex: i,
					},
				};
				returnData.push(returnItem);
			} else {
				Logger.error(who + 'Throwing NodeOperationError', { error: error.message, itemIndex: i });
				throw new NodeOperationError(this.getNode(), error.message, {
					itemIndex: i,
				});
			}
		}
	}

	Logger.debug(who + 'Seclore Protect with HotFolder operation completed', {
		processedItems: returnData.length,
		successfulItems: returnData.filter(item => item.json.success).length
	});

	return [returnData];
}
