import {
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
} from 'n8n-workflow';

import { classify } from './operations/classify';
import { declassify } from './operations/declassify';
import { getFileClassification } from './operations/getFileClassification';
import { getLabels } from './operations/getLabels';
import { protectWithHotFolder } from './operations/protectWithHotFolder';
import { reclassify } from './operations/reclassify';
import { unprotect } from './operations/unprotect';

export class SecloreProtect implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Seclore',
		name: 'secloreProtect',
		icon: 'file:../../icons/seclore.svg',
		usableAsTool: true,
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Protect files using Seclore DRM',
		defaults: {
			name: 'Seclore',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'secloreProtectApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'DRM Classification',
						value: 'drmClassification',
						description: 'DRM file classification operations',
					},
					{
						name: 'DRM Protection',
						value: 'drmProtection',
						description: 'DRM file protection operations',
					},
					{
						name: 'DRM Unprotection',
						value: 'drmUnprotection',
						description: 'DRM file unprotection operations',
					},
				],
				default: 'drmProtection',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['drmProtection'],
					},
				},
				options: [
					{
						name: 'Protect Using Policy',
						value: 'protectWithHotFolder',
						description: 'Protect a file using HotFolder ID configuration',
						action: 'Protect file using policy',
					},
				],
				default: 'protectWithHotFolder',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['drmUnprotection'],
					},
				},
				options: [
					{
						name: 'Unprotect',
						value: 'unprotect',
						description: 'Unprotect a protected file',
						action: 'Unprotect file',
					},
				],
				default: 'unprotect',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['drmClassification'],
					},
				},
				options: [
					{
						name: 'Classify',
						value: 'classify',
						description: 'Apply a classification label to a file',
						action: 'Classify file',
					},
					{
						name: 'Declassify',
						value: 'declassify',
						description: 'Remove the classification label from a file',
						action: 'Declassify file',
					},
					{
						name: 'Get Classification Labels',
						value: 'getLabels',
						description: 'Retrieve all classification labels configured in the Policy Server',
						action: 'Get classification labels',
					},
					{
						name: 'Get File Classification',
						value: 'getFileClassification',
						description: 'Retrieve the current classification label on a file',
						action: 'Get file classification',
					},
					{
						name: 'Reclassify',
						value: 'reclassify',
						description: 'Update the classification label on an already-classified file',
						action: 'Reclassify file',
					},
				],
				default: 'classify',
			},
			{
				displayName: 'HotFolder ID',
				name: 'hotfolderId',
				type: 'string',
				required: true,
				default: '',
				placeholder: '',
				description: 'The ID of the HotFolder configuration to use for protection',
				displayOptions: {
					show: {
						resource: ['drmProtection'],
						operation: ['protectWithHotFolder'],
					},
				},
			},
			{
				displayName: 'Input Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Name of the binary property that contains the file to protect',
				displayOptions: {
					show: {
						resource: ['drmProtection'],
						operation: ['protectWithHotFolder'],
					},
				},
			},
			
			// Unprotect operation parameters
			{
				displayName: 'Input Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Name of the binary property that contains the protected file to unprotect',
				displayOptions: {
					show: {
						resource: ['drmUnprotection'],
						operation: ['unprotect'],
					},
				},
			},

			// Classification operation parameters
			{
				displayName: 'Label ID',
				name: 'labelId',
				type: 'string',
				required: true,
				default: '',
				placeholder: '',
				description: 'The ID of the classification label configured in the Policy Server',
				displayOptions: {
					show: {
						resource: ['drmClassification'],
						operation: ['classify', 'reclassify'],
					},
				},
			},
			{
				displayName: 'Input Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Name of the binary property that contains the input file',
				displayOptions: {
					show: {
						resource: ['drmClassification'],
						operation: ['classify', 'declassify', 'getFileClassification', 'getLabels', 'reclassify'],
					},
				},
			},
			{
				displayName: 'Force Label Refresh',
				name: 'forceLabelRefresh',
				type: 'boolean',
				default: false,
				description: 'Whether to force a refresh of the label cache before the operation',
				displayOptions: {
					show: {
						resource: ['drmClassification'],
						operation: ['classify', 'declassify', 'getLabels', 'reclassify'],
					},
				},
			},
		],
	};

	customOperations = {
		drmClassification: {
			classify,
			declassify,
			getFileClassification,
			getLabels,
			reclassify,
		},
		drmProtection: {
			protectWithHotFolder,
		},
		drmUnprotection: {
			unprotect,
		},
	};

}
