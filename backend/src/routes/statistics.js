const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticate } = require('../middlewares/auth');

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/statistics/daily - Kunlik statistika
 */
router.get('/daily', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    // Start and end of day
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const allMessages = db.get('messages').value() || [];
    const blockedUsers = db.get('blocked_users').value() || [];

    // Filter messages for this day
    const dailyMessages = allMessages.filter(msg => {
      const msgDate = new Date(msg.created_at);
      return msgDate >= startOfDay && msgDate <= endOfDay;
    });

    // Filter blocked users for this day
    const dailyBlockedUsers = blockedUsers.filter(user => {
      const blockedDate = new Date(user.blocked_at);
      return blockedDate >= startOfDay && blockedDate <= endOfDay;
    });

    // Count by status
    const totalReceived = dailyMessages.length;
    const totalBlocked = dailyMessages.filter(m => m.is_dispatcher).length;
    const totalApproved = dailyMessages.filter(m => !m.is_dispatcher).length;
    const totalSent = dailyMessages.filter(m => m.is_sent_to_channel).length;

    // Bloklash sabablari (reasons)
    const blockReasons = {};
    dailyMessages
      .filter(m => m.is_dispatcher)
      .forEach(m => {
        // Extract reason from raw_data or use generic
        const reason = m.raw_data?.detection?.reason || 'Dispetcher aniqlandi';
        blockReasons[reason] = (blockReasons[reason] || 0) + 1;
      });

    // Top 5 most blocked reasons
    const topBlockReasons = Object.entries(blockReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count }));

    // Auto-blocked users (from blocked_users table)
    const autoBlockedCount = dailyBlockedUsers.filter(u => u.blocked_by === 0).length;
    const manualBlockedCount = dailyBlockedUsers.filter(u => u.blocked_by !== 0).length;

    res.json({
      date: targetDate.toISOString().split('T')[0],
      messages: {
        total_received: totalReceived,
        total_blocked: totalBlocked,
        total_approved: totalApproved,
        total_sent: totalSent,
        approval_rate: totalReceived > 0 ? ((totalApproved / totalReceived) * 100).toFixed(1) : 0,
        block_rate: totalReceived > 0 ? ((totalBlocked / totalReceived) * 100).toFixed(1) : 0
      },
      users: {
        total_blocked: dailyBlockedUsers.length,
        auto_blocked: autoBlockedCount,
        manual_blocked: manualBlockedCount
      },
      block_reasons: topBlockReasons
    });
  } catch (error) {
    console.error('Daily statistics error:', error);
    res.status(500).json({ error: 'Server xatolik' });
  }
});

/**
 * GET /api/statistics/overview - Umumiy va oxirgi 7 kun statistikasi
 */
router.get('/overview', async (req, res) => {
  try {
    const allMessages = db.get('messages').value() || [];
    const blockedUsers = db.get('blocked_users').value() || [];

    // Last 7 days statistics
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const dayMessages = allMessages.filter(m => {
        const msgDate = new Date(m.created_at);
        return msgDate >= date && msgDate < nextDay;
      });

      const dayBlockedUsers = blockedUsers.filter(u => {
        const blockedDate = new Date(u.blocked_at);
        return blockedDate >= date && blockedDate < nextDay;
      });

      last7Days.push({
        date: date.toISOString().split('T')[0],
        total_messages: dayMessages.length,
        blocked_messages: dayMessages.filter(m => m.is_dispatcher).length,
        approved_messages: dayMessages.filter(m => !m.is_dispatcher).length,
        sent_messages: dayMessages.filter(m => m.is_sent_to_channel).length,
        blocked_users: dayBlockedUsers.length
      });
    }

    // All-time statistics
    const totalMessages = allMessages.length;
    const totalBlocked = allMessages.filter(m => m.is_dispatcher).length;
    const totalApproved = allMessages.filter(m => !m.is_dispatcher).length;
    const totalSent = allMessages.filter(m => m.is_sent_to_channel).length;

    res.json({
      all_time: {
        total_messages: totalMessages,
        total_blocked: totalBlocked,
        total_approved: totalApproved,
        total_sent: totalSent,
        total_blocked_users: blockedUsers.length,
        approval_rate: totalMessages > 0 ? ((totalApproved / totalMessages) * 100).toFixed(1) : 0,
        block_rate: totalMessages > 0 ? ((totalBlocked / totalMessages) * 100).toFixed(1) : 0
      },
      last_7_days: last7Days
    });
  } catch (error) {
    console.error('Overview statistics error:', error);
    res.status(500).json({ error: 'Server xatolik' });
  }
});

