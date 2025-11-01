/**
 * Subscription Model - LowDB (JSON) version
 * Obuna tizimi - foydalanuvchi obunalari
 */

const { db } = require('../config/database');

class Subscription {
  /**
   * Yangi obuna yaratish
   */
  static create(data) {
    const startDate = new Date();
    let endDate = new Date(startDate);

    // Calculate end date
    switch (data.plan_type) {
      case 'trial':
        endDate.setDate(endDate.getDate() + 1); // 1 kun
        break;
      case 'weekly':
        endDate.setDate(endDate.getDate() + 7); // 7 kun
        break;
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1); // 1 oy
        break;
      case 'grandfather':
        endDate = new Date('2099-12-31T23:59:59.999Z'); // Cheksiz
        break;
    }

    const subscription = {
      id: Date.now(),
      user_id: data.user_id,
      telegram_user_id: data.telegram_user_id,
      username: data.username,
      full_name: data.full_name,
      plan_type: data.plan_type, // 'trial' | 'weekly' | 'monthly' | 'grandfather'
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      is_active: true,
      auto_renew: data.auto_renew || false,
      payment_method: data.payment_method || 'free', // 'click' | 'payme' | 'balance' | 'free'
      transaction_id: data.transaction_id || null,
      amount_paid: data.amount_paid || 0,
      currency: data.currency || 'UZS',
      created_at: startDate.toISOString(),
      updated_at: startDate.toISOString()
    };

    // Initialize subscriptions if not exists
    if (!db.has('subscriptions').value()) {
      db.set('subscriptions', []).write();
    }

