const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticate } = require('../middlewares/auth');

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/bot-orders - Barcha bot buyurtmalarini olish
 */
router.get('/', async (req, res) => {
  try {
    const botOrders = db.get('bot_orders').value() || [];

    // Sort by created date (newest first)
    botOrders.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateB - dateA;
    });

    res.json({
      success: true,
      orders: botOrders,
      count: botOrders.length
    });

  } catch (error) {
    console.error('Get bot orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Server xatolik'
    });
  }
});

/**
 * GET /api/bot-orders/statistics - Buyurtma statistikasi
 */
router.get('/statistics', async (req, res) => {
  try {
    const botOrders = db.get('bot_orders').value() || [];

    const stats = {
      total: botOrders.length,
      pending: botOrders.filter(o => o.status === 'pending').length,
      taken: botOrders.filter(o => o.status === 'taken').length,
      posted_to_group: botOrders.filter(o => o.status === 'posted_to_group').length,
      today: 0,
      this_week: 0,
      this_month: 0
    };

    // Calculate time-based stats
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    botOrders.forEach(order => {
      const createdAt = new Date(order.created_at);

      if (createdAt >= todayStart) stats.today++;
      if (createdAt >= weekStart) stats.this_week++;
      if (createdAt >= monthStart) stats.this_month++;
    });

    res.json({
      success: true,
      statistics: stats
    });

  } catch (error) {
    console.error('Get bot orders statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Server xatolik'
    });
  }
});

/**
 * GET /api/bot-orders/daily-stats - Kunlik statistika (arxiv)
 */
router.get('/daily-stats', async (req, res) => {
  try {
    const { limit = 30 } = req.query;

    // Get daily stats from database
    let dailyStats = db.get('bot_order_daily_stats').value() || [];

    // Sort by date (newest first)
    dailyStats.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Apply limit
    if (limit) {
      dailyStats = dailyStats.slice(0, parseInt(limit));
    }

    res.json({
      success: true,
      statistics: dailyStats,
      count: dailyStats.length
    });

  } catch (error) {
    console.error('Get daily stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server xatolik'
    });
  }
});

/**
 * POST /api/bot-orders/save-daily-stats - Kunlik statistikani saqlash (manual)
 * Bu endpoint admin tomonidan qo'lda chaqirilishi mumkin
 */
router.post('/save-daily-stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Check if today's stats already exist
    const existingStat = db.get('bot_order_daily_stats')
      .find({ date: todayStr })
      .value();

    if (existingStat) {
      return res.status(400).json({
        success: false,
        error: 'Bugungi statistika allaqachon saqlangan'
      });
    }

    // Get all orders
    const botOrders = db.get('bot_orders').value() || [];

    // Calculate today's stats
    const todayStart = new Date(today);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const todayOrders = botOrders.filter(order => {
      const createdAt = new Date(order.created_at);
      return createdAt >= todayStart && createdAt <= todayEnd;
    });

    const stats = {
      date: todayStr,
      total_orders: todayOrders.length,
      taken_orders: todayOrders.filter(o => o.status === 'taken').length,
      posted_to_group: todayOrders.filter(o => o.status === 'posted_to_group').length,
      pending_orders: todayOrders.filter(o => o.status === 'pending').length,
      created_at: new Date().toISOString()
    };

    // Save to database
    db.get('bot_order_daily_stats')
      .push(stats)
      .write();

    res.json({
      success: true,
      message: 'Kunlik statistika saqlandi',
      stats
    });

  } catch (error) {
    console.error('Save daily stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server xatolik'
    });
  }
});

/**
 * GET /api/bot-orders/:id - Bitta buyurtma ma'lumoti
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const order = db.get('bot_orders')
      .find({ id })
      .value();

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Buyurtma topilmadi'
      });
    }

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error('Get bot order error:', error);
    res.status(500).json({
      success: false,
      error: 'Server xatolik'
    });
  }
});

module.exports = router;
