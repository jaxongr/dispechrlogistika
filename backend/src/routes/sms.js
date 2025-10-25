const express = require('express');
const router = express.Router();
const smsController = require('../controllers/smsController');
const { authenticate } = require('../middlewares/auth');

// Barcha routelar authenticated bo'lishi kerak
router.use(authenticate);

// SMS settings
router.get('/settings', smsController.getSettings);
router.put('/settings', smsController.updateSettings);

// SemySMS devices
router.get('/devices', smsController.getDevices);

// Account info
router.get('/account', smsController.getAccountInfo);

// Send test SMS
router.post('/test', smsController.sendTestSMS);

// SMS history
router.get('/history', smsController.getHistory);

module.exports = router;
