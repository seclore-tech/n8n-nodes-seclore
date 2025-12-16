import {
	IExecuteFunctions,
	INodeExecutionData,
	NodeOperationError,
	NodeOutput,
} from 'n8n-workflow';
import crypto from 'node:crypto';
import { SecloreDRMFileService } from '../Services/SecloreDRMFileService';
import { getFileNameFromHeaders } from '../Services/Utils';

/**
 * Deletes a file from storage with error handling (does not throw errors)
 * @param fileService - The SecloreDRMFileService instance
 * @param fileStorageId - The file storage ID to delete
 * @param correlationId - Optional correlation ID for tracking
 */
async function deleteFile(
	fileService: SecloreDRMFileService,
	fileStorageId: string,
	correlationId?: string,
): Promise<void> {
	try {
		
		await fileService.deleteFile(
			fileStorageId,
			correlationId,
		);
		
	} catch {
		// this is for cleanup operation, do nothing
	}
}

/**
 * Uploads a file, unprotects it, and downloads the unprotected version
 * @param fileService - The SecloreDRMFileService instance
 * @param fileBuffer - The file buffer to upload
 * @param fileName - The name of the file
 * @param correlationId - Optional correlation ID for tracking
 * @returns Promise containing the unprotected file data and metadata
 */
async function unprotectFile(
	fileService: SecloreDRMFileService,
	fileBuffer: Buffer,
	fileName: string,
	correlationId?: string,
): Promise<{
	unprotectedFileData: Uint8Array;
	originalFileStorageId: string;
	unprotectedFileStorageId: string;
	fileName: string;
	fileSize: number;
}> {
	let originalFileStorageId: string = '';
	try {
		
		// Upload the protected file
		const uploadResult = await fileService.uploadFile(
			new Uint8Array(fileBuffer),
			fileName,
			correlationId,
		);


		originalFileStorageId = uploadResult.fileStorageId;

		// check if the file is already unprotected
		if (!uploadResult.protected) {
			return {
				unprotectedFileData: fileBuffer,
				originalFileStorageId: uploadResult.fileStorageId,
				unprotectedFileStorageId: uploadResult.fileStorageId,
				fileName,
				fileSize: fileBuffer.length,
			};
		}

		// Unprotect the uploaded file
		const unprotectResult = await fileService.unprotect(
			{
				fileStorageId: uploadResult.fileStorageId,
			},
			correlationId,
		);

		// Download the unprotected file
		const unprotectedFileData = await fileService.downloadFile(
			unprotectResult.fileStorageId,
			correlationId,
		);

		// Try to get the actual filename from response headers, fallback to original filename
		const actualFileName = getFileNameFromHeaders(unprotectedFileData.headers) || fileName;
		

		const result = {
			unprotectedFileData: unprotectedFileData.data,
			originalFileStorageId: uploadResult.fileStorageId,
			unprotectedFileStorageId: unprotectResult.fileStorageId,
			fileName: actualFileName,
			fileSize: unprotectedFileData.data.length,
		};
		
		
		return result;
	} finally {
		if (originalFileStorageId !== '') {
			await deleteFile(fileService, originalFileStorageId, correlationId);
		}
	}
}

export async function unprotect(this: IExecuteFunctions): Promise<NodeOutput> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];

	// Get credentials
	const credentials = await this.getCredentials('secloreProtectApi');
	const baseUrl = credentials.baseUrl as string;

	// Initialize the file service
	const fileService = new SecloreDRMFileService(this, baseUrl);

	for (let i = 0; i < items.length; i++) {
		try {
			// Get parameters for this item
			const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
			const correlationId = crypto.randomUUID();

			// Get input binary data
			const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);

			const fileBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

			// Use the combined upload, unprotect, and download function
			const result = await unprotectFile(
				fileService,
				fileBuffer,
				binaryData.fileName || 'protected_file',
				correlationId,
			);

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
				pairedItem: { item: i },
			};

			returnData.push(returnItem);

		} catch (error) {
			// Handle errors gracefully
			if (this.continueOnFail()) {
				const returnItem: INodeExecutionData = {
					json: {
						success: false,
						error: error.message,
						itemIndex: i,
					},
					pairedItem: { item: i },
				};
				returnData.push(returnItem);
			} else {
				throw new NodeOperationError(this.getNode(), error.message, {
					itemIndex: i,
				});
			}
		}
	}

	return [returnData];
}
