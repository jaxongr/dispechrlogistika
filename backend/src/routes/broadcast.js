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
    const { message, speed, loop } = req.body;

    console.log('📥 BROADCAST REQUEST:', {
      messageLength: message?.length,
      speed,
      loop,
      loopType: typeof loop
    });

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

    // Start broadcast with loop parameter
    const result = await autoReplySession.startBroadcast(message, { speed, loop });

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

/**
 * ============================================
 * SCHEDULED BROADCAST ROUTES
 * ============================================
 */

/**
 * POST /api/broadcast/schedule/create
 * Create scheduled broadcast
 */
router.post('/schedule/create', authenticate, async (req, res) => {
  try {
    const { message, cronExpression, enabled } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Xabar matni kiritilmagan'
      });
    }

    if (!cronExpression) {
      return res.status(400).json({
        success: false,
        error: 'Schedule qiymati kiritilmagan'
      });
    }

    const schedule = autoReplySession.addScheduledBroadcast({
      message,
      cronExpression,
      enabled
    });

    res.json({
      success: true,
      schedule
    });

  } catch (error) {
    console.error('Schedule create error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/broadcast/schedule/list
 * Get all scheduled broadcasts
 */
router.get('/schedule/list', authenticate, async (req, res) => {
  try {
    const schedules = autoReplySession.getScheduledBroadcasts();

    res.json({
      success: true,
      schedules
    });

  } catch (error) {
    console.error('Schedule list error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/broadcast/schedule/:id
 * Update scheduled broadcast
 */
router.put('/schedule/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const schedule = autoReplySession.updateScheduledBroadcast(id, updates);

    res.json({
      success: true,
      schedule
    });

  } catch (error) {
    console.error('Schedule update error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/broadcast/schedule/:id
 * Delete scheduled broadcast
 */
router.delete('/schedule/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = autoReplySession.deleteScheduledBroadcast(id);

    res.json(result);

  } catch (error) {
    console.error('Schedule delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ============================================
 * PRIVATE MESSAGE AUTO-REPLY ROUTES
 * ============================================
 */

/**
 * GET /api/broadcast/private-reply/settings
 * Get private message auto-reply settings
 */
router.get('/private-reply/settings', authenticate, async (req, res) => {
  try {
    const settings = autoReplySession.getPrivateMessageAutoReply();

    res.json({
      success: true,
      settings
    });

  } catch (error) {
    console.error('Private reply settings error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/broadcast/private-reply/update
 * Update private message auto-reply settings
 */
router.post('/private-reply/update', authenticate, async (req, res) => {
  try {
    const { enabled, template } = req.body;

    const result = autoReplySession.updatePrivateMessageAutoReply({
      enabled,
      template
    });

    res.json(result);

  } catch (error) {
    console.error('Private reply update error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/broadcast/private-reply/clear
 * Clear replied users list
 */
router.post('/private-reply/clear', authenticate, async (req, res) => {
  try {
    const result = autoReplySession.clearRepliedUsers();

    res.json(result);

  } catch (error) {
    console.error('Private reply clear error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * ============================================
 * SESSION MANAGEMENT ROUTES
 * ============================================
 */

/**
 * POST /api/broadcast/session/delete
 * Delete session file and restart
 */
router.post('/session/delete', authenticate, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const sessionPath = path.join(__dirname, '../../session.json');
    const backendEnvPath = path.join(__dirname, '../../.env');
    const rootEnvPath = path.join(__dirname, '../../../.env'); // ROOT .env file

    let deleted = false;

    // Check if session.json exists
    if (fs.existsSync(sessionPath)) {
      // Backup before delete
      const backupPath = path.join(__dirname, '../../session_backup_' + Date.now() + '.json');
      fs.copyFileSync(sessionPath, backupPath);

      // Delete session
      fs.unlinkSync(sessionPath);

      console.log('🗑️  Session file deleted:', sessionPath);
      console.log('💾 Backup saved:', backupPath);
      deleted = true;
    }

    // Helper function to remove AUTOREPLY_SESSION_STRING from .env file
    const removeSessionFromEnv = (envPath) => {
      if (!fs.existsSync(envPath)) {
        console.log(`⚠️  ${envPath} topilmadi`);
        return false;
      }

      let envContent = fs.readFileSync(envPath, 'utf8');

      // Backup .env
      const envBackupPath = envPath + '.backup_' + Date.now();
      fs.writeFileSync(envBackupPath, envContent);
      console.log(`💾 ${envPath} backup saved:`, envBackupPath);

      // Remove or comment out AUTOREPLY_SESSION_STRING
      const lines = envContent.split('\n');
      const newLines = lines.map(line => {
        if (line.startsWith('AUTOREPLY_SESSION_STRING=')) {
          return '# AUTOREPLY_SESSION_STRING=  # Session o\'chirildi - ' + new Date().toLocaleString();
        }
        return line;
      });

      fs.writeFileSync(envPath, newLines.join('\n'));
      console.log(`🗑️  AUTOREPLY_SESSION_STRING removed from ${envPath}`);
      return true;
    };

    // Remove from both backend and root .env files
    if (removeSessionFromEnv(backendEnvPath)) {
      deleted = true;
    }

    if (removeSessionFromEnv(rootEnvPath)) {
      deleted = true;
    }

    if (deleted) {
      // Schedule restart
      setTimeout(() => {
        console.log('🔄 Restarting server...');
        process.exit(0); // PM2 will auto-restart
      }, 1000);

      res.json({
        success: true,
        message: 'Session o\'chirildi. Server qayta ishga tushmoqda...'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Session topilmadi'
      });
    }

  } catch (error) {
    console.error('Session delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/broadcast/session/restart
 * Restart session without deleting
 */
router.post('/session/restart', authenticate, async (req, res) => {
  try {
    console.log('🔄 Restarting session...');

    // Disconnect current session
    await autoReplySession.disconnect();

    // Schedule server restart
    setTimeout(() => {
      console.log('🔄 Restarting server...');
      process.exit(0); // PM2 will auto-restart
    }, 1000);

    res.json({
      success: true,
      message: 'Session qayta ishga tushmoqda...'
    });

  } catch (error) {
    console.error('Session restart error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
