import {
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
} from 'n8n-workflow';

import { protectWithHotFolder } from './operations/protectWithHotFolder';
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
		],
	};

	customOperations = {
		drmProtection: {
			protectWithHotFolder,
		},
		drmUnprotection: {
			unprotect,
		},
	};

}
