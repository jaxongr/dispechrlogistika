const { db } = require('../config/database');

class BlockedUser {
  static async create({ telegram_user_id, username, full_name, reason, blocked_by }) {
    const blockedUser = {
      id: Date.now(),
      telegram_user_id,
      username,
      full_name,
      reason,
      blocked_by,
      blocked_at: new Date().toISOString(),
      blocked_message_count: 0,
      detection_patterns: []
    };

    db.get('blocked_users')
      .push(blockedUser)
      .write();

    return blockedUser;
  }

  static async findByTelegramId(telegram_user_id) {
    return db.get('blocked_users')
      .find({ telegram_user_id })
      .value();
  }

  static async isBlocked(telegram_user_id) {
    const user = db.get('blocked_users')
      .find({ telegram_user_id })
      .value();
    return !!user;
  }

  static async findAll(limit = 100, offset = 0) {
    let blockedUsers = db.get('blocked_users').value();

    // Add blocked_by username
    const users = db.get('users').value();
    blockedUsers = blockedUsers.map(bu => {
      const user = users.find(u => u.id === bu.blocked_by);
      return {
        ...bu,
        blocked_by_username: user ? user.username : null
      };
    });

    // Sort by blocked_at DESC
    blockedUsers.sort((a, b) => new Date(b.blocked_at) - new Date(a.blocked_at));

    // Pagination
    return blockedUsers.slice(offset, offset + limit);
  }

  static async delete(id) {
    db.get('blocked_users')
      .remove({ id: parseInt(id) })
      .write();
  }

  static async incrementBlockedCount(telegram_user_id) {
    const user = db.get('blocked_users')
      .find({ telegram_user_id })
      .value();

    if (user) {
      db.get('blocked_users')
        .find({ telegram_user_id })
        .assign({ blocked_message_count: (user.blocked_message_count || 0) + 1 })
        .write();
    }
  }

  static async addDetectionPattern(telegram_user_id, pattern) {
    const user = db.get('blocked_users')
      .find({ telegram_user_id })
      .value();

    if (user) {
      const patterns = user.detection_patterns || [];
      patterns.push(pattern);

      db.get('blocked_users')
        .find({ telegram_user_id })
        .assign({ detection_patterns: patterns })
        .write();
    }
  }

  /**
   * Add phone number to blocked phones list
   */
  static async blockPhoneNumber(phone, reason = 'Bloklangan user telefoni') {
    if (!phone) return;

    // Normalize phone number (remove spaces, dashes, etc)
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');

    // Check if already blocked
    const existingBlocked = db.get('blocked_phones')
      .find({ phone: normalizedPhone })
      .value();

    if (existingBlocked) {
      return existingBlocked;
    }

    // Add to blocked phones
    const blockedPhone = {
      id: Date.now(),
      phone: normalizedPhone,
      reason,
      blocked_at: new Date().toISOString()
    };

    // Initialize blocked_phones array if not exists
    if (!db.has('blocked_phones').value()) {
      db.set('blocked_phones', []).write();
    }

    db.get('blocked_phones')
      .push(blockedPhone)
      .write();

    console.log(`📵 Phone blocked: ${normalizedPhone} - ${reason}`);
    return blockedPhone;
  }

  /**
   * Check if phone number is blocked
   */
  static async isPhoneBlocked(phone) {
    if (!phone) return false;

    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');

    if (!db.has('blocked_phones').value()) {
      return false;
    }

    const blocked = db.get('blocked_phones')
      .find({ phone: normalizedPhone })
      .value();

    return !!blocked;
  }

  /**
   * Find and block all phone numbers from a user's messages
   */
  static async blockUserPhoneNumbers(telegram_user_id, reason = 'Bloklangan user telefoni') {
    // Find all messages from this user with phone numbers
    const messages = db.get('messages')
      .filter({ sender_user_id: telegram_user_id })
      .value();

    const phoneNumbers = [];

    for (const msg of messages) {
      if (msg.contact_phone) {
        await this.blockPhoneNumber(msg.contact_phone, reason);
        phoneNumbers.push(msg.contact_phone);
      }
    }

    console.log(`📵 Blocked ${phoneNumbers.length} phone numbers from user ${telegram_user_id}`);
    return phoneNumbers;
  }

  /**
   * Get all blocked phone numbers
   */
  static async getBlockedPhones() {
    if (!db.has('blocked_phones').value()) {
      return [];
    }

    return db.get('blocked_phones').value();
  }
}

module.exports = BlockedUser;
