import {
	IDataObject,
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
 * Uploads a file, updates its classification label, and downloads the reclassified version
 * @param fileService - The SecloreDRMFileService instance
 * @param fileBuffer - The file buffer to upload
 * @param fileName - The name of the file
 * @param labelId - The new classification label ID from Policy Server
 * @param forceLabelRefresh - Whether to force refresh of the label cache before applying
 * @param progress - Tracks the current step of the flow for error reporting
 * @param correlationId - Optional correlation ID for tracking
 * @returns Promise containing the reclassified file data and metadata
 */
async function reclassifyFile(
	fileService: SecloreDRMFileService,
	fileBuffer: Buffer,
	fileName: string,
	labelId: string,
	forceLabelRefresh: boolean,
	progress: { step: string },
	correlationId?: string,
): Promise<{
	reclassifiedFileData: Uint8Array;
	originalFileStorageId: string;
	reclassifiedFileStorageId: string;
	currentLabel: unknown;
	oldLabel: unknown;
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

		// Update the classification label on the uploaded file
		progress.step = 'reclassify';
		const reclassifyResult = await fileService.reclassify(
			{
				fileStorageId: uploadResult.fileStorageId,
				labelId,
				forceLabelRefresh,
			},
			correlationId,
		);

		// Download the reclassified file.
		// If the reclassify response carries no fileStorageId, the file was
		// reclassified in place — download using the original storage ID.
		progress.step = 'download';
		const reclassifiedFileStorageId = reclassifyResult.fileStorageId || uploadResult.fileStorageId;
		const reclassifiedFileData = await fileService.downloadFile(
			reclassifiedFileStorageId,
			correlationId,
		);

		// Try to get the actual filename from response headers, fallback to original filename
		const actualFileName = getFileNameFromHeaders(reclassifiedFileData.headers) || fileName;

		const result = {
			reclassifiedFileData: reclassifiedFileData.data,
			originalFileStorageId: uploadResult.fileStorageId,
			reclassifiedFileStorageId,
			currentLabel: reclassifyResult.currentLabel,
			oldLabel: reclassifyResult.oldLabel,
			fileName: actualFileName,
			fileSize: reclassifiedFileData.data.length,
		};

		return result;
	} finally {
		if (originalFileStorageId !== '') {
			await deleteFile(fileService, originalFileStorageId, correlationId);
		}
	}
}

export async function reclassify(this: IExecuteFunctions): Promise<NodeOutput> {
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

			// Use the combined upload, reclassify, and download function
			const result = await reclassifyFile(
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
				Buffer.from(result.reclassifiedFileData),
				result.fileName,
				binaryData.mimeType,
			);

			// Create return item with binary data and metadata
			const returnItem: INodeExecutionData = {
				json: {
					success: true,
					originalFileStorageId: result.originalFileStorageId,
					reclassifiedFileStorageId: result.reclassifiedFileStorageId,
					currentLabel: result.currentLabel as IDataObject,
					oldLabel: result.oldLabel as IDataObject,
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
