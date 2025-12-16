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
		// this is for cleanup operations, do nothing
	}
}

/**
 * Uploads a file, protects it with hot folder, and downloads the protected version
 * @param fileService - The SecloreDRMFileService instance
 * @param fileBuffer - The file buffer to upload
 * @param fileName - The name of the file
 * @param hotfolderId - The hot folder ID to use for protection
 * @param correlationId - Optional correlation ID for tracking
 * @returns Promise containing the protected file data and metadata
 */
async function protectFileWithHotFolder(
	fileService: SecloreDRMFileService,
	fileBuffer: Buffer,
	fileName: string,
	hotfolderId: string,
	correlationId?: string,
): Promise<{
	protectedFileData: Uint8Array;
	originalFileStorageId: string;
	protectedFileStorageId: string;
	secloreFileId: string;
	fileName: string;
	fileSize: number;
}> {
	let originalFileStorageId: string = '';
	try {
		const uploadResult = await fileService.uploadFile(
			new Uint8Array(fileBuffer),
			fileName,
			correlationId,
		);

		// check if the file is already protected
		if (uploadResult.protected) {
			throw new Error('File is already protected');
		}

		originalFileStorageId = uploadResult.fileStorageId;

		// Protect the uploaded file with HotFolder
		const protectResult = await fileService.protectWithHotFolder(
			{
				hotfolderId,
				fileStorageId: uploadResult.fileStorageId,
			},
			correlationId,
		);

		// Download the protected file
		const protectedFileData = await fileService.downloadFile(
			protectResult.fileStorageId,
			correlationId,
		);

		// Try to get the actual filename from response headers, fallback to constructed name
		const actualFileName = getFileNameFromHeaders(protectedFileData.headers) || fileName;

		const result = {
			protectedFileData: protectedFileData.data,
			originalFileStorageId: uploadResult.fileStorageId,
			protectedFileStorageId: protectResult.fileStorageId,
			secloreFileId: protectResult.secloreFileId,
			fileName: actualFileName,
			fileSize: protectedFileData.data.length,
		};
		
		return result;
	} finally {
		if (originalFileStorageId !== '') {
			await deleteFile(fileService, originalFileStorageId, correlationId);
		}
	}
}

export async function protectWithHotFolder(this: IExecuteFunctions): Promise<NodeOutput> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];

	const credentials = await this.getCredentials('secloreProtectApi');
	const baseUrl = credentials.baseUrl as string;
	
	// Initialize the file service
	const fileService = new SecloreDRMFileService(this, baseUrl);

	for (let i = 0; i < items.length; i++) {
		try {
			// Get parameters for this item
			const hotfolderId = this.getNodeParameter('hotfolderId', i) as string;
			const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
			const correlationId = crypto.randomUUID();

			// Validate required parameters
			if (!hotfolderId) {
				throw new NodeOperationError(this.getNode(), 'HotFolder ID is required', {
					itemIndex: i,
				});
			}

			// Get input binary data
			const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);

			const fileBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

			// Use the combined upload, protect, and download function
			const result = await protectFileWithHotFolder(
				fileService,
				fileBuffer,
				binaryData.fileName || 'file',
				hotfolderId,
				correlationId,
			);

			// Create output binary data
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
