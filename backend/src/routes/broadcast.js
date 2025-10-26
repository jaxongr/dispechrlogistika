/**
 * Broadcast (Mass Messaging) Routes
 * API endpoints for sending messages to all groups
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const autoReplySession = require('../services/autoReplySession');

/**
 * POST /api/broadcast/send
 * Start mass messaging
 */
router.post('/send', authenticate, async (req, res) => {
  try {
    const { message, speed } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Check if auto-reply session is connected
    const status = autoReplySession.getStatus();
    if (!status.isConnected) {
      return res.status(400).json({
        success: false,
        error: 'Auto-reply session not connected. Set AUTOREPLY_SESSION_STRING in .env'
      });
    }

    // Start broadcast
    const result = await autoReplySession.startBroadcast(message, { speed });

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Broadcast send error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/broadcast/stop
 * Stop current broadcast
 */
router.post('/stop', authenticate, async (req, res) => {
  try {
    const result = autoReplySession.stopBroadcast();

    res.json(result);

  } catch (error) {
    console.error('Broadcast stop error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/broadcast/progress
 * Get broadcast progress
 */
router.get('/progress', authenticate, async (req, res) => {
  try {
    const progress = autoReplySession.getBroadcastProgress();

    res.json({
      success: true,
      ...progress
    });

  } catch (error) {
    console.error('Broadcast progress error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/broadcast/status
 * Get broadcast service status
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const status = autoReplySession.getStatus();

    res.json({
      success: true,
      ...status
    });

  } catch (error) {
    console.error('Broadcast status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ============================================
 * SESSION CREATION ROUTES (Dashboard)
 * ============================================
 */

/**
 * POST /api/broadcast/session/create-step1
 * Create new auto-reply session - Step 1: Send code
 */
router.post('/session/create-step1', authenticate, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber || phoneNumber.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Telefon raqam kiritilmagan'
      });
    }

    // Validate phone number format (must start with +)
    if (!phoneNumber.startsWith('+')) {
      return res.status(400).json({
        success: false,
        error: 'Telefon raqam + belgisi bilan boshlanishi kerak (masalan: +998901234567)'
      });
    }

    const result = await autoReplySession.createSessionStep1(phoneNumber);

    res.json(result);

  } catch (error) {
    console.error('Session creation step 1 error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/broadcast/session/create-step2
 * Create new auto-reply session - Step 2: Verify code
 */
router.post('/session/create-step2', authenticate, async (req, res) => {
  try {
    const { code, password } = req.body;

    if (!code || code.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'SMS kod kiritilmagan'
      });
    }

    const result = await autoReplySession.createSessionStep2(code, password || '');

    res.json(result);

  } catch (error) {
    console.error('Session creation step 2 error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/broadcast/session/save
 * Save session string to .env file
 */
router.post('/session/save', authenticate, async (req, res) => {
  try {
    const { sessionString } = req.body;

    if (!sessionString || sessionString.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Session string kiritilmagan'
      });
    }

    const result = await autoReplySession.saveSessionToEnv(sessionString);

    res.json(result);

  } catch (error) {
    console.error('Session save error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/broadcast/session/cancel
 * Cancel session creation
 */
router.post('/session/cancel', authenticate, async (req, res) => {
  try {
    autoReplySession.cancelSessionCreation();

    res.json({
      success: true,
      message: 'Session yaratish bekor qilindi'
    });

  } catch (error) {
    console.error('Session cancel error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
