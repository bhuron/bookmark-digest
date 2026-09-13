/**
 * Sentinel values shipped in `.env.example`. A real credential must never equal
 * one of these, so a match means the feature is still unconfigured and the app
 * must not claim otherwise.
 *
 * Matching is exact (case-insensitive, trimmed) on purpose: pattern matching
 * would wrongly reject legitimate values such as "yourname@gmail.com".
 */
const PLACEHOLDER_VALUES = new Set([
  'your_email@gmail.com',
  'your_app_password',
  'your_kindle_email@kindle.com',
  'your_password',
  'your_api_key',
  'changeme'
]);

/**
 * Check whether a value is empty or a known placeholder.
 *
 * @param {*} value - Value to inspect
 * @returns {boolean} - True if missing, non-string, empty, or a placeholder
 */
export function isPlaceholderValue(value) {
  if (typeof value !== 'string') {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '' || PLACEHOLDER_VALUES.has(normalized);
}

/**
 * Check whether a value is present and not a placeholder.
 *
 * @param {*} value - Value to inspect
 * @returns {boolean} - True if the value is usable as a real credential
 */
export function isRealValue(value) {
  return typeof value === 'string' && !isPlaceholderValue(value);
}

export default { isPlaceholderValue, isRealValue };
