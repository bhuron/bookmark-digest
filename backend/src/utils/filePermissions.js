import fs from 'fs';

/**
 * Restrict a file to its owner (0600) so secrets such as the API key, the SMTP
 * password, and the settings database are not world-readable.
 *
 * Best-effort: not every filesystem supports POSIX modes, so a failure is
 * reported but never fatal.
 *
 * @param {string} filePath - Path to the file to restrict
 * @returns {boolean} - True if the file exists and is now owner-only
 */
export function restrictFilePermissions(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    fs.chmodSync(filePath, 0o600);
    return true;
  } catch {
    return false;
  }
}

export default { restrictFilePermissions };
