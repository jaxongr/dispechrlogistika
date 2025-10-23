const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');

// Public routes
router.post('/login', authController.login);

// Protected routes
router.get('/me', authenticate, authController.me);
router.post('/change-password', authenticate, authController.changePassword);

// Admin only
router.post('/register', authenticate, authController.register);

module.exports = router;
