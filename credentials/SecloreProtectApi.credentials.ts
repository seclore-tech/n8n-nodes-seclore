import { ICredentialTestRequest, ICredentialType, INodeProperties, Icon } from 'n8n-workflow';

export class SecloreProtectApi implements ICredentialType {
	name = 'secloreProtectApi';
	displayName = 'Seclore API';
	documentationUrl = 'https://docs.seclore.com/';
	icon: Icon = 'file:../icons/seclore.svg';
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			placeholder: 'https://api.seclore.com',
			description: 'The base URL of your Seclore DRM Server',
			required: true,
		},
		{
			displayName: 'Tenant ID',
			name: 'tenantId',
			type: 'string',
			default: '',
			placeholder: 'your-tenant-id',
			description: 'Your Seclore tenant ID',
			required: true,
		},
		{
			displayName: 'Tenant Secret',
			name: 'tenantSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'Your Seclore tenant secret',
			required: true,
		},
	];

	// Optional: Add credential test
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/seclore/drm/1.0/auth/login',
			method: 'POST',
			body: {
				tenantId: '={{$credentials.tenantId}}',
				tenantSecret: '={{$credentials.tenantSecret}}',
			},
			headers: {
				'Content-Type': 'application/json',
			},
		},
	};
}
