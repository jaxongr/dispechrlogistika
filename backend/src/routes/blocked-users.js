const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticate, checkPermission } = require('../middlewares/auth');
const BlockedUser = require('../models/BlockedUser');

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/blocked-users - Block a user by Telegram ID
 */
router.post('/', checkPermission('block_users'), async (req, res) => {
  try {
    const { telegram_user_id, username, full_name, reason } = req.body;

    if (!telegram_user_id) {
      return res.status(400).json({ error: 'telegram_user_id is required' });
    }

    // Check if already blocked
    const isBlocked = await BlockedUser.isBlocked(telegram_user_id);
    if (isBlocked) {
      return res.status(400).json({ error: 'User is already blocked' });
    }

    await BlockedUser.create({
      telegram_user_id,
      username: username || null,
      full_name: full_name || null,
      reason: reason || 'Blocked from statistics',
      blocked_by: req.user.id
    });

    res.json({ message: 'User blocked successfully' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

/**
 * GET /api/blocked-users - Get all blocked users with group count
 */
router.get('/', async (req, res) => {
  try {
    const blockedUsers = db.get('blocked_users').value() || [];
    const allMessages = db.get('messages').value() || [];

    // Add group count for each blocked user
    const enrichedUsers = blockedUsers.map(user => {
      // Find all unique groups this user has posted in
      const userGroupIds = new Set(
        allMessages
          .filter(msg => msg.sender_user_id === user.telegram_user_id)
          .map(msg => msg.group_id)
      );

      return {
        ...user,
        group_count: userGroupIds.size
      };
    });

    res.json({ blocked_users: enrichedUsers });
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ error: 'Failed to get blocked users' });
  }
});

/**
 * DELETE /api/blocked-users/:telegram_user_id - Unblock a user
 */
router.delete('/:telegram_user_id', checkPermission('block_users'), async (req, res) => {
  try {
    const { telegram_user_id } = req.params;

    const blockedUser = db.get('blocked_users')
      .find({ telegram_user_id })
      .value();

    if (!blockedUser) {
      return res.status(404).json({ error: 'User not found in blocked list' });
    }

    db.get('blocked_users')
      .remove({ telegram_user_id })
      .write();

    res.json({ message: 'User unblocked successfully' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

module.exports = router;
