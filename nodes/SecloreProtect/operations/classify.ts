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
 * Uploads a file, applies a classification label, and downloads the classified version
 * @param fileService - The SecloreDRMFileService instance
 * @param fileBuffer - The file buffer to upload
 * @param fileName - The name of the file
 * @param labelId - The classification label ID from Policy Server
 * @param forceLabelRefresh - Whether to force refresh of the label cache before applying
 * @param progress - Tracks the current step of the flow for error reporting
 * @param correlationId - Optional correlation ID for tracking
 * @returns Promise containing the classified file data and metadata
 */
async function classifyFile(
	fileService: SecloreDRMFileService,
	fileBuffer: Buffer,
	fileName: string,
	labelId: string,
	forceLabelRefresh: boolean,
	progress: { step: string },
	correlationId?: string,
): Promise<{
	classifiedFileData: Uint8Array;
	originalFileStorageId: string;
	classifiedFileStorageId: string;
	labelId: string;
	labelName: string;
	fileName: string;
	fileSize: number;
}> {
	let originalFileStorageId: string = '';
	progress.step = 'upload';
	try {
		const uploadResult = await fileService.uploadFile(
			new Uint8Array(fileBuffer),
			fileName,
			correlationId,
		);

		originalFileStorageId = uploadResult.fileStorageId;

		// Apply the classification label to the uploaded file
		progress.step = 'classify';
		const classifyResult = await fileService.classify(
			{
				fileStorageId: uploadResult.fileStorageId,
				labelId,
				forceLabelRefresh,
			},
			correlationId,
		);

		// Download the classified file.
		// If the classify response carries no fileStorageId, the file was
		// classified in place — download using the original storage ID.
		progress.step = 'download';
		const classifiedFileStorageId = classifyResult.fileStorageId || uploadResult.fileStorageId;
		const classifiedFileData = await fileService.downloadFile(
			classifiedFileStorageId,
			correlationId,
		);

		// Try to get the actual filename from response headers, fallback to original filename
		const actualFileName = getFileNameFromHeaders(classifiedFileData.headers) || fileName;

		const result = {
			classifiedFileData: classifiedFileData.data,
			originalFileStorageId: uploadResult.fileStorageId,
			classifiedFileStorageId,
			labelId: classifyResult.labelId,
			labelName: classifyResult.labelName,
			fileName: actualFileName,
			fileSize: classifiedFileData.data.length,
		};

		return result;
	} finally {
		if (originalFileStorageId !== '') {
			await deleteFile(fileService, originalFileStorageId, correlationId);
		}
	}
}

export async function classify(this: IExecuteFunctions): Promise<NodeOutput> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];

	const credentials = await this.getCredentials('secloreProtectApi');
	const baseUrl = credentials.baseUrl as string;

	// Initialize the file service
	const fileService = new SecloreDRMFileService(this, baseUrl);

	for (let i = 0; i < items.length; i++) {
		const progress = { step: 'input' };
		try {
			// Get parameters for this item
			const labelId = this.getNodeParameter('labelId', i) as string;
			const forceLabelRefresh = this.getNodeParameter('forceLabelRefresh', i, false) as boolean;
			const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
			const correlationId = crypto.randomUUID();

			// Validate required parameters
			if (!labelId) {
				throw new NodeOperationError(this.getNode(), 'Label ID is required', {
					itemIndex: i,
				});
			}

			// Get input binary data
			const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);

			const fileBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

			// Use the combined upload, classify, and download function
			const result = await classifyFile(
				fileService,
				fileBuffer,
				binaryData.fileName || 'file',
				labelId,
				forceLabelRefresh,
				progress,
				correlationId,
			);

			// Create output binary data
			const outputBinaryData = await this.helpers.prepareBinaryData(
				Buffer.from(result.classifiedFileData),
				result.fileName,
				binaryData.mimeType,
			);

			// Create return item with binary data and metadata
			const returnItem: INodeExecutionData = {
				json: {
					success: true,
					originalFileStorageId: result.originalFileStorageId,
					classifiedFileStorageId: result.classifiedFileStorageId,
					labelId: result.labelId,
					labelName: result.labelName,
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
			// Handle errors gracefully, annotating the step of the flow that failed
			const message = `[step: ${progress.step}] ${error.message}`;
			if (this.continueOnFail()) {
				const returnItem: INodeExecutionData = {
					json: {
						success: false,
						error: message,
						itemIndex: i,
					},
					pairedItem: { item: i },
				};
				returnData.push(returnItem);
			} else {
				throw new NodeOperationError(this.getNode(), message, {
					itemIndex: i,
				});
			}
		}
	}

	return [returnData];
}
