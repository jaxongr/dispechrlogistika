const { db } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async create({ username, email, password, full_name, role_id = 3 }) {
    const password_hash = await bcrypt.hash(password, 10);

    const newUser = {
      id: Date.now(),
      username,
      email,
      password_hash,
      full_name,
      role_id,
      is_active: true,
      created_at: new Date().toISOString()
    };

    db.get('users')
      .push(newUser)
      .write();

    return newUser;
  }

  static async findByUsername(username) {
    const user = db.get('users')
      .find({ username })
      .value();

    if (!user) return null;

    // Role ma'lumotlarini qo'shish
    const role = db.get('roles')
      .find({ id: user.role_id })
      .value();

    return {
      ...user,
      role_name: role ? role.name : null,
      permissions: role ? JSON.parse(role.permissions || '{}') : {}
    };
  }

  static async findById(id) {
    const user = db.get('users')
      .find({ id: parseInt(id) })
      .value();

    if (!user) return null;

    const role = db.get('roles')
      .find({ id: user.role_id })
      .value();

    return {
      ...user,
      role_name: role ? role.name : null,
      permissions: role ? JSON.parse(role.permissions || '{}') : {}
    };
  }

  static async findAll() {
    const users = db.get('users').value();

    return users.map(user => {
      const role = db.get('roles').find({ id: user.role_id }).value();
      return {
        ...user,
        role_name: role ? role.name : null
      };
    });
  }

  static async update(id, data) {
    const user = db.get('users')
      .find({ id: parseInt(id) })
      .value();

    if (!user) return null;

    const updates = { ...data };

    if (data.password) {
      updates.password_hash = await bcrypt.hash(data.password, 10);
      delete updates.password;
    }

    updates.updated_at = new Date().toISOString();

    db.get('users')
      .find({ id: parseInt(id) })
      .assign(updates)
      .write();

    return db.get('users').find({ id: parseInt(id) }).value();
  }

  static async delete(id) {
    db.get('users')
      .remove({ id: parseInt(id) })
      .write();
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Telegram user yaratish/yangilash
   */
  static createOrUpdateTelegramUser(telegramData) {
    const { id: telegram_id, username, first_name, last_name } = telegramData;
    const full_name = [first_name, last_name].filter(Boolean).join(' ');

    // Initialize telegram_users if not exists
    if (!db.has('telegram_users').value()) {
      db.set('telegram_users', []).write();
    }

    const existingUser = db.get('telegram_users')
      .find({ telegram_id })
      .value();

    if (existingUser) {
      // Update existing
      db.get('telegram_users')
        .find({ telegram_id })
        .assign({
          username,
          full_name,
          updated_at: new Date().toISOString()
        })
        .write();

      return db.get('telegram_users').find({ telegram_id }).value();
    } else {
      // Create new
      const newUser = {
        id: Date.now(),
        telegram_id,
        username,
        full_name,
        is_vip: false,
        registration_number: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      db.get('telegram_users').push(newUser).write();
      console.log(`✅ New Telegram user: ${username} (${telegram_id})`);

      return newUser;
    }
  }

  /**
   * Telegram ID bo'yicha userni topish
   */
  static findByTelegramId(telegram_id) {
    if (!db.has('telegram_users').value()) {
      return null;
    }

    return db.get('telegram_users')
      .find({ telegram_id })
      .value();
  }

  /**
   * User VIP ekanligini tekshirish
   */
  static isVIP(telegram_id) {
    const VIPUser = require('./VIPUser');
    return VIPUser.isVIP(telegram_id);
  }

  /**
   * User obunasi aktiv ekanligini tekshirish
   */
  static hasActiveSubscription(telegram_id) {
    const Subscription = require('./Subscription');
    return Subscription.isActive(telegram_id);
  }

  /**
   * User to'liq ma'lumotlarini olish (VIP, obuna, balance bilan)
   */
  static getUserFullInfo(telegram_id) {
    const user = this.findByTelegramId(telegram_id);

    if (!user) {
      return null;
    }

    const VIPUser = require('./VIPUser');
    const Subscription = require('./Subscription');
    const Referral = require('./Referral');

    const vipInfo = VIPUser.findByTelegramId(telegram_id);
    const subscription = Subscription.findActiveByTelegramId(telegram_id);
    const referrals = vipInfo ? Referral.findByReferrer(telegram_id) : [];
    const totalEarnings = vipInfo ? Referral.getTotalEarnings(telegram_id) : 0;

    const balance = db.has('user_balances').value()
      ? db.get('user_balances').find({ telegram_user_id: telegram_id }).value()
      : null;

    return {
      ...user,
      is_vip: !!vipInfo,
      vip_info: vipInfo,
      subscription: subscription,
      has_active_subscription: !!subscription,
      referral_count: referrals.length,
      total_earnings: totalEarnings,
      current_balance: balance ? balance.balance : 0
    };
  }

  /**
   * User grandfather ekanligini tekshirish (02.11.2025 18:00 gacha ro'yxatdan o'tgan)
   */
  static isGrandfathered(telegram_id) {
    const user = this.findByTelegramId(telegram_id);

    if (!user) {
      return false;
    }

    const grandfatherDeadline = new Date('2025-11-02T18:00:00+05:00'); // Toshkent vaqti
    const userCreatedAt = new Date(user.created_at);

    return userCreatedAt < grandfatherDeadline;
  }
}

module.exports = User;
