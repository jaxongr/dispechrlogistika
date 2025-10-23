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
}

module.exports = BlockedUser;
