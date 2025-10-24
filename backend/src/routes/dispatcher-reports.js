const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const DispatcherReport = require('../models/DispatcherReport');

/**
 * GET /api/dispatcher-reports/statistics
 * Get statistics about who blocked what
 */
router.get('/statistics', authenticate, async (req, res) => {
  try {
    const stats = await DispatcherReport.getStatistics();
    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('Get dispatcher reports statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Server xatolik'
    });
  }
});

/**
 * GET /api/dispatcher-reports/recent
 * Get recent reports
 */
router.get('/recent', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const reports = await DispatcherReport.getRecent(limit);

    res.json({
      success: true,
      reports
    });
  } catch (error) {
    console.error('Get recent reports error:', error);
    res.status(500).json({
      success: false,
      error: 'Server xatolik'
    });
  }
});

/**
 * GET /api/dispatcher-reports/by-user/:userId
 * Get reports by specific user
 */
router.get('/by-user/:userId', authenticate, async (req, res) => {
  try {
    const userId = req.params.userId;
    const reports = await DispatcherReport.getReportsByUser(userId);

    res.json({
      success: true,
      reports
    });
  } catch (error) {
    console.error('Get reports by user error:', error);
    res.status(500).json({
      success: false,
      error: 'Server xatolik'
    });
  }
});

/**
 * GET /api/dispatcher-reports/today
 * Get today's reports
 */
router.get('/today', authenticate, async (req, res) => {
  try {
    const reports = await DispatcherReport.getTodayReports();

    res.json({
      success: true,
      reports,
      count: reports.length
    });
  } catch (error) {
    console.error('Get today reports error:', error);
    res.status(500).json({
      success: false,
      error: 'Server xatolik'
    });
  }
});

module.exports = router;
