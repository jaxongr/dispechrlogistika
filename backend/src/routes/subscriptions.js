/**
 * Subscription Management Routes
 * Dashboard uchun obuna va VIP boshqaruv API
 */

const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const VIPUser = require('../models/VIPUser');
const Referral = require('../models/Referral');
const User = require('../models/User');

/**
 * GET /api/subscriptions
 * Barcha obunalar ro'yxati
 */
router.get('/', async (req, res) => {
  try {
    const { is_active, plan_type, limit } = req.query;

    const filters = {};

    if (is_active !== undefined) {
      filters.is_active = is_active === 'true';
    }

    if (plan_type) {
      filters.plan_type = plan_type;
    }

    if (limit) {
      filters.limit = parseInt(limit);
    }

    const subscriptions = Subscription.findAll(filters);

    res.json({
      success: true,
      subscriptions,
      total: subscriptions.length
    });
  } catch (error) {
    console.error('GET /subscriptions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/subscriptions/statistics
 * Obuna statistikasi
 */
router.get('/statistics', async (req, res) => {
  try {
    const stats = Subscription.getStatistics();
    const vipStats = VIPUser.getStatistics();
    const referralStats = Referral.getStatistics();

    res.json({
      success: true,
      statistics: {
        subscriptions: stats,
        vip: vipStats,
        referrals: referralStats
      }
    });
  } catch (error) {
    console.error('GET /subscriptions/statistics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/subscriptions/:telegram_id
 * User obunasini ko'rish
 */
router.get('/:telegram_id', async (req, res) => {
  try {
    const { telegram_id } = req.params;

    const subscription = Subscription.findByTelegramId(telegram_id);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Obuna topilmadi'
      });
    }

    res.json({
      success: true,
      subscription
    });
  } catch (error) {
    console.error('GET /subscriptions/:telegram_id error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/subscriptions
 * Yangi obuna yaratish (admin)
 */
router.post('/', async (req, res) => {
  try {
    const { telegram_user_id, username, full_name, plan_type, payment_method, amount_paid } = req.body;

    if (!telegram_user_id || !plan_type) {
      return res.status(400).json({
        success: false,
        error: 'telegram_user_id va plan_type majburiy'
      });
    }

    const subscription = Subscription.create({
      user_id: telegram_user_id,
      telegram_user_id,
      username,
      full_name,
      plan_type,
      payment_method: payment_method || 'free',
      amount_paid: amount_paid || 0
    });

    res.json({
      success: true,
      subscription,
      message: 'Obuna yaratildi'
    });
  } catch (error) {
    console.error('POST /subscriptions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/subscriptions/:id/deactivate
 * Obunani deaktiv qilish
 */
router.put('/:id/deactivate', async (req, res) => {
  try {
    const { id } = req.params;

    const subscription = Subscription.deactivate(parseInt(id));

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Obuna topilmadi'
      });
    }

    res.json({
      success: true,
      subscription,
      message: 'Obuna deaktiv qilindi'
    });
  } catch (error) {
    console.error('PUT /subscriptions/:id/deactivate error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/subscriptions/:id/extend
 * Obuna muddatini uzaytirish
 */
router.put('/:id/extend', async (req, res) => {
  try {
    const { id } = req.params;
    const { days } = req.body;

    if (!days || days <= 0) {
      return res.status(400).json({
        success: false,
        error: 'days parametri majburiy va musbat bo\'lishi kerak'
      });
    }

    const subscription = Subscription.extend(parseInt(id), days);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Obuna topilmadi'
      });
    }

    res.json({
      success: true,
      subscription,
      message: `Obuna ${days} kunga uzaytirildi`
    });
  } catch (error) {
    console.error('PUT /subscriptions/:id/extend error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/subscriptions/vip/list
 * VIP userlar ro'yxati
 */
router.get('/vip/list', async (req, res) => {
  try {
    const { is_vip, can_earn_referral } = req.query;

    const filters = {};

    if (is_vip !== undefined) {
      filters.is_vip = is_vip === 'true';
    }

    if (can_earn_referral !== undefined) {
      filters.can_earn_referral = can_earn_referral === 'true';
    }

    const vipUsers = VIPUser.findAll(filters);

    // Get referral info for each VIP
    const vipWithStats = vipUsers.map(vip => {
      const referralCount = Referral.countByReferrer(vip.telegram_user_id);
      const totalEarnings = Referral.getTotalEarnings(vip.telegram_user_id);

      return {
        ...vip,
        referral_count: referralCount,
        total_earnings: totalEarnings
      };
    });

    res.json({
      success: true,
      vip_users: vipWithStats,
      total: vipWithStats.length,
      remaining_slots: VIPUser.getRemainingVIPSlots()
    });
  } catch (error) {
    console.error('GET /subscriptions/vip/list error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/subscriptions/vip/:telegram_id
 * VIP user ma'lumotlari
 */
router.get('/vip/:telegram_id', async (req, res) => {
  try {
    const { telegram_id } = req.params;

    const vipDetails = VIPUser.getVIPDetails(telegram_id);

    if (!vipDetails) {
      return res.status(404).json({
        success: false,
        error: 'VIP user topilmadi'
      });
    }

    res.json({
      success: true,
      vip_user: vipDetails
    });
  } catch (error) {
    console.error('GET /subscriptions/vip/:telegram_id error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/subscriptions/vip
 * VIP user yaratish (admin)
 */
router.post('/vip', async (req, res) => {
  try {
    const { telegram_user_id, username, full_name } = req.body;

    if (!telegram_user_id) {
      return res.status(400).json({
        success: false,
        error: 'telegram_user_id majburiy'
      });
    }

    // Check VIP limit
    const remainingSlots = VIPUser.getRemainingVIPSlots();

    if (remainingSlots === 0) {
      return res.status(400).json({
        success: false,
        error: 'VIP joylar to\'lgan (100/100)'
      });
    }

    const vipUser = VIPUser.create({
      telegram_user_id,
      username,
      full_name
    });

    if (!vipUser) {
      return res.status(400).json({
        success: false,
        error: 'VIP yaratib bo\'lmadi'
      });
    }

    res.json({
      success: true,
      vip_user: vipUser,
      message: `VIP yaratildi: ${vipUser.referral_code}`
    });
  } catch (error) {
    console.error('POST /subscriptions/vip error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/subscriptions/vip/:telegram_id
 * VIP statusini olib tashlash
 */
router.delete('/vip/:telegram_id', async (req, res) => {
  try {
    const { telegram_id } = req.params;

    const vipUser = VIPUser.revokeVIP(telegram_id);

    if (!vipUser) {
      return res.status(404).json({
        success: false,
        error: 'VIP user topilmadi'
      });
    }

    res.json({
      success: true,
      vip_user: vipUser,
      message: 'VIP status olib tashlandi'
    });
  } catch (error) {
    console.error('DELETE /subscriptions/vip/:telegram_id error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/subscriptions/referrals/top
 * Top referrerlar
 */
router.get('/referrals/top', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const topReferrers = Referral.getTopReferrers(parseInt(limit));

    res.json({
      success: true,
      top_referrers: topReferrers
    });
  } catch (error) {
    console.error('GET /subscriptions/referrals/top error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/subscriptions/referrals/:telegram_id
 * User referrallarini ko'rish
 */
router.get('/referrals/:telegram_id', async (req, res) => {
  try {
    const { telegram_id } = req.params;

    const referrals = Referral.findByReferrer(telegram_id);
    const totalEarnings = Referral.getTotalEarnings(telegram_id);

    res.json({
      success: true,
      referrals,
      total_referrals: referrals.length,
      total_earnings: totalEarnings
    });
  } catch (error) {
    console.error('GET /subscriptions/referrals/:telegram_id error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/subscriptions/check-expired
 * Muddati o'tgan obunalarni deaktiv qilish (cron uchun)
 */
router.post('/check-expired', async (req, res) => {
  try {
    Subscription.checkAndDeactivateExpired();

    res.json({
      success: true,
      message: 'Muddati o\'tgan obunalar tekshirildi'
    });
  } catch (error) {
    console.error('POST /subscriptions/check-expired error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
