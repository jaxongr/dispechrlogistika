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

module.exports = router;
