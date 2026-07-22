# n8n-nodes-seclore

This is an n8n community node. It lets you use Seclore DRM Server in your n8n workflows.

[Seclore](https://www.seclore.com) is a leading data-centric security platform that provides enterprise-grade Digital Rights Management (DRM) capabilities to protect sensitive files and documents throughout their lifecycle.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)  

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

Use `@seclore/n8n-nodes-seclore` as the package name.

## Operations

This node supports the following operations with Seclore DRM Server:

### DRM Protection
#### Protect using Policy
- **Description**: Protects files using Seclore's HotFolder ID configuration and policy-based protection
- **Required Parameters**:
  - **HotFolder ID**: The ID of the HotFolder configuration to use for protection
  - **Input Binary Property**: Name of the binary property containing the file to protect (default: 'data')
- **Output**: Protected file with DRM protection applied according to the specified policy


### DRM Unprotection
#### Unprotect
- **Description**: Removes DRM protection from Seclore-protected files
- **Required Parameters**:
  - **Input Binary Property**: Name of the binary property containing the protected file (default: 'data')
- **Output**: Unprotected original file content


### DRM Classification
#### Classify
- **Description**: Applies a classification label (configured in the Seclore Policy Server) to a file
- **Required Parameters**:
  - **Label ID**: The ID of the classification label configured in the Policy Server
  - **Input Binary Property**: Name of the binary property containing the input file (default: 'data')
- **Optional Parameters**:
  - **Force Label Refresh**: Refresh the server-side label cache before the operation
- **Output**: The classified file with classification metadata embedded

#### Reclassify
- **Description**: Updates the classification label on an already-classified file
- **Required Parameters**:
  - **Label ID**: The new classification label ID
  - **Input Binary Property**: Name of the binary property containing the input file (default: 'data')
- **Optional Parameters**:
  - **Force Label Refresh**: Refresh the server-side label cache before the operation
- **Output**: The reclassified file, plus the current and previous label details

#### Declassify
- **Description**: Removes the classification label from a file (DRM protection, if any, is unaffected)
- **Required Parameters**:
  - **Input Binary Property**: Name of the binary property containing the input file (default: 'data')
- **Optional Parameters**:
  - **Force Label Refresh**: Refresh the server-side label cache before the operation
- **Output**: The declassified file

#### Get Classification Labels
- **Description**: Retrieves all classification labels configured in the Policy Server
- **Required Parameters**:
  - **Input Binary Property**: Name of the binary property containing a context file (default: 'data')
- **Optional Parameters**:
  - **Force Label Refresh**: Refresh the server-side label cache before the operation
- **Output**: The list of labels, including nested sublabels

#### Get File Classification
- **Description**: Retrieves the current classification label on a file
- **Required Parameters**:
  - **Input Binary Property**: Name of the binary property containing the input file (default: 'data')
- **Output**: Whether the file is classified and its classification details


## Credentials

To use this node, you need to authenticate with your Seclore DRM Server. The following credentials are required:

### Prerequisites
- Access to a Seclore DRM Server instance
- Valid tenant credentials (Tenant ID and Tenant Secret)
- Appropriate permissions for file protection/unprotection operations

### Authentication Setup
1. **Base URL**: The base URL of your Seclore DRM Server (e.g., `https://api.seclore.com`)
2. **Tenant ID**: Your unique Seclore tenant identifier
3. **Tenant Secret**: Your tenant's secret key for API authentication

### Configuration Steps
1. In n8n, go to **Credentials** → **Create New**
2. Search for "Seclore API" and select it
3. Fill in your Seclore DRM Server details:
   - **Base URL**: Enter your Seclore DRM Server base URL
   - **Tenant ID**: Provide your unique tenant identifier
   - **Tenant Secret**: Enter your tenant's secret key (will be masked for security)
4. Test the connection to ensure credentials are valid (tests against `/seclore/drm/1.0/auth/login` endpoint)
5. Save the credentials for use in your workflows

## Compatibility

- **Minimum n8n version**: 1.0.0
- **Tested with n8n versions**: 1.0.0+
- **Node.js version**: 18.x or higher
- **Seclore API version**: Compatible with Seclore DRM API v1.0

## Usage

### Basic Workflow Examples

#### Protecting Files with Policy
1. Use a trigger node to receive files (HTTP Request, File Trigger, etc.)
2. Add the **Seclore** node to your workflow
3. Configure the node:
   - **Resource**: Select "DRM Protection"
   - **Operation**: Select "Protect using Policy"
   - **HotFolder ID**: Enter your HotFolder configuration ID
   - **Input Binary Property**: Specify the binary property name (default: 'data')
4. Configure your Seclore API credentials
5. The node will return the protected file with DRM encryption applied according to your policy

#### Unprotecting Files
1. Receive protected Seclore files in your workflow
2. Add the **Seclore** node to your workflow
3. Configure the node:
   - **Resource**: Select "DRM Unprotection"
   - **Operation**: Select "Unprotect"
   - **Input Binary Property**: Specify the binary property containing the protected file (default: 'data')
4. Configure your Seclore API credentials
5. The node will return the original unprotected file content

### Important Notes
- Ensure your Seclore DRM Server is accessible from your n8n instance
- File operations may take time depending on file size and server performance
- Always handle errors appropriately in your workflows
- Protected files can only be unprotected by authorized users with proper credentials
- HotFolder ID must be configured in your Seclore Policy Server before using protection operations
- The node supports binary data processing for both input and output files

### Error Handling
The node includes comprehensive error handling and logging:
- Connection failures to Seclore server
- Authentication errors
- File processing errors
- Automatic cleanup of temporary files

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Seclore Official Documentation](https://docs.seclore.com/)
* [Seclore Support](https://support.seclore.com/)

## License

Refer the [LICENSE.md](LICENSE.md) file for details.

## Support

For issues related to this n8n node:
- Create an issue in this repository
- Contact: support@seclore.com

For Seclore platform support:
- Visit [Seclore Support Portal](https://support.seclore.com/)
- Check [Seclore Documentation](https://docs.seclore.com/)
