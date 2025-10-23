const { db } = require('../config/database');

class TelegramGroup {
  static async create({ group_id, group_name, group_username, added_by }) {
    // Check if already exists
    const existing = db.get('telegram_groups')
      .find({ group_id })
      .value();

    if (existing) {
      // Update existing
      db.get('telegram_groups')
        .find({ group_id })
        .assign({
          group_name,
          group_username,
          is_active: true
        })
        .write();
      return db.get('telegram_groups').find({ group_id }).value();
    }

    // Create new
    const telegramGroup = {
      id: Date.now(),
      group_id,
      group_name,
      group_username,
      added_by,
      is_active: true,
      total_messages: 0,
      added_at: new Date().toISOString(),
      last_message_at: null
    };

    db.get('telegram_groups')
      .push(telegramGroup)
      .write();

    return telegramGroup;
  }

  static async findByGroupId(group_id) {
    return db.get('telegram_groups')
      .find({ group_id })
      .value();
  }

  static async findAll(is_active = null) {
    let groups = db.get('telegram_groups').value();

    if (is_active !== null) {
      groups = groups.filter(g => g.is_active === is_active);
    }

    // Sort by added_at DESC
    groups.sort((a, b) => new Date(b.added_at) - new Date(a.added_at));

    return groups;
  }

  static async update(id, data) {
    db.get('telegram_groups')
      .find({ id: parseInt(id) })
      .assign(data)
      .write();

    return db.get('telegram_groups')
      .find({ id: parseInt(id) })
      .value();
  }

  static async updateLastMessage(group_id) {
    const group = db.get('telegram_groups')
      .find({ group_id })
      .value();

    if (group) {
      db.get('telegram_groups')
        .find({ group_id })
        .assign({
          last_message_at: new Date().toISOString(),
          total_messages: (group.total_messages || 0) + 1
        })
        .write();
    }
  }

  static async delete(id) {
    db.get('telegram_groups')
      .remove({ id: parseInt(id) })
      .write();
  }

  static async getStatistics() {
    const groups = db.get('telegram_groups').value();

    return {
      total_groups: groups.length,
      active_groups: groups.filter(g => g.is_active).length,
      total_messages: groups.reduce((sum, g) => sum + (g.total_messages || 0), 0)
    };
  }
}

module.exports = TelegramGroup;
