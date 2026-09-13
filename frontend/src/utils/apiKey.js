/**
 * Where the browser keeps the API key.
 *
 * The key used to live only in localStorage, which is scoped to an origin *and
 * the origin includes the port*. So a key entered at `localhost:5174`
 * (`npm run dev`) was invisible at `localhost:3001` (`npm run serve`), and the UI
 * asked for it again every time you switched between the two.
 *
 * Cookies ignore the port, so a copy in a cookie is shared between both URLs on
 * the same host. localStorage stays the fallback, and a key that only exists
 * there is migrated into the cookie on first read - so an existing setup heals
 * itself without anyone re-entering anything.
 *
 * Caveat worth knowing: `localhost` and `127.0.0.1` are different hosts for both
 * cookies and localStorage, so pick one and stay with it.
 */

export const API_KEY_STORAGE_KEY = 'bookmark_digest_api_key';

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Pull the key out of a `document.cookie` string.
 *
 * @param {string} cookieString - Raw document.cookie value
 * @returns {string} - The stored key, or '' when absent
 */
export function parseApiKeyFromCookie(cookieString) {
  if (typeof cookieString !== 'string' || cookieString === '') {
    return '';
  }

  for (const part of cookieString.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');

    if (name === API_KEY_STORAGE_KEY) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return '';
}

/**
 * Build the Set-Cookie string used to persist the key.
 *
 * @param {string} value - API key
 * @returns {string} - Cookie string for `document.cookie`
 */
export function buildApiKeyCookie(value) {
  return `${API_KEY_STORAGE_KEY}=${encodeURIComponent(value)}` +
    `; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

function readCookie() {
  return typeof document === 'undefined' ? '' : parseApiKeyFromCookie(document.cookie);
}

function writeCookie(value) {
  if (typeof document !== 'undefined') {
    document.cookie = buildApiKeyCookie(value);
  }
}

function readStorage() {
  try {
    return typeof localStorage === 'undefined'
      ? ''
      : (localStorage.getItem(API_KEY_STORAGE_KEY) || '');
  } catch {
    // Storage can be unavailable (private mode, blocked cookies)
    return '';
  }
}

/**
 * Read the API key, preferring the cookie so both ports agree.
 *
 * @returns {string} - The stored key, or '' when unset
 */
export function getApiKey() {
  const fromCookie = readCookie();

  if (fromCookie) {
    return fromCookie;
  }

  // Heal a key that exists only in this origin's localStorage
  const fromStorage = readStorage();

  if (fromStorage) {
    writeCookie(fromStorage);
  }

  return fromStorage;
}

/**
 * Remember the API key in both places.
 *
 * @param {string} value - API key
 * @returns {string} - The trimmed value that was stored
 */
export function setApiKey(value) {
  const trimmed = String(value || '').trim();

  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
  } catch {
    // Non-fatal: the cookie below still carries the key
  }

  writeCookie(trimmed);

  return trimmed;
}

/**
 * Forget the API key everywhere.
 */
export function clearApiKey() {
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // Nothing to remove
  }

  if (typeof document !== 'undefined') {
    document.cookie = `${API_KEY_STORAGE_KEY}=; path=/; max-age=0; SameSite=Lax`;
  }
}

/**
 * True when a key is available, for gating queries.
 *
 * @returns {boolean}
 */
export function hasApiKey() {
  return Boolean(getApiKey());
}

export default { getApiKey, setApiKey, clearApiKey, hasApiKey };
