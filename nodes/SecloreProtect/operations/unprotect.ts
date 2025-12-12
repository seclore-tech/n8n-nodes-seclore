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
	const who = "unprotect::deleteFileWithErrorHandling:: ";
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
 * Uploads a file, unprotects it, and downloads the unprotected version
 * @param fileService - The SecloreDRMFileService instance
 * @param fileBuffer - The file buffer to upload
 * @param fileName - The name of the file
 * @param correlationId - Optional correlation ID for tracking
 * @param retryCount - Number of retries for operations
 * @returns Promise containing the unprotected file data and metadata
 */
async function unprotectFile(
	fileService: SecloreDRMFileService,
	fileBuffer: Buffer,
	fileName: string,
	correlationId?: string,
	retryCount: number = 3,
): Promise<{
	unprotectedFileData: Uint8Array;
	originalFileStorageId: string;
	unprotectedFileStorageId: string;
	fileName: string;
	fileSize: number;
}> {
	const who = "unprotect::unprotectFile:: ";
	let originalFileStorageId: string = '';
	try {
		Logger.debug(who + 'Starting unprotect file operation', { fileName, fileSize: fileBuffer.length, correlationId, retryCount });
		
		// Upload the protected file
		Logger.debug(who + 'Uploading protected file', { fileName, fileSize: fileBuffer.length, correlationId });
		const uploadResult = await fileService.uploadFile(
			new Uint8Array(fileBuffer),
			fileName,
			correlationId,
			retryCount,
		);

		Logger.debug(who + 'File uploaded successfully', { fileStorageId: uploadResult.fileStorageId, fileName, correlationId });

		originalFileStorageId = uploadResult.fileStorageId;

		// check if the file is already unprotected
		if (!uploadResult.protected) {
			Logger.debug(who + 'File is already unprotected', { fileStorageId: uploadResult.fileStorageId, fileName, correlationId });
			return {
				unprotectedFileData: fileBuffer,
				originalFileStorageId: uploadResult.fileStorageId,
				unprotectedFileStorageId: uploadResult.fileStorageId,
				fileName,
				fileSize: fileBuffer.length,
			};
		}

		// Unprotect the uploaded file
		Logger.debug(who + 'Unprotecting file', { fileStorageId: uploadResult.fileStorageId, fileName, correlationId });
		const unprotectResult = await fileService.unprotect(
			{
				fileStorageId: uploadResult.fileStorageId,
			},
			correlationId,
			retryCount,
		);

		Logger.debug(who + 'File unprotected successfully', { 
			originalFileStorageId: uploadResult.fileStorageId, 
			unprotectedFileStorageId: unprotectResult.fileStorageId, 
			fileName, 
			correlationId 
		});

		// Download the unprotected file
		Logger.debug(who + 'Downloading unprotected file', { fileStorageId: unprotectResult.fileStorageId, fileName, correlationId });
		const unprotectedFileData = await fileService.downloadFile(
			unprotectResult.fileStorageId,
			correlationId,
			retryCount,
		);

		// Try to get the actual filename from response headers, fallback to original filename
		const actualFileName = getFileNameFromHeaders(unprotectedFileData.headers) || fileName;
		
		Logger.debug(who + 'Unprotected file downloaded successfully', { 
			fileStorageId: unprotectResult.fileStorageId, 
			fileSize: unprotectedFileData.data.length, 
			originalFileName: fileName,
			actualFileName: actualFileName,
			correlationId 
		});

		const result = {
			unprotectedFileData: unprotectedFileData.data,
			originalFileStorageId: uploadResult.fileStorageId,
			unprotectedFileStorageId: unprotectResult.fileStorageId,
			fileName: actualFileName,
			fileSize: unprotectedFileData.data.length,
		};
		
		Logger.debug(who + 'Unprotect file operation completed successfully', { 
			fileName: result.fileName,
			originalFileStorageId: result.originalFileStorageId,
			unprotectedFileStorageId: result.unprotectedFileStorageId,
			fileSize: result.fileSize,
			correlationId
		});
		
		return result;
	} catch (error) {
		Logger.error(who + 'Unprotect file operation failed', { error, fileName, correlationId });
		throw error;
	} finally {
		if (originalFileStorageId !== '') {
			await deleteFile(fileService, originalFileStorageId, correlationId, retryCount);
		}
	}
}

export async function unprotect(this: IExecuteFunctions): Promise<NodeOutput> {
	const who = "unprotect::unprotect:: ";
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];

	// Initialize logger with the current execution context
	Logger.init(this.logger);

	Logger.debug(who + 'Seclore Unprotect operation started', { itemCount: items.length });

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
			const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
			const correlationId = crypto.randomUUID();
			const retryCount = this.getNodeParameter('retryCount', i) as number;

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

			// Use the combined upload, unprotect, and download function
			try {
				Logger.debug(who + 'Starting unprotect file operation', { 
					fileName: binaryData.fileName, 
					correlationId, 
					retryCount,
					itemIndex: i 
				});

				const result = await unprotectFile(
					fileService,
					fileBuffer,
					binaryData.fileName || 'protected_file',
					correlationId,
					retryCount,
				);

				Logger.debug(who + 'Unprotect file operation completed successfully', { 
					fileName: result.fileName,
					originalFileStorageId: result.originalFileStorageId,
					unprotectedFileStorageId: result.unprotectedFileStorageId,
					fileSize: result.fileSize,
					itemIndex: i,
					correlationId
				});

				// Create output binary data
				Logger.debug(who + 'Preparing binary data for output', { 
					fileName: binaryData.fileName,
					mimeType: binaryData.mimeType,
					fileSize: result.fileSize,
					itemIndex: i
				});
				const outputBinaryData = await this.helpers.prepareBinaryData(
					Buffer.from(result.unprotectedFileData),
					result.fileName,
					binaryData.mimeType,
				);

				// Create return item with binary data and metadata
				const returnItem: INodeExecutionData = {
					json: {
						success: true,
						originalFileStorageId: result.originalFileStorageId,
						unprotectedFileStorageId: result.unprotectedFileStorageId,
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
			} catch (unprotectError) {
				Logger.error(who + 'Unprotect file operation failed', { unprotectError, itemIndex: i });

				// Re-throw the error to be handled by the outer catch block
				throw unprotectError;
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

	Logger.debug(who + 'Seclore Unprotect operation completed', { 
		processedItems: returnData.length, 
		successfulItems: returnData.filter(item => item.json.success).length 
	});

	return [returnData];
}
