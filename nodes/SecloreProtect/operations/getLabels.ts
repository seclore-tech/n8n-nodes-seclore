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
 * Uploads a context file and retrieves all classification labels from the Policy Server
 * @param fileService - The SecloreDRMFileService instance
 * @param fileBuffer - The file buffer to upload as context
 * @param fileName - The name of the file
 * @param forceLabelRefresh - Whether to force refresh of the label cache
 * @param correlationId - Optional correlation ID for tracking
 * @returns Promise containing the labels configured in the Policy Server
 */
async function getLabelsWithContextFile(
	fileService: SecloreDRMFileService,
	fileBuffer: Buffer,
	fileName: string,
	forceLabelRefresh: boolean,
	correlationId?: string,
): Promise<unknown> {
	let contextFileStorageId: string = '';
	try {
		const uploadResult = await fileService.uploadFile(
			new Uint8Array(fileBuffer),
			fileName,
			correlationId,
		);

		contextFileStorageId = uploadResult.fileStorageId;

		const labelsResult = await fileService.getLabels(
			{
				fileStorageId: uploadResult.fileStorageId,
				forceLabelRefresh,
			},
			correlationId,
		);

		return labelsResult.labels;
	} finally {
		if (contextFileStorageId !== '') {
			await deleteFile(fileService, contextFileStorageId, correlationId);
		}
	}
}

export async function getLabels(this: IExecuteFunctions): Promise<NodeOutput> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];

	const credentials = await this.getCredentials('secloreProtectApi');
	const baseUrl = credentials.baseUrl as string;

	// Initialize the file service
	const fileService = new SecloreDRMFileService(this, baseUrl);

	for (let i = 0; i < items.length; i++) {
		try {
			// Get parameters for this item
			const forceLabelRefresh = this.getNodeParameter('forceLabelRefresh', i, false) as boolean;
			const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
			const correlationId = crypto.randomUUID();

			// Get input binary data
			const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);

			const fileBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

			const labels = await getLabelsWithContextFile(
				fileService,
				fileBuffer,
				binaryData.fileName || 'file',
				forceLabelRefresh,
				correlationId,
			);

			// Create return item with the labels
			const returnItem: INodeExecutionData = {
				json: {
					success: true,
					labels: labels as IDataObject | IDataObject[],
					correlationId: correlationId,
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
