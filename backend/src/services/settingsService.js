import { getConnection } from '../database/index.js';
import logger from '../utils/logger.js';
import { isRealValue } from '../utils/placeholders.js';

class SettingsService {
  constructor() {
    this.db = getConnection();
  }

  /**
   * Get setting value by key
   * @param {string} key - Setting key
   * @returns {string|null} - Setting value or null if not found
   */
  get(key) {
    try {
      const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
      const row = stmt.get(key);
      return row ? row.value : null;
    } catch (error) {
      logger.error('Failed to get setting', { key, error: error.message });
      return null;
    }
  }

  /**
   * Get all settings as key-value object
   * @returns {Object} - All settings
   */
  getAll() {
    try {
      const stmt = this.db.prepare('SELECT key, value FROM settings');
      const rows = stmt.all();
      const settings = {};
      rows.forEach(row => {
        settings[row.key] = row.value;
      });
      return settings;
    } catch (error) {
      logger.error('Failed to get all settings', { error: error.message });
      return {};
    }
  }

  /**
   * Set setting value
   * @param {string} key - Setting key
   * @param {string} value - Setting value
   * @returns {boolean} - Success
   */
  set(key, value) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);
      stmt.run(key, value);
      logger.debug('Setting updated', { key });
      return true;
    } catch (error) {
      logger.error('Failed to set setting', { key, value, error: error.message });
      return false;
    }
  }

  /**
   * Delete setting
   * @param {string} key - Setting key
   * @returns {boolean} - Success
   */
  delete(key) {
    try {
      const stmt = this.db.prepare('DELETE FROM settings WHERE key = ?');
      const result = stmt.run(key);
      logger.debug('Setting deleted', { key });
      return result.changes > 0;
    } catch (error) {
      logger.error('Failed to delete setting', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get SMTP-related settings as an object
   * @returns {Object} - SMTP configuration
   */
  getSmtpSettings() {
    const settings = this.getAll();
    return {
      kindleEmail: settings.KINDLE_EMAIL || '',
      smtpHost: settings.SMTP_HOST || '',
      smtpPort: settings.SMTP_PORT || '587',
      smtpSecure: settings.SMTP_SECURE || 'false',
      smtpUser: settings.SMTP_USER || '',
      smtpPassword: settings.SMTP_PASSWORD || '',
      fromEmail: settings.FROM_EMAIL || ''
    };
  }

  /**
   * Update SMTP settings
   * @param {Object} config - SMTP configuration
   * @returns {boolean} - Success
   */
  setSmtpSettings(config) {
    const {
      kindleEmail,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPassword,
      fromEmail
    } = config;

    // Validate required fields. Placeholder values from .env.example are
    // rejected so the UI cannot report a working configuration that isn't.
    const missing = [];
    if (!isRealValue(kindleEmail)) missing.push('kindleEmail');
    if (!isRealValue(smtpHost)) missing.push('smtpHost');
    if (!isRealValue(smtpUser)) missing.push('smtpUser');
    if (!isRealValue(smtpPassword)) missing.push('smtpPassword');

    if (missing.length > 0) {
      throw new Error(`Missing or placeholder SMTP fields: ${missing.join(', ')}`);
    }

    const updates = [
      ['KINDLE_EMAIL', kindleEmail],
      ['SMTP_HOST', smtpHost],
      ['SMTP_PORT', smtpPort || '587'],
      ['SMTP_SECURE', smtpSecure || 'false'],
      ['SMTP_USER', smtpUser],
      ['SMTP_PASSWORD', smtpPassword],
      ['FROM_EMAIL', fromEmail || smtpUser]
    ];

    return updates.every(([key, value]) => this.set(key, value));
  }

  /**
   * Check if SMTP is configured
   * @returns {boolean} - True if required fields are present
   */
  isSmtpConfigured() {
    const settings = this.getAll();
    return isRealValue(settings.KINDLE_EMAIL) &&
           isRealValue(settings.SMTP_HOST) &&
           isRealValue(settings.SMTP_USER) &&
           isRealValue(settings.SMTP_PASSWORD);
  }
}

// Create singleton instance
const settingsService = new SettingsService();

export default settingsService;