    db.get('subscriptions').push(subscription).write();
    console.log(`✅ Subscription created: User ${data.user_id} - ${data.plan_type}`);
    return subscription;
  }

  /**
   * Telegram ID bo'yicha oxirgi obunani topish
   */
  static findByTelegramId(telegram_user_id) {
    if (!db.has('subscriptions').value()) {
      return null;
    }

    return db.get('subscriptions')
      .filter({ telegram_user_id })
      .orderBy('created_at', 'desc')
      .first()
      .value();
  }

  /**
   * Telegram ID bo'yicha aktiv obunani topish
   */
  static findActiveByTelegramId(telegram_user_id) {
    if (!db.has('subscriptions').value()) {
      return null;
    }

    const now = new Date().toISOString();

    return db.get('subscriptions')
      .filter(sub =>
        sub.telegram_user_id === telegram_user_id &&
        sub.is_active === true &&
        sub.end_date > now
      )
      .orderBy('created_at', 'desc')
      .first()
      .value();
  }

  /**
   * Foydalanuvchi obunasi aktiv ekanligini tekshirish
   */
  static isActive(telegram_user_id) {
    if (!db.has('subscriptions').value()) {
      return false;
    }

    const now = new Date().toISOString();

    const activeSub = db.get('subscriptions')
      .filter(sub =>
        sub.telegram_user_id === telegram_user_id &&
        sub.is_active === true &&
        sub.end_date > now
      )
      .value();

    return activeSub.length > 0;
  }

  /**
   * Barcha obunalarni olish (filtr bilan)
   */
  static findAll(filters = {}) {
    if (!db.has('subscriptions').value()) {
      return [];
    }

    let subs = db.get('subscriptions').value();
    const now = new Date().toISOString();

    // Apply filters
    if (filters.is_active !== undefined) {
      if (filters.is_active) {
        subs = subs.filter(sub => sub.is_active && sub.end_date > now);
      } else {
        subs = subs.filter(sub => !sub.is_active || sub.end_date <= now);
      }
    }

    if (filters.plan_type) {
      subs = subs.filter(sub => sub.plan_type === filters.plan_type);
    }

    // Sort by created_at desc
    subs = subs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Apply limit
    if (filters.limit) {
      subs = subs.slice(0, filters.limit);
    }

    return subs;
  }

  /**
   * Obunani deaktiv qilish
   */
  static deactivate(id) {
    if (!db.has('subscriptions').value()) {
      return null;
    }

    const sub = db.get('subscriptions')
      .find({ id })
      .value();

    if (!sub) {
      return null;
    }

    db.get('subscriptions')
      .find({ id })
      .assign({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .write();

    console.log(`🚫 Subscription deactivated: ${id}`);
    return db.get('subscriptions').find({ id }).value();
  }

  /**
   * Obuna muddatini uzaytirish
   */
  static extend(id, days) {
    if (!db.has('subscriptions').value()) {
      return null;
    }

    const sub = db.get('subscriptions')
      .find({ id })
      .value();

    if (!sub) {
      return null;
    }

    const currentEndDate = new Date(sub.end_date);
    currentEndDate.setDate(currentEndDate.getDate() + days);

    db.get('subscriptions')
      .find({ id })
      .assign({
        end_date: currentEndDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .write();

    console.log(`📅 Subscription extended: ${id} (+${days} days)`);
    return db.get('subscriptions').find({ id }).value();
  }

  /**
   * Muddati o'tgan obunalarni deaktiv qilish
   */
  static checkAndDeactivateExpired() {
    if (!db.has('subscriptions').value()) {
      return;
    }

    const now = new Date().toISOString();
    const expiredSubs = db.get('subscriptions')
      .filter(sub => sub.is_active && sub.end_date < now)
      .value();

    expiredSubs.forEach(sub => {
      db.get('subscriptions')
        .find({ id: sub.id })
        .assign({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .write();
    });

    if (expiredSubs.length > 0) {
      console.log(`🚫 Deactivated ${expiredSubs.length} expired subscriptions`);
    }
  }

  /**
   * Statistika
   */
  static getStatistics() {
    if (!db.has('subscriptions').value()) {
      return {
        total_subscriptions: 0,
        active_subscriptions: 0,
        trial_count: 0,
        weekly_count: 0,
        monthly_count: 0,
        grandfather_count: 0,
        revenue_30days: 0
      };
    }

    const now = new Date().toISOString();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const allSubs = db.get('subscriptions').value();

    const stats = {
      total_subscriptions: allSubs.length,
      active_subscriptions: allSubs.filter(sub => sub.is_active && sub.end_date > now).length,
      trial_count: allSubs.filter(sub => sub.plan_type === 'trial').length,
      weekly_count: allSubs.filter(sub => sub.plan_type === 'weekly').length,
      monthly_count: allSubs.filter(sub => sub.plan_type === 'monthly').length,
      grandfather_count: allSubs.filter(sub => sub.plan_type === 'grandfather').length,
      revenue_30days: allSubs
        .filter(sub => new Date(sub.created_at) > thirtyDaysAgo)
        .reduce((sum, sub) => sum + (sub.amount_paid || 0), 0)
    };

    return stats;
  }

  /**
   * Grandfather obuna yaratish (02.11.2025 18:00 gacha ro'yxatdan o'tganlar uchun)
   */
  static createGrandfather(userData) {
    return this.create({
      user_id: userData.user_id,
      telegram_user_id: userData.telegram_user_id,
      username: userData.username,
      full_name: userData.full_name,
      plan_type: 'grandfather',
      payment_method: 'free',
      amount_paid: 0
    });
  }

  /**
   * Trial obuna yaratish (1 kun bepul)
   */
  static createTrial(userData) {
    return this.create({
      user_id: userData.user_id,
      telegram_user_id: userData.telegram_user_id,
      username: userData.username,
      full_name: userData.full_name,
      plan_type: 'trial',
      payment_method: 'free',
      amount_paid: 0
    });
  }

  /**
   * Haftalik obuna (30,000 UZS)
   */
  static createWeekly(userData, paymentData) {
    return this.create({
      user_id: userData.user_id,
      telegram_user_id: userData.telegram_user_id,
      username: userData.username,
      full_name: userData.full_name,
      plan_type: 'weekly',
      payment_method: paymentData.payment_method, // 'click' | 'payme' | 'balance'
      transaction_id: paymentData.transaction_id,
      amount_paid: 30000,
      currency: 'UZS'
    });
  }

  /**
   * Oylik obuna (70,000 UZS)
   */
  static createMonthly(userData, paymentData) {
    return this.create({
      user_id: userData.user_id,
      telegram_user_id: userData.telegram_user_id,
      username: userData.username,
      full_name: userData.full_name,
      plan_type: 'monthly',
      payment_method: paymentData.payment_method,
      transaction_id: paymentData.transaction_id,
      amount_paid: 70000,
      currency: 'UZS'
    });
  }
}

module.exports = Subscription;
