const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticate, checkPermission } = require('../middlewares/auth');

// Barcha routelar authenticated bo'lishi kerak
router.use(authenticate);

// GET routes
router.get('/', messageController.getAll);
router.get('/statistics', messageController.getStatistics);
router.get('/blocked-users', messageController.getBlockedUsers);
router.get('/phone-numbers', messageController.getPhoneNumbers);
router.get('/:id', messageController.getOne);

// POST routes
router.post('/:id/approve', checkPermission('approve_messages'), messageController.approve);
router.post('/:id/send', checkPermission('approve_messages'), messageController.sendToChannel);
router.post('/send-bulk', checkPermission('approve_messages'), messageController.sendBulkToChannel);
router.post('/:id/block-sender', checkPermission('block_users'), messageController.blockSender);
router.post('/:id/reanalyze', messageController.reanalyze);

// DELETE routes
router.delete('/:id', checkPermission('approve_messages'), messageController.delete);

module.exports = router;
