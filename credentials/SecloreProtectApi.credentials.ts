import { IAuthenticateGeneric, ICredentialDataDecryptedObject, ICredentialTestRequest, ICredentialType, IHttpRequestHelper, INodeProperties, Icon } from 'n8n-workflow';
import { ILoginResponse } from '../nodes/SecloreProtect/Services/Interfaces/LoginInterfaces';

export class SecloreProtectApi implements ICredentialType {
	name = 'secloreProtectApi';
	displayName = 'Seclore API';
	documentationUrl = 'https://docs.seclore.com/';
	icon: Icon = 'file:../icons/seclore.svg';
	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'hidden',
			typeOptions: {
				expirable: true,
				password: true,
			},
			default: '',
		},
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

	// method will only be called if "accessToken" (the expirable property)
	// is empty or is expired
	async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject) {
		const tenantId = credentials.tenantId as string;
		const tenantSecret = credentials.tenantSecret as string;
		const baseUrl = credentials.baseUrl as string;

		const authResponse = await this.helpers.httpRequest({
			method: 'POST',
			url: `${baseUrl}/seclore/drm/1.0/auth/login`,
			body: {
				tenantId,
				tenantSecret,
			},
		}) as ILoginResponse;

		return { accessToken: authResponse.accessToken };
		
	}

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'Authorization': '=Bearer {{$credentials.accessToken}}',
			},
		},
	};

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
