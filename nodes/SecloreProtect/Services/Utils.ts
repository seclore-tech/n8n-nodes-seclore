import { LoggerProxy as Logger } from 'n8n-workflow';

/**
 * Extracts filename from Content-Disposition header
 * @param headers - Response headers object
 * @returns The extracted filename or null if not found
 */
export function getFileNameFromHeaders(headers?: { [key: string]: string }): string | null {
	const who = "Utils::getFileNameFromHeaders:: ";
	
	if (!headers) {
		Logger.debug(who + 'No headers provided');
		return null;
	}

	// Look for content-disposition header (case-insensitive)
	const contentDisposition = Object.keys(headers).find(key => 
		key.toLowerCase() === 'content-disposition'
	);

	if (!contentDisposition || !headers[contentDisposition]) {
		Logger.debug(who + 'Content-Disposition header not found');
		return null;
	}

	const headerValue = headers[contentDisposition];
	Logger.debug(who + 'Found Content-Disposition header', { headerValue });

	// Handle different filename formats in Content-Disposition header
	// Format 1: filename*=UTF-8''encoded-filename
	const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
	if (utf8Match) {
		try {
			const decodedFilename = decodeURIComponent(utf8Match[1]);
			Logger.debug(who + 'Extracted filename from UTF-8 format', { filename: decodedFilename });
			return decodedFilename;
		} catch (error) {
			Logger.error(who + 'Failed to decode UTF-8 filename', { error, encodedFilename: utf8Match[1] });
		}
	}

	// Format 2: filename="quoted-filename"
	const quotedMatch = headerValue.match(/filename="([^"]+)"/i);
	if (quotedMatch) {
		Logger.debug(who + 'Extracted filename from quoted format', { filename: quotedMatch[1] });
		return quotedMatch[1];
	}

	// Format 3: filename=unquoted-filename
	const unquotedMatch = headerValue.match(/filename=([^;]+)/i);
	if (unquotedMatch) {
		const filename = unquotedMatch[1].trim();
		Logger.debug(who + 'Extracted filename from unquoted format', { filename });
		return filename;
	}

	Logger.debug(who + 'Could not extract filename from Content-Disposition header', { headerValue });
	return null;
}

