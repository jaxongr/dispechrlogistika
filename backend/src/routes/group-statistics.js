/**
 * Group Statistics Routes
 * Guruh bo'yicha batafsil statistika - qaysi guruhdan nechta e'lon keldi, bloklandi
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { db } = require('../config/database');

/**
 * GET /api/group-stats/summary
 * Guruh statistikasi - umumiy
 */
router.get('/summary', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Date range
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: 24h ago
    const end = endDate ? new Date(endDate) : new Date(); // Default: now

    // Get all messages in date range
    const messages = db.get('messages')
      .filter(msg => {
        const msgDate = new Date(msg.created_at);
        return msgDate >= start && msgDate <= end;
      })
      .value();

    // Get all blocked users in date range
    const blockedUsers = db.get('blocked_users')
      .filter(user => {
        const blockDate = new Date(user.created_at);
        return blockDate >= start && blockDate <= end;
      })
      .value();

    // Get all groups
    const groups = db.get('telegram_groups').value();

    // Build statistics by group
    const groupStats = {};

    // Initialize stats for each group
    groups.forEach(group => {
      groupStats[group.id] = {
        group_id: group.id,
        group_name: group.group_name,
        group_username: group.group_username,
        total_messages: 0,
        sent_to_channel: 0,
        auto_blocked: 0,
        manual_blocked: 0,
        blocked_users: []
      };
    });

    // Count messages per group
    messages.forEach(msg => {
      if (groupStats[msg.group_id]) {
        groupStats[msg.group_id].total_messages++;

        // Check if sent to channel
        if (msg.sent_to_channel) {
          groupStats[msg.group_id].sent_to_channel++;
        }
      }
    });

    // Count blocked users per group
    blockedUsers.forEach(user => {
      // Find which group this user was blocked from (via messages)
      const userMessages = messages.filter(msg => msg.sender_user_id === user.telegram_user_id);

      userMessages.forEach(msg => {
        if (groupStats[msg.group_id]) {
          // Check if auto or manual block (blocked_by: 0 = auto, >0 = manual)
          if (user.blocked_by === 0) {
            groupStats[msg.group_id].auto_blocked++;
          } else {
            groupStats[msg.group_id].manual_blocked++;
          }

          // Add to blocked users list (unique)
          if (!groupStats[msg.group_id].blocked_users.includes(user.telegram_user_id)) {
            groupStats[msg.group_id].blocked_users.push(user.telegram_user_id);
          }
        }
      });
    });

    // Convert to array and sort by total messages
    const statsArray = Object.values(groupStats)
      .map(stat => ({
        ...stat,
        total_blocked: stat.auto_blocked + stat.manual_blocked,
        blocked_users_count: stat.blocked_users.length
      }))
      .sort((a, b) => b.total_messages - a.total_messages);

    res.json({
      success: true,
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      summary: {
        total_groups: statsArray.length,
        total_messages: messages.length,
        total_sent_to_channel: statsArray.reduce((sum, s) => sum + s.sent_to_channel, 0),
        total_auto_blocked: statsArray.reduce((sum, s) => sum + s.auto_blocked, 0),
        total_manual_blocked: statsArray.reduce((sum, s) => sum + s.manual_blocked, 0),
        total_blocked: blockedUsers.length
      },
      groups: statsArray
    });

  } catch (error) {
    console.error('Group statistics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/group-stats/daily
 * Kunlik statistika - har kun uchun
 */
router.get('/daily', authenticate, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const dailyStats = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < parseInt(days); i++) {
      const dayStart = new Date(today);
      dayStart.setDate(dayStart.getDate() - i);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      // Get messages for this day
      const dayMessages = db.get('messages')
        .filter(msg => {
          const msgDate = new Date(msg.created_at);
          return msgDate >= dayStart && msgDate <= dayEnd;
        })
        .value();

      // Get blocked users for this day
      const dayBlocked = db.get('blocked_users')
        .filter(user => {
          const blockDate = new Date(user.created_at);
          return blockDate >= dayStart && blockDate <= dayEnd;
        })
        .value();

      dailyStats.push({
        date: dayStart.toISOString().split('T')[0],
        total_messages: dayMessages.length,
        sent_to_channel: dayMessages.filter(m => m.sent_to_channel).length,
        auto_blocked: dayBlocked.filter(u => u.blocked_by === 0).length,
        manual_blocked: dayBlocked.filter(u => u.blocked_by > 0).length,
        total_blocked: dayBlocked.length
      });
    }

    res.json({
      success: true,
      days: parseInt(days),
      daily: dailyStats.reverse() // Oldest first
    });

  } catch (error) {
    console.error('Daily statistics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/group-stats/top-groups
 * Top guruhlar - eng ko'p e'lon bergan
 */
router.get('/top-groups', authenticate, async (req, res) => {
  try {
    const { limit = 10, period = 'today' } = req.query;

    let startDate;
    const endDate = new Date();

    switch (period) {
      case 'today':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
    }

    const messages = db.get('messages')
      .filter(msg => {
        const msgDate = new Date(msg.created_at);
        return msgDate >= startDate && msgDate <= endDate;
      })
      .value();

    const groups = db.get('telegram_groups').value();
    const groupCounts = {};

    // Count messages per group
    messages.forEach(msg => {
      if (!groupCounts[msg.group_id]) {
        const group = groups.find(g => g.id === msg.group_id);
        groupCounts[msg.group_id] = {
          group_id: msg.group_id,
          group_name: group?.group_name || 'Unknown',
          group_username: group?.group_username || '',
          total_messages: 0,
          sent_to_channel: 0
        };
      }
      groupCounts[msg.group_id].total_messages++;
      if (msg.sent_to_channel) {
        groupCounts[msg.group_id].sent_to_channel++;
      }
    });

    // Sort and limit
    const topGroups = Object.values(groupCounts)
      .sort((a, b) => b.total_messages - a.total_messages)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      period,
      limit: parseInt(limit),
      top_groups: topGroups
    });

  } catch (error) {
    console.error('Top groups error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
