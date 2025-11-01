/**
 * Manual Payment Routes
 * Karta orqali qabul qilingan to'lovlarni admin tasdiqlashi
 */

const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const Subscription = require('../models/Subscription');
const VIPUser = require('../models/VIPUser');
const Referral = require('../models/Referral');

/**
 * POST /api/payment-manual/request
 * User to'lov cheki yuboradi
 */
router.post('/request', async (req, res) => {
  try {
    const {
      telegram_user_id,
      username,
      full_name,
      plan_type, // 'weekly' | 'monthly'
      amount,
      payment_proof_text, // Chek matni yoki screenshot description
      referrer_code // Agar referral orqali kelgan bo'lsa
    } = req.body;

    if (!telegram_user_id || !plan_type || !amount) {
      return res.status(400).json({
        success: false,
        error: 'telegram_user_id, plan_type va amount majburiy'
      });
    }

    // Initialize pending_payments if not exists
    if (!db.has('pending_payments').value()) {
      db.set('pending_payments', []).write();
    }

    const payment = {
      id: Date.now(),
      telegram_user_id,
      username,
      full_name,
      plan_type,
      amount,
      payment_proof_text,
      referrer_code,
      status: 'pending', // 'pending' | 'approved' | 'rejected'
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.get('pending_payments').push(payment).write();

    console.log(`💳 Payment request: ${telegram_user_id} - ${plan_type} (${amount} so'm)`);

    res.json({
      success: true,
      payment,
      message: 'To\'lov so\'rovi yuborildi. Admin tasdiqlashini kuting.'
    });
  } catch (error) {
    console.error('POST /payment-manual/request error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/payment-manual/pending
 * Admin uchun - kutilayotgan to'lovlar ro'yxati
 */
router.get('/pending', async (req, res) => {
  try {
    if (!db.has('pending_payments').value()) {
      db.set('pending_payments', []).write();
    }

    const pendingPayments = db.get('pending_payments')
      .filter({ status: 'pending' })
      .orderBy('created_at', 'desc')
      .value();

    res.json({
      success: true,
      payments: pendingPayments,
      total: pendingPayments.length
    });
  } catch (error) {
    console.error('GET /payment-manual/pending error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/payment-manual/all
 * Admin uchun - barcha to'lovlar
 */
router.get('/all', async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;

    if (!db.has('pending_payments').value()) {
      db.set('pending_payments', []).write();
    }

    let payments = db.get('pending_payments').value();

    if (status) {
      payments = payments.filter(p => p.status === status);
    }

    payments = payments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    payments = payments.slice(0, parseInt(limit));

    res.json({
      success: true,
      payments,
      total: payments.length
    });
  } catch (error) {
    console.error('GET /payment-manual/all error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/payment-manual/approve/:id
 * Admin to'lovni tasdiqlaydi va obuna yaratadi
 */
router.post('/approve/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;

    const payment = db.get('pending_payments')
      .find({ id: parseInt(id) })
      .value();

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'To\'lov topilmadi'
      });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `To'lov allaqachon ${payment.status} holatida`
      });
    }

    // Create subscription based on plan type
    let subscription;

    if (payment.plan_type === 'weekly') {
      subscription = Subscription.createWeekly(
        {
          user_id: payment.telegram_user_id,
          telegram_user_id: payment.telegram_user_id,
          username: payment.username,
          full_name: payment.full_name
        },
        {
          payment_method: 'manual',
          transaction_id: `MANUAL_${payment.id}`,
          amount_paid: payment.amount
        }
      );
    } else if (payment.plan_type === 'monthly') {
      subscription = Subscription.createMonthly(
        {
          user_id: payment.telegram_user_id,
          telegram_user_id: payment.telegram_user_id,
          username: payment.username,
          full_name: payment.full_name
        },
        {
          payment_method: 'manual',
          transaction_id: `MANUAL_${payment.id}`,
          amount_paid: payment.amount
        }
      );
    } else {
      return res.status(400).json({
        success: false,
        error: 'Noto\'g\'ri plan_type'
      });
    }

    // Check if user should get VIP status
    const remainingSlots = VIPUser.getRemainingVIPSlots();
    let vipUser = null;

    if (remainingSlots > 0) {
      vipUser = VIPUser.create({
        telegram_user_id: payment.telegram_user_id,
        username: payment.username,
        full_name: payment.full_name
      });
    }

    // Process referral if exists
    if (payment.referrer_code) {
      const referrerVIP = VIPUser.findByReferralCode(payment.referrer_code);

      if (referrerVIP && referrerVIP.can_earn_referral) {
        Referral.create(referrerVIP.telegram_user_id, payment.telegram_user_id, subscription);
        console.log(`💰 Referral commission processed: ${referrerVIP.telegram_user_id} -> ${payment.telegram_user_id}`);
      }
    }

    // Update payment status
    db.get('pending_payments')
      .find({ id: parseInt(id) })
      .assign({
        status: 'approved',
        approved_at: new Date().toISOString(),
        admin_notes: admin_notes || '',
        subscription_id: subscription.id,
        updated_at: new Date().toISOString()
      })
      .write();

    console.log(`✅ Payment approved: ${payment.telegram_user_id} - ${payment.plan_type}`);

    res.json({
      success: true,
      message: 'To\'lov tasdiqlandi va obuna yaratildi',
      subscription,
      vip_user: vipUser
    });
  } catch (error) {
    console.error('POST /payment-manual/approve error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/payment-manual/reject/:id
 * Admin to'lovni rad etadi
 */
router.post('/reject/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;

    const payment = db.get('pending_payments')
      .find({ id: parseInt(id) })
      .value();

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'To\'lov topilmadi'
      });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `To'lov allaqachon ${payment.status} holatida`
      });
    }

    // Update payment status
    db.get('pending_payments')
      .find({ id: parseInt(id) })
      .assign({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        admin_notes: admin_notes || 'To\'lov rad etildi',
        updated_at: new Date().toISOString()
      })
      .write();

    console.log(`❌ Payment rejected: ${payment.telegram_user_id}`);

    res.json({
      success: true,
      message: 'To\'lov rad etildi'
    });
  } catch (error) {
    console.error('POST /payment-manual/reject error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/payment-manual/stats
 * To'lov statistikasi
 */
router.get('/stats', async (req, res) => {
  try {
    if (!db.has('pending_payments').value()) {
      db.set('pending_payments', []).write();
    }

    const allPayments = db.get('pending_payments').value();

    const stats = {
      total: allPayments.length,
      pending: allPayments.filter(p => p.status === 'pending').length,
      approved: allPayments.filter(p => p.status === 'approved').length,
      rejected: allPayments.filter(p => p.status === 'rejected').length,
      total_amount_approved: allPayments
        .filter(p => p.status === 'approved')
        .reduce((sum, p) => sum + p.amount, 0)
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('GET /payment-manual/stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
