const express = require('express');
const router = express.Router();
const autoReplyController = require('../controllers/autoReplyController');
const { authenticate } = require('../middlewares/auth');

// All routes require authentication
router.use(authenticate);

// Auto-reply settings
router.get('/settings', autoReplyController.getSettings);
router.put('/settings', autoReplyController.updateSettings);

// Auto-reply history
router.get('/history', autoReplyController.getHistory);

// Statistics
router.get('/statistics', autoReplyController.getStatistics);

module.exports = router;
