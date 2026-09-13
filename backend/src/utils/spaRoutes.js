/**
 * Paths that must never be answered with the single-page-app shell.
 *
 * The API, the health check and locally stored images share an origin with the
 * built frontend, so the SPA fallback has to leave them alone and let the JSON
 * 404 handler deal with unknown paths underneath them.
 */
const SERVER_PREFIXES = ['/api', '/health', '/images'];

/**
 * Should a GET request for this path fall back to index.html?
 *
 * Matches whole path segments only, so `/apiary` is an app route while `/api`
 * and `/api/articles` are not.
 *
 * @param {string} pathname - Request path, without the query string
 * @returns {boolean} - True when the SPA shell should be served
 */
export function isSpaRoute(pathname) {
  if (typeof pathname !== 'string' || pathname === '' || pathname.includes('\0')) {
    return false;
  }

  return !SERVER_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export default { isSpaRoute };
