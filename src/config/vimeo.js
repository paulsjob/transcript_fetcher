export const VIMEO_API_BASE_URL = 'https://api.vimeo.com';

// Preferred: set VITE_VIMEO_TOKEN in a local .env file.
// Fallback: paste a token string below for quick local testing.
export const VIMEO_TOKEN_FALLBACK = '';

export const VIMEO_USER_ID = '253729145';

export function resolveVimeoToken(overrideToken = '') {
  const envToken = import.meta.env.VITE_VIMEO_TOKEN ?? '';
  return overrideToken.trim() || envToken.trim() || VIMEO_TOKEN_FALLBACK.trim();
}
