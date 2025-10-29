/**
 * Advertisement Scheduler Routes
 * API endpoints for managing automated ads
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const adScheduler = require('../services/ad-scheduler');

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/ad-scheduler/settings
 * Get current ad scheduler settings
 */
router.get('/settings', async (req, res) => {
  try {
    const settings = adScheduler.getSettings();

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Get ad scheduler settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Server xatolik'
    });
  }
});

/**
 * POST /api/ad-scheduler/update
 * Update ad scheduler settings
 */
router.post('/update', async (req, res) => {
  try {
    const { enabled, interval, message } = req.body;

    // Validate interval
    if (interval !== undefined) {
      if (typeof interval !== 'number' || interval < 1 || interval > 1000) {
        return res.status(400).json({
          success: false,
          error: 'Interval 1 dan 1000 gacha bo\'lishi kerak'
        });
      }
    }

    // Validate message
    if (enabled && (!message || message.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Reklama xabari bo\'sh bo\'lishi mumkin emas'
      });
    }

    const result = adScheduler.updateSettings({ enabled, interval, message });

    res.json(result);
  } catch (error) {
    console.error('Update ad scheduler error:', error);
    res.status(500).json({
      success: false,
      error: 'Server xatolik'
    });
  }
});

/**
 * POST /api/ad-scheduler/send-now
 * Manually send ad (for testing)
 */
router.post('/send-now', async (req, res) => {
  try {
    const result = await adScheduler.sendAdManually();

    res.json(result);
  } catch (error) {
    console.error('Send ad manually error:', error);
    res.status(500).json({
      success: false,
      error: 'Server xatolik'
    });
  }
});

/**
 * POST /api/ad-scheduler/reset-counter
 * Reset message counter
 */
router.post('/reset-counter', async (req, res) => {
  try {
    const result = adScheduler.resetCounter();

    res.json(result);
  } catch (error) {
    console.error('Reset counter error:', error);
    res.status(500).json({
      success: false,
      error: 'Server xatolik'
    });
  }
});

/**
 * GET /api/ad-scheduler/stats
 * Get ad scheduler statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = adScheduler.getStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get ad scheduler stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server xatolik'
    });
  }
});

module.exports = router;
