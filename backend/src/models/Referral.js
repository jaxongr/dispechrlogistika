/**
 * Referral Model - LowDB (JSON) version
 * Referral tizimi - VIP userlar tomonidan olib kelingan yangi obunachilar
 */

const { db } = require('../config/database');

class Referral {
  /**
   * Yangi referral yaratish
   * @param {string} referrer_telegram_id - VIP user (taklif qiluvchi)
   * @param {string} referred_telegram_id - Yangi user (taklif qilingan)
   * @param {object} subscriptionData - Yangi user obuna ma'lumotlari
   */
  static create(referrer_telegram_id, referred_telegram_id, subscriptionData) {
    // Initialize referrals if not exists
    if (!db.has('referrals').value()) {
      db.set('referrals', []).write();
    }

    // Check if already exists
    const existing = db.get('referrals')
      .find({
        referrer_telegram_id,
        referred_telegram_id
      })
      .value();

    if (existing) {
      console.log(`⚠️ Referral already exists: ${referrer_telegram_id} -> ${referred_telegram_id}`);
      return existing;
    }

    // Calculate commission (50% of subscription amount)
    const commission = (subscriptionData.amount_paid || 0) * 0.5;

    const referral = {
      id: Date.now(),
      referrer_telegram_id,
      referred_telegram_id,
      referred_username: subscriptionData.username,
      referred_full_name: subscriptionData.full_name,
      subscription_id: subscriptionData.id,
      subscription_type: subscriptionData.plan_type,
      subscription_amount: subscriptionData.amount_paid,
      commission_amount: commission,
      commission_paid: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.get('referrals').push(referral).write();
    console.log(`✅ Referral created: VIP ${referrer_telegram_id} -> ${referred_telegram_id} (${commission} UZS)`);

    // Update referrer's balance
    this.updateReferrerBalance(referrer_telegram_id, commission);

    return referral;
  }

  /**
   * VIP userning barcha referrallarini olish
   */
  static findByReferrer(referrer_telegram_id) {
    if (!db.has('referrals').value()) {
      return [];
    }

    return db.get('referrals')
      .filter({ referrer_telegram_id })
      .orderBy('created_at', 'desc')
      .value();
  }

  /**
   * User referral orqali kelgan ekanligini tekshirish
   */
  static findByReferred(referred_telegram_id) {
    if (!db.has('referrals').value()) {
      return null;
    }

    return db.get('referrals')
      .find({ referred_telegram_id })
      .value();
  }

  /**
   * VIP userning jami referral sonini olish
   */
  static countByReferrer(referrer_telegram_id) {
    if (!db.has('referrals').value()) {
      return 0;
    }

    return db.get('referrals')
      .filter({ referrer_telegram_id })
      .value()
      .length;
  }

  /**
   * VIP userning jami ishlab topgan summani hisoblash
   */
  static getTotalEarnings(referrer_telegram_id) {
    if (!db.has('referrals').value()) {
      return 0;
    }

    return db.get('referrals')
      .filter({ referrer_telegram_id })
      .value()
      .reduce((sum, ref) => sum + ref.commission_amount, 0);
  }

  /**
   * Referrer balansini yangilash
   */
  static updateReferrerBalance(referrer_telegram_id, commission) {
    // Initialize user_balances if not exists
    if (!db.has('user_balances').value()) {
      db.set('user_balances', []).write();
    }

    const existingBalance = db.get('user_balances')
      .find({ telegram_user_id: referrer_telegram_id })
      .value();

    if (existingBalance) {
      // Update existing balance
      db.get('user_balances')
        .find({ telegram_user_id: referrer_telegram_id })
        .assign({
          balance: existingBalance.balance + commission,
          total_earned: existingBalance.total_earned + commission,
          updated_at: new Date().toISOString()
        })
        .write();

      console.log(`💰 Balance updated: ${referrer_telegram_id} +${commission} UZS (Total: ${existingBalance.balance + commission} UZS)`);
    } else {
      // Create new balance
      db.get('user_balances')
        .push({
          id: Date.now(),
          telegram_user_id: referrer_telegram_id,
          balance: commission,
          total_earned: commission,
          total_withdrawn: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .write();

      console.log(`💰 Balance created: ${referrer_telegram_id} = ${commission} UZS`);
    }
  }

  /**
   * Referral statistikasi
   */
  static getStatistics() {
    if (!db.has('referrals').value()) {
      return {
        total_referrals: 0,
        total_commission: 0,
        total_commission_paid: 0,
        total_commission_unpaid: 0
      };
    }

    const allReferrals = db.get('referrals').value();

    return {
      total_referrals: allReferrals.length,
      total_commission: allReferrals.reduce((sum, ref) => sum + ref.commission_amount, 0),
      total_commission_paid: allReferrals
        .filter(ref => ref.commission_paid)
        .reduce((sum, ref) => sum + ref.commission_amount, 0),
      total_commission_unpaid: allReferrals
        .filter(ref => !ref.commission_paid)
        .reduce((sum, ref) => sum + ref.commission_amount, 0)
    };
  }

  /**
   * Top referrerlar ro'yxati
   */
  static getTopReferrers(limit = 10) {
    if (!db.has('referrals').value()) {
      return [];
    }

    const referrals = db.get('referrals').value();
    const referrerStats = {};

    referrals.forEach(ref => {
      if (!referrerStats[ref.referrer_telegram_id]) {
        referrerStats[ref.referrer_telegram_id] = {
          telegram_id: ref.referrer_telegram_id,
          total_referrals: 0,
          total_earnings: 0
        };
      }
      referrerStats[ref.referrer_telegram_id].total_referrals++;
      referrerStats[ref.referrer_telegram_id].total_earnings += ref.commission_amount;
    });

    return Object.values(referrerStats)
      .sort((a, b) => b.total_earnings - a.total_earnings)
      .slice(0, limit);
  }

  /**
   * Commission to'langanligini belgilash
   */
  static markCommissionPaid(referral_id) {
    if (!db.has('referrals').value()) {
      return null;
    }

    const referral = db.get('referrals')
      .find({ id: referral_id })
      .value();

    if (!referral) {
      return null;
    }

    db.get('referrals')
      .find({ id: referral_id })
      .assign({
        commission_paid: true,
        updated_at: new Date().toISOString()
      })
      .write();

    console.log(`✅ Commission marked as paid: ${referral_id}`);
    return db.get('referrals').find({ id: referral_id }).value();
  }
}

module.exports = Referral;
