const VIMEO_URL_REGEX = /^(https?:\/\/)?(www\.)?vimeo\.com\/(?:video\/)?\d+(?:$|[/?#])/i;

export function isValidVimeoUrl(url = '') {
  return VIMEO_URL_REGEX.test(url.trim());
}
