import express from 'express';
import settingsService from '../services/settingsService.js';
import kindleService from '../services/kindleService.js';
import { validateRequest, validationRules } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/settings
 * Get all settings (passwords masked)
 */
router.get('/',
  asyncHandler(async (req, res) => {
    const allSettings = settingsService.getAll();
    
    // Mask sensitive fields
    const maskedSettings = { ...allSettings };
    if (maskedSettings.SMTP_PASSWORD) {
      maskedSettings.SMTP_PASSWORD = '********';
    }
    
    res.json({
      settings: maskedSettings
    });
  })
);

/**
 * PUT /api/settings
 * Update settings
 */
router.put('/',
  validationRules.updateSmtpSettings,
  validateRequest,
  asyncHandler(async (req, res) => {
    const {
      kindleEmail,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPassword,
      fromEmail
    } = req.body;

    const smtpConfig = {
      kindleEmail,
      smtpHost,
      smtpPort: smtpPort || '587',
      smtpSecure: smtpSecure || 'false',
      smtpUser,
      smtpPassword,
      fromEmail: fromEmail || smtpUser
    };

    logger.info('Updating SMTP settings', {
      kindleEmail,
      smtpHost,
      smtpUser,
      hasPassword: !!smtpPassword
    });

    // Save to database
    const success = settingsService.setSmtpSettings(smtpConfig);
    
    if (!success) {
      throw new Error('Failed to save SMTP settings');
    }

    // Reconfigure Kindle service with new settings
    try {
      kindleService.configure(smtpConfig);
      logger.info('Kindle service reconfigured with new settings');
    } catch (error) {
      logger.error('Failed to reconfigure Kindle service', {
        error: error.message
      });
      // Don't fail the request - settings are saved but Kindle service needs manual restart
    }

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        kindleEmail,
        smtpHost,
        smtpPort: smtpPort || '587',
        smtpSecure: smtpSecure || 'false',
        smtpUser,
        fromEmail: fromEmail || smtpUser
      }
    });
  })
);

/**
 * POST /api/settings/test-smtp
 * Test SMTP connection with current settings
 */
router.post('/test-smtp',
  asyncHandler(async (req, res) => {
    if (!kindleService.isConfigured()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Kindle service not configured. Please set up SMTP settings first.'
      });
    }

    try {
      const result = await kindleService.testConnection();
      res.json({
        success: true,
        message: 'SMTP connection test successful',
        result
      });
    } catch (error) {
      logger.error('SMTP connection test failed', { error: error.message });
      res.status(500).json({
        error: 'SMTP Test Failed',
        message: error.message
      });
    }
  })
);

export default router;