/**
 * GET /api/statistics/realtime - Real-time statistika (bugun)
 */
router.get('/realtime', async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const allMessages = db.get('messages').value() || [];
    const blockedUsers = db.get('blocked_users').value() || [];

    // Today's messages
    const todayMessages = allMessages.filter(msg => {
      const msgDate = new Date(msg.created_at);
      return msgDate >= startOfDay;
    });

    // Today's blocked users
    const todayBlockedUsers = blockedUsers.filter(user => {
      const blockedDate = new Date(user.blocked_at);
      return blockedDate >= startOfDay;
    });

    // Last hour activity
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const lastHourMessages = allMessages.filter(msg => {
      const msgDate = new Date(msg.created_at);
      return msgDate >= oneHourAgo;
    });

    res.json({
      today: {
        total_messages: todayMessages.length,
        blocked_messages: todayMessages.filter(m => m.is_dispatcher).length,
        approved_messages: todayMessages.filter(m => !m.is_dispatcher).length,
        sent_messages: todayMessages.filter(m => m.is_sent_to_channel).length,
        blocked_users: todayBlockedUsers.length
      },
      last_hour: {
        total_messages: lastHourMessages.length,
        blocked_messages: lastHourMessages.filter(m => m.is_dispatcher).length,
        approved_messages: lastHourMessages.filter(m => !m.is_dispatcher).length
      },
      timestamp: now.toISOString()
    });
  } catch (error) {
    console.error('Realtime statistics error:', error);
    res.status(500).json({ error: 'Server xatolik' });
  }
});

/**
 * GET /api/statistics/bot-stats - Bot foydalanuvchilar statistikasi
 */
router.get('/bot-stats', async (req, res) => {
  try {
    const botUsers = db.get('bot_users').value() || [];
    const allMessages = db.get('messages').value() || [];

    // Count unique users who clicked "Olindi"
    const takenMessages = allMessages.filter(m => m.is_taken && m.taken_by_user_id);
    const uniqueTakers = new Set(takenMessages.map(m => m.taken_by_user_id));

    // Count total bot users (who started the bot)
    const totalBotUsers = botUsers.length;

    // Count REGISTERED users (who shared phone number)
    const registeredUsers = botUsers.filter(u => u.is_registered === true);
    const totalRegisteredUsers = registeredUsers.length;

    // Count users who clicked "Olindi" today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayTakenMessages = takenMessages.filter(m => {
      const takenDate = new Date(m.taken_at);
      return takenDate >= startOfDay;
    });
    const todayUniqueTakers = new Set(todayTakenMessages.map(m => m.taken_by_user_id));

    // Count users who started bot today
    const todayBotUsers = botUsers.filter(u => {
      const startedDate = new Date(u.started_at);
      return startedDate >= startOfDay;
    });

    // Count users who REGISTERED today (shared phone)
    const todayRegisteredUsers = registeredUsers.filter(u => {
      if (!u.registered_at) return false;
      const registeredDate = new Date(u.registered_at);
      return registeredDate >= startOfDay;
    });

    // Top 10 most active "Olindi" users
    const takerCounts = {};
    takenMessages.forEach(m => {
      const userId = m.taken_by_user_id;
      takerCounts[userId] = (takerCounts[userId] || 0) + 1;
    });

    const topTakers = Object.entries(takerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, count]) => {
        const msg = takenMessages.find(m => m.taken_by_user_id === userId);
        return {
          user_id: userId,
          username: msg?.taken_by_username || '',
          full_name: msg?.taken_by_full_name || 'Noma\'lum',
          count: count
        };
      });

    res.json({
      bot_users: {
        total: totalBotUsers,
        today: todayBotUsers.length,
        registered: totalRegisteredUsers,
        registered_today: todayRegisteredUsers.length
      },
      olindi_users: {
        total: uniqueTakers.size,
        today: todayUniqueTakers.size,
        total_taken: takenMessages.length,
        today_taken: todayTakenMessages.length
      },
      top_takers: topTakers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Bot stats error:', error);
    res.status(500).json({ error: 'Server xatolik' });
  }
});

module.exports = router;
