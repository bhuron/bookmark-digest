import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';

import logger from '../utils/logger.js';
import { getConfig } from '../config.js';
import { getConnection } from '../database/index.js';



class KindleService {
  constructor() {
    this.transporter = null;
    this.kindleEmail = null;
    this.fromEmail = null;
    this.configured = false;
  }

  /**
   * Configure Kindle service with SMTP settings
   */
  configure(config) {
    try {
      this.transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: parseInt(config.smtpPort),
        secure: config.smtpSecure === 'true' || config.smtpSecure === true,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPassword
        }
      });

      this.kindleEmail = config.kindleEmail;
      this.fromEmail = config.fromEmail || config.smtpUser;
      this.configured = true;

      logger.info('Kindle service configured', {
        kindleEmail: this.kindleEmail,
        fromEmail: this.fromEmail
      });
    } catch (error) {
      logger.error('Failed to configure Kindle service', { error: error.message });
      this.configured = false;
      throw error;
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured() {
    return this.configured;
  }

  /**
   * Load configuration from environment variables
   */
  loadFromEnv() {
    const config = {
      kindleEmail: getConfig('KINDLE_EMAIL'),
      smtpHost: getConfig('SMTP_HOST'),
      smtpPort: getConfig('SMTP_PORT', '587'),
      smtpSecure: getConfig('SMTP_SECURE', 'false'),
      smtpUser: getConfig('SMTP_USER'),
      smtpPassword: getConfig('SMTP_PASSWORD'),
      fromEmail: getConfig('FROM_EMAIL')
    };

    // Check if required fields are present
    if (!config.kindleEmail || !config.smtpHost || !config.smtpUser || !config.smtpPassword) {
      logger.warn('Kindle service not fully configured - missing required fields');
      return false;
    }

    try {
      this.configure(config);
      return true;
    } catch (error) {
      logger.error('Failed to configure Kindle service from environment', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Send EPUB to Kindle
   */
  async sendEPUB(filepath, options = {}) {
    if (!this.configured) {
      throw new Error('Kindle service not configured. Please set up SMTP settings.');
    }

    const filename = options.filename || path.basename(filepath);
    const subject = options.subject || `Bookmark Digest: ${filename}`;

    try {
      // Verify file exists
      await fs.access(filepath);

      const mailOptions = {
        from: this.fromEmail,
        to: this.kindleEmail,
        subject: subject,
        text: `EPUB file attached: ${filename}`,
        attachments: [{
          filename: filename,
          path: filepath,
          contentType: 'application/epub+zip'
        }]
      };

      logger.info('Sending EPUB to Kindle', {
        filename,
        kindleEmail: this.kindleEmail
      });

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('EPUB sent to Kindle successfully', {
        messageId: info.messageId,
        response: info.response
      });

      // Update export record in database
      try {
        const db = getConnection();
        db.prepare(`
          UPDATE epub_exports
          SET sent_to_kindle = 1, sent_at = ?
          WHERE file_path = ?
        `).run(new Date().toISOString(), filepath);
      } catch (dbError) {
        logger.warn('Failed to update export record', {
          filepath,
          error: dbError.message
        });
      }

      return {
        success: true,
        messageId: info.messageId,
        filename,
        filepath
      };
    } catch (error) {
      logger.error('Failed to send EPUB to Kindle', {
        filepath,
        error: error.message
      });
      throw new Error(`Failed to send EPUB to Kindle: ${error.message}`);
    }
  }

  /**
   * Test SMTP connection
   */
  async testConnection() {
    if (!this.configured) {
      throw new Error('Kindle service not configured');
    }

    try {
      await this.transporter.verify();
      logger.info('SMTP connection test successful');
      return {
        success: true,
        message: 'SMTP connection successful'
      };
    } catch (error) {
      logger.error('SMTP connection test failed', { error: error.message });
      throw new Error(`SMTP connection failed: ${error.message}`);
    }
  }
}

// Create singleton instance and load from environment
const kindleService = new KindleService();
kindleService.loadFromEnv();

export default kindleService;
