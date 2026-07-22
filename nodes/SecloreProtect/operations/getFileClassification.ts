import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	NodeOperationError,
	NodeOutput,
} from 'n8n-workflow';
import crypto from 'node:crypto';
import { SecloreDRMFileService } from '../Services/SecloreDRMFileService';

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
 * Uploads a file and retrieves its current classification from the Policy Server
 * @param fileService - The SecloreDRMFileService instance
 * @param fileBuffer - The file buffer to upload
 * @param fileName - The name of the file
 * @param progress - Tracks the current step of the flow for error reporting
 * @param correlationId - Optional correlation ID for tracking
 * @returns Promise containing whether the file is classified and its classification info
 */
async function getFileClassificationInfo(
	fileService: SecloreDRMFileService,
	fileBuffer: Buffer,
	fileName: string,
	progress: { step: string },
	correlationId?: string,
): Promise<{
	classified: boolean;
	classificationInfo: unknown;
}> {
	let uploadedFileStorageId: string = '';
	progress.step = 'upload';
	try {
		const uploadResult = await fileService.uploadFile(
			new Uint8Array(fileBuffer),
			fileName,
			correlationId,
		);

		uploadedFileStorageId = uploadResult.fileStorageId;

		// Retrieve the current classification of the uploaded file
		progress.step = 'get classification';
		const classificationResult = await fileService.getFileClassification(
			uploadResult.fileStorageId,
			correlationId,
		);

		return {
			classified: classificationResult.classified,
			classificationInfo: classificationResult.classificationInfo,
		};
	} finally {
		if (uploadedFileStorageId !== '') {
			await deleteFile(fileService, uploadedFileStorageId, correlationId);
		}
	}
}

export async function getFileClassification(this: IExecuteFunctions): Promise<NodeOutput> {
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
			const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
			const correlationId = crypto.randomUUID();

			// Get input binary data
			const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);

			const fileBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

			const result = await getFileClassificationInfo(
				fileService,
				fileBuffer,
				binaryData.fileName || 'file',
				progress,
				correlationId,
			);

			// Create return item with the classification details
			const returnItem: INodeExecutionData = {
				json: {
					success: true,
					classified: result.classified,
					classificationInfo: result.classificationInfo as IDataObject,
					fileName: binaryData.fileName,
					correlationId: correlationId,
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
