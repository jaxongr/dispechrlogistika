/**
 * Payment Settings Routes
 * Karta raqami va obuna narxlarini boshqarish
 */

const express = require('express');
const router = express.Router();
const { db } = require('../config/database');

/**
 * GET /api/payment-settings
 * Joriy sozlamalarni olish
 */
router.get('/', async (req, res) => {
  try {
    // Initialize payment_settings if not exists
    if (!db.has('payment_settings').value()) {
      db.set('payment_settings', {
        card_number: '',
        card_holder_name: '',
        weekly_price: 30000,
        monthly_price: 70000,
        payment_instructions: 'Karta raqamiga to\'lov qiling va chekni bot orqali yuboring.',
        updated_at: new Date().toISOString()
      }).write();
    }

    const settings = db.get('payment_settings').value();

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('GET /payment-settings error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/payment-settings
 * Sozlamalarni yangilash
 */
router.put('/', async (req, res) => {
  try {
    const {
      card_number,
      card_holder_name,
      weekly_price,
      monthly_price,
      payment_instructions
    } = req.body;

    // Initialize if not exists
    if (!db.has('payment_settings').value()) {
      db.set('payment_settings', {}).write();
    }

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (card_number !== undefined) updates.card_number = card_number;
    if (card_holder_name !== undefined) updates.card_holder_name = card_holder_name;
    if (weekly_price !== undefined) updates.weekly_price = parseInt(weekly_price);
    if (monthly_price !== undefined) updates.monthly_price = parseInt(monthly_price);
    if (payment_instructions !== undefined) updates.payment_instructions = payment_instructions;

    db.set('payment_settings', {
      ...db.get('payment_settings').value(),
      ...updates
    }).write();

    console.log('✅ Payment settings updated');

    res.json({
      success: true,
      settings: db.get('payment_settings').value(),
      message: 'Sozlamalar saqlandi'
    });
  } catch (error) {
    console.error('PUT /payment-settings error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/payment-settings/card-info
 * Public endpoint - karta ma'lumotlarini olish (user uchun)
 */
router.get('/card-info', async (req, res) => {
  try {
    if (!db.has('payment_settings').value()) {
      return res.json({
        success: true,
        card_info: {
          card_number: 'Karta raqam belgilanmagan',
          card_holder_name: '',
          weekly_price: 30000,
          monthly_price: 70000,
          payment_instructions: 'Karta raqamiga to\'lov qiling va chekni bot orqali yuboring.'
        }
      });
    }

    const settings = db.get('payment_settings').value();

    res.json({
      success: true,
      card_info: {
        card_number: settings.card_number || 'Karta raqam belgilanmagan',
        card_holder_name: settings.card_holder_name || '',
        weekly_price: settings.weekly_price || 30000,
        monthly_price: settings.monthly_price || 70000,
        payment_instructions: settings.payment_instructions || ''
      }
    });
  } catch (error) {
    console.error('GET /payment-settings/card-info error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
