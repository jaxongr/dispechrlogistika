const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const DailyStatistics = require('../models/DailyStatistics');

/**
 * GET /api/daily-statistics
 * Oxirgi N kunlik statistikani olish
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30; // default: oxirgi 30 kun
    const stats = await DailyStatistics.getLastDays(limit);

    res.json({
      success: true,
      statistics: stats,
      count: stats.length
    });
  } catch (error) {
    console.error('Kunlik statistika olishda xatolik:', error);
    res.status(500).json({
      success: false,
      error: 'Kunlik statistika yuklashda xatolik'
    });
  }
});

/**
 * GET /api/daily-statistics/range
 * Ma'lum sanalar oralig'idagi statistika
 */
router.get('/range', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate va endDate parametrlari kerak'
      });
    }

    const stats = await DailyStatistics.getByDateRange(startDate, endDate);

    res.json({
      success: true,
      statistics: stats,
      count: stats.length
    });
  } catch (error) {
    console.error('Sana oralig\'i statistikasida xatolik:', error);
    res.status(500).json({
      success: false,
      error: 'Statistika yuklashda xatolik'
    });
  }
});

/**
 * GET /api/daily-statistics/total
 * Umumiy statistika (barcha kunlar bo'yicha)
 */
router.get('/total', authenticateToken, async (req, res) => {
  try {
    const totalStats = await DailyStatistics.getTotalStatistics();

    res.json({
      success: true,
      statistics: totalStats
    });
  } catch (error) {
    console.error('Umumiy statistikada xatolik:', error);
    res.status(500).json({
      success: false,
      error: 'Statistika yuklashda xatolik'
    });
  }
});

/**
 * POST /api/daily-statistics/save-now
 * Hozir statistikani saqlash (test uchun)
 */
router.post('/save-now', authenticateToken, async (req, res) => {
  try {
    const stat = await DailyStatistics.saveTodayStatistics();

    res.json({
      success: true,
      message: 'Statistika saqlandi',
      statistics: stat
    });
  } catch (error) {
    console.error('Statistika saqlashda xatolik:', error);
    res.status(500).json({
      success: false,
      error: 'Statistika saqlashda xatolik'
    });
  }
});

module.exports = router;
