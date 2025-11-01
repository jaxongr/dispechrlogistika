/**
 * VIP User Model - LowDB (JSON) version
 * VIP foydalanuvchilar - birinchi 100 ta obunachi (referral income ola oladilar)
 */

const { db } = require('../config/database');

class VIPUser {
  /**
   * Yangi VIP user yaratish
   * FAQAT birinchi 100 ta obunachi VIP bo'lishi mumkin!
   */
  static create(userData) {
    // Initialize vip_users if not exists
    if (!db.has('vip_users').value()) {
      db.set('vip_users', []).write();
    }

    // Check if already VIP
    const existingVIP = db.get('vip_users')
      .find({ telegram_user_id: userData.telegram_user_id })
      .value();

    if (existingVIP) {
      console.log(`⚠️ User already VIP: ${userData.telegram_user_id}`);
      return existingVIP;
    }

    // Check VIP limit (100 only!)
    const currentVIPCount = db.get('vip_users').value().length;

    if (currentVIPCount >= 100) {
      console.log(`🚫 VIP limit reached: ${currentVIPCount}/100 - Cannot create more VIP users`);
      return null;
    }

    const registrationNumber = currentVIPCount + 1;
    const referralCode = `VIP${registrationNumber}`;

    const vipUser = {
      id: Date.now(),
      telegram_user_id: userData.telegram_user_id,
      username: userData.username,
      full_name: userData.full_name,
      registration_number: registrationNumber, // 1-100
      referral_code: referralCode, // VIP1, VIP2, ... VIP100
      is_vip: true,
      can_earn_referral: true,
      vip_granted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.get('vip_users').push(vipUser).write();
    console.log(`🌟 VIP User created: ${referralCode} - ${userData.full_name} (${registrationNumber}/100)`);

    return vipUser;
  }

  /**
   * Telegram ID bo'yicha VIP userni topish
   */
  static findByTelegramId(telegram_user_id) {
    if (!db.has('vip_users').value()) {
      return null;
    }

    return db.get('vip_users')
      .find({ telegram_user_id })
      .value();
  }

  /**
   * Referral code bo'yicha VIP userni topish
   */
  static findByReferralCode(referralCode) {
    if (!db.has('vip_users').value()) {
      return null;
    }

    return db.get('vip_users')
      .find({ referral_code: referralCode })
      .value();
  }

  /**
   * User VIP ekanligini tekshirish
   */
  static isVIP(telegram_user_id) {
    if (!db.has('vip_users').value()) {
      return false;
    }

    const vipUser = db.get('vip_users')
      .find({ telegram_user_id, is_vip: true })
      .value();

    return !!vipUser;
  }

  /**
   * User referral income ola oladimi tekshirish
   */
  static canEarnReferral(telegram_user_id) {
    if (!db.has('vip_users').value()) {
      return false;
    }

    const vipUser = db.get('vip_users')
      .find({ telegram_user_id })
      .value();

    return vipUser && vipUser.can_earn_referral === true;
  }

  /**
   * VIP userlarning umumiy sonini olish
   */
  static getVIPCount() {
    if (!db.has('vip_users').value()) {
      return 0;
    }

    return db.get('vip_users')
      .filter({ is_vip: true })
      .value()
      .length;
  }

  /**
   * Hali qancha VIP joy qolganligini bilish
   */
  static getRemainingVIPSlots() {
    const currentCount = this.getVIPCount();
    return Math.max(0, 100 - currentCount);
  }

  /**
   * Barcha VIP userlarni olish
   */
  static findAll(filters = {}) {
    if (!db.has('vip_users').value()) {
      return [];
    }

    let vips = db.get('vip_users').value();

    // Apply filters
    if (filters.is_vip !== undefined) {
      vips = vips.filter(vip => vip.is_vip === filters.is_vip);
    }

    if (filters.can_earn_referral !== undefined) {
      vips = vips.filter(vip => vip.can_earn_referral === filters.can_earn_referral);
    }

    // Sort by registration number
    vips = vips.sort((a, b) => a.registration_number - b.registration_number);

    return vips;
  }

  /**
   * VIP statusini o'chirish (admin action)
   */
  static revokeVIP(telegram_user_id) {
    if (!db.has('vip_users').value()) {
      return null;
    }

    const vipUser = db.get('vip_users')
      .find({ telegram_user_id })
      .value();

    if (!vipUser) {
      return null;
    }

    db.get('vip_users')
      .find({ telegram_user_id })
      .assign({
        is_vip: false,
        can_earn_referral: false,
        updated_at: new Date().toISOString()
      })
      .write();

    console.log(`🚫 VIP status revoked: ${telegram_user_id}`);
    return db.get('vip_users').find({ telegram_user_id }).value();
  }

  /**
   * VIP statistikasi
   */
  static getStatistics() {
    if (!db.has('vip_users').value()) {
      return {
        total_vip: 0,
        active_vip: 0,
        remaining_slots: 100
      };
    }

    const vips = db.get('vip_users').value();

    return {
      total_vip: vips.length,
      active_vip: vips.filter(v => v.is_vip && v.can_earn_referral).length,
      remaining_slots: Math.max(0, 100 - vips.length)
    };
  }

  /**
   * VIP user ma'lumotlarini olish (referrallar bilan)
   */
  static getVIPDetails(telegram_user_id) {
    const vipUser = this.findByTelegramId(telegram_user_id);

    if (!vipUser) {
      return null;
    }

    // Get referrals
    const Referral = require('./Referral');
    const referrals = Referral.findByReferrer(telegram_user_id);
    const totalEarnings = Referral.getTotalEarnings(telegram_user_id);

    // Get balance
    const balance = db.has('user_balances').value()
      ? db.get('user_balances').find({ telegram_user_id }).value()
      : null;

    return {
      ...vipUser,
      total_referrals: referrals.length,
      total_earnings: totalEarnings,
      current_balance: balance ? balance.balance : 0,
      referrals: referrals
    };
  }

  /**
   * Registration number bo'yicha VIP userni topish
   */
  static findByRegistrationNumber(registrationNumber) {
    if (!db.has('vip_users').value()) {
      return null;
    }

    return db.get('vip_users')
      .find({ registration_number: registrationNumber })
      .value();
  }
}

module.exports = VIPUser;
