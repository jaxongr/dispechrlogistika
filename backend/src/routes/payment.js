/**
 * Payment Routes
 * Click va Payme to'lov integratsiyasi
 */

const express = require('express');
const router = express.Router();
const paymentHandler = require('../services/payment-handler');

/**
 * POST /api/payment/click/prepare
 * Click.uz - Prepare endpoint
 */
router.post('/click/prepare', async (req, res) => {
  try {
    console.log('📥 Click prepare:', req.body);

    const result = await paymentHandler.clickPrepare(req.body);

    res.json(result);
  } catch (error) {
    console.error('Click prepare error:', error);
    res.json({
      error: -8,
      error_note: 'System error'
    });
  }
});

/**
 * POST /api/payment/click/complete
 * Click.uz - Complete endpoint
 */
router.post('/click/complete', async (req, res) => {
  try {
    console.log('📥 Click complete:', req.body);

    const result = await paymentHandler.clickComplete(req.body);

    res.json(result);
  } catch (error) {
    console.error('Click complete error:', error);
    res.json({
      error: -8,
      error_note: 'System error'
    });
  }
});

/**
 * POST /api/payment/payme
 * Payme - Main endpoint (JSON-RPC)
 */
router.post('/payme', async (req, res) => {
  try {
    console.log('📥 Payme request:', req.body);

    const { method, params } = req.body;

    let result;

    switch (method) {
      case 'CheckPerformTransaction':
        result = await paymentHandler.paymeCheckPerformTransaction(params);
        break;

      case 'CreateTransaction':
        result = await paymentHandler.paymeCreateTransaction(params);
        break;

      case 'PerformTransaction':
        result = await paymentHandler.paymePerformTransaction(params);
        break;

      case 'CheckTransaction':
        // TODO: Implement if needed
        result = {
          error: {
            code: -32601,
            message: 'Method not found'
          }
        };
        break;

      case 'CancelTransaction':
        // TODO: Implement if needed
        result = {
          error: {
            code: -32601,
            message: 'Method not found'
          }
        };
        break;

      default:
        result = {
          error: {
            code: -32601,
            message: 'Method not found'
          }
        };
    }

    res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      ...result
    });
  } catch (error) {
    console.error('Payme error:', error);
    res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      error: {
        code: -32400,
        message: 'System error'
      }
    });
  }
});

/**
 * GET /api/payment/link/click
 * Generate Click payment link
 */
router.get('/link/click', (req, res) => {
  try {
    const { telegram_user_id, plan_type, referrer_code } = req.query;

    if (!telegram_user_id || !plan_type) {
      return res.status(400).json({
        success: false,
        error: 'telegram_user_id va plan_type majburiy'
      });
    }

    const link = paymentHandler.generateClickLink(
      telegram_user_id,
      plan_type,
      referrer_code
    );

    res.json({
      success: true,
      payment_url: link,
      plan: paymentHandler.PLANS[plan_type]
    });
  } catch (error) {
    console.error('Generate Click link error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/payment/link/payme
 * Generate Payme payment link
 */
router.get('/link/payme', (req, res) => {
  try {
    const { telegram_user_id, plan_type, referrer_code } = req.query;

    if (!telegram_user_id || !plan_type) {
      return res.status(400).json({
        success: false,
        error: 'telegram_user_id va plan_type majburiy'
      });
    }

    const link = paymentHandler.generatePaymeLink(
      telegram_user_id,
      plan_type,
      referrer_code
    );

    res.json({
      success: true,
      payment_url: link,
      plan: paymentHandler.PLANS[plan_type]
    });
  } catch (error) {
    console.error('Generate Payme link error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/payment/plans
 * Get available plans
 */
router.get('/plans', (req, res) => {
  res.json({
    success: true,
    plans: paymentHandler.PLANS
  });
});

module.exports = router;
