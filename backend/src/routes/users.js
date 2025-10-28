const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticate } = require('../middlewares/auth');

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/users/registered - Ro'yxatdan o'tgan foydalanuvchilar
 */
router.get('/registered', async (req, res) => {
  try {
    const botUsers = db.get('bot_users').value() || [];

    // Filter only registered users (who shared phone number)
    const registeredUsers = botUsers.filter(u => u.is_registered === true);

    // Sort by registration date (newest first)
    registeredUsers.sort((a, b) => {
      const dateA = new Date(a.registered_at || a.started_at);
      const dateB = new Date(b.registered_at || b.started_at);
      return dateB - dateA;
    });

    res.json({
      success: true,
      users: registeredUsers,
      count: registeredUsers.length
    });

  } catch (error) {
    console.error('Get registered users error:', error);
    res.status(500).json({
      success: false,
      error: 'Server xatolik'
    });
  }
});

/**
 * GET /api/users/all - Barcha bot foydalanuvchilar
 */
router.get('/all', async (req, res) => {
  try {
    const botUsers = db.get('bot_users').value() || [];

    // Sort by started date (newest first)
    botUsers.sort((a, b) => {
      const dateA = new Date(a.started_at);
      const dateB = new Date(b.started_at);
      return dateB - dateA;
    });

    res.json({
      success: true,
      users: botUsers,
      count: botUsers.length
    });

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      error: 'Server xatolik'
    });
  }
});

module.exports = router;
