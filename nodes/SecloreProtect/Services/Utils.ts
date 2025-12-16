/**
 * Extracts filename from Content-Disposition header
 * @param headers - Response headers object
 * @returns The extracted filename or null if not found
 */
export function getFileNameFromHeaders(headers?: { [key: string]: string }): string | null {
	
	if (!headers) {
		return null;
	}

	// Look for content-disposition header (case-insensitive)
	const contentDisposition = Object.keys(headers).find(key => 
		key.toLowerCase() === 'content-disposition'
	);

	if (!contentDisposition || !headers[contentDisposition]) {
		return null;
	}

	const headerValue = headers[contentDisposition];

	// Handle different filename formats in Content-Disposition header
	// Format 1: filename*=UTF-8''encoded-filename
	const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
	if (utf8Match) {
		try {
			const decodedFilename = decodeURIComponent(utf8Match[1]);
			return decodedFilename;
		} catch {
			// do nothing
		}
	}

	// Format 2: filename="quoted-filename"
	const quotedMatch = headerValue.match(/filename="([^"]+)"/i);
	if (quotedMatch) {
		return quotedMatch[1];
	}

	// Format 3: filename=unquoted-filename
	const unquotedMatch = headerValue.match(/filename=([^;]+)/i);
	if (unquotedMatch) {
		const filename = unquotedMatch[1].trim();
		return filename;
	}

	return null;
}

