const { db } = require('../config/database');

/**
 * Whitelist Model
 * Admin tomonidan tasdiqlangan yuk egalari
 * Bu userlar hech qachon bloklanmaydi
 */
class Whitelist {
  /**
   * Whitelistga qo'shish
   */
  static async add({
    telegram_user_id,
    username,
    full_name,
    phone_number,
    reason,
    added_by
  }) {
    // Avval tekshiramiz - bormi?
    const existing = db.get('whitelist')
      .find({ telegram_user_id: telegram_user_id.toString() })
      .value();

    if (existing) {
      // Update qilamiz
      db.get('whitelist')
        .find({ telegram_user_id: telegram_user_id.toString() })
        .assign({
          username: username || existing.username,
          full_name: full_name || existing.full_name,
          phone_number: phone_number || existing.phone_number,
          updated_at: new Date().toISOString()
        })
        .write();

      return existing;
    }

    // Yangi qo'shamiz
    const whitelistEntry = {
      id: Date.now(),
      telegram_user_id: telegram_user_id.toString(),
      username: username || '',
      full_name: full_name || '',
      phone_number: phone_number || null,
      reason: reason || 'Admin tomonidan tasdiqlangan',
      added_by: added_by || 0,
      added_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.get('whitelist')
      .push(whitelistEntry)
      .write();

    return whitelistEntry;
  }

  /**
   * Whitelistda bormi tekshirish
   */
  static async isWhitelisted(telegram_user_id) {
    if (!telegram_user_id) return false;

    const entry = db.get('whitelist')
      .find({ telegram_user_id: telegram_user_id.toString() })
      .value();

    return !!entry;
  }

  /**
   * Phone number bo'yicha tekshirish
   */
  static async isPhoneWhitelisted(phone_number) {
    if (!phone_number) return false;

    const entry = db.get('whitelist')
      .find({ phone_number: phone_number })
      .value();

    return !!entry;
  }

  /**
   * Whitelistdan o'chirish
   */
  static async remove(telegram_user_id) {
    const removed = db.get('whitelist')
      .find({ telegram_user_id: telegram_user_id.toString() })
      .value();

    db.get('whitelist')
      .remove({ telegram_user_id: telegram_user_id.toString() })
      .write();

    return removed;
  }

  /**
   * Barcha whitelistni olish
   */
  static async getAll() {
    return db.get('whitelist')
      .orderBy(['added_at'], ['desc'])
      .value();
  }

  /**
   * ID bo'yicha topish
   */
  static async findById(id) {
    return db.get('whitelist')
      .find({ id: parseInt(id) })
      .value();
  }

  /**
   * User ID bo'yicha topish
   */
  static async findByUserId(telegram_user_id) {
    return db.get('whitelist')
      .find({ telegram_user_id: telegram_user_id.toString() })
      .value();
  }

  /**
   * Statistika
   */
  static async getStats() {
    const all = db.get('whitelist').value() || [];

    return {
      total: all.length,
      withPhone: all.filter(w => w.phone_number).length,
      withoutPhone: all.filter(w => !w.phone_number).length
    };
  }
}

module.exports = Whitelist;
