const { db } = require('../config/database');

class Message {
  static async create(messageData) {
    const {
      telegram_message_id,
      group_id,
      sender_user_id,
      sender_username,
      sender_full_name,
      message_text,
      message_date,
      is_dispatcher = false,
      route_from,
      route_to,
      cargo_type,
      weight,
      vehicle_type,
      contact_phone,
      price,
      raw_data = {},
      confidence_score
    } = messageData;

    const message = {
      id: Date.now(),
      telegram_message_id,
      group_id,
      sender_user_id,
      sender_username,
      sender_full_name,
      message_text,
      message_date,
      is_dispatcher,
      is_approved: false,
      is_sent_to_channel: false,
      route_from,
      route_to,
      cargo_type,
      weight,
      vehicle_type,
      contact_phone,
      price,
      raw_data,
      confidence_score,
      created_at: new Date().toISOString(),
      processed_at: null
    };

    db.get('messages')
      .push(message)
      .write();

    return message;
  }

  static async findAll(filters = {}) {
    let messages = db.get('messages').value();

    // Apply filters FIRST to reduce dataset
    if (filters.is_dispatcher !== undefined) {
      messages = messages.filter(m => m.is_dispatcher === filters.is_dispatcher);
    }

    if (filters.is_approved !== undefined) {
      messages = messages.filter(m => m.is_approved === filters.is_approved);
    }

    if (filters.is_sent_to_channel !== undefined) {
      messages = messages.filter(m => m.is_sent_to_channel === filters.is_sent_to_channel);
    }

    if (filters.group_id) {
      messages = messages.filter(m => m.group_id === filters.group_id);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      messages = messages.filter(m =>
        m.message_text && m.message_text.toLowerCase().includes(searchLower)
      );
    }

    // Sort by message_date DESC
    messages.sort((a, b) => new Date(b.message_date) - new Date(a.message_date));

    // Count total BEFORE pagination
    const total = messages.length;

    // Apply pagination EARLY
    if (filters.offset) {
      messages = messages.slice(filters.offset);
    }
    if (filters.limit) {
      messages = messages.slice(0, filters.limit);
    }

    // Only load groups and calculate user_group_count for paginated results
    const groups = db.get('telegram_groups').value();
    const groupsMap = new Map(groups.map(g => [g.id, g]));

    // Get unique user IDs from current page only
    const uniqueUserIds = [...new Set(messages.map(m => m.sender_user_id))];

    // Pre-calculate user group counts for only these users
    const allMessages = db.get('messages').value();
    const userGroupCountsMap = new Map();

    uniqueUserIds.forEach(userId => {
      const userGroupIds = new Set(
        allMessages
          .filter(msg => msg.sender_user_id === userId)
          .map(msg => msg.group_id)
      );
      userGroupCountsMap.set(userId, userGroupIds.size);
    });

    // Enrich messages with group info and user group count
    messages = messages.map(m => {
      const group = groupsMap.get(m.group_id);
      return {
        ...m,
        group_name: group ? group.group_name : null,
        group_username: group ? group.group_username : null,
        user_group_count: userGroupCountsMap.get(m.sender_user_id) || 0
      };
    });

    return messages;
  }

  static async findById(id) {
    const message = db.get('messages')
      .find({ id: parseInt(id) })
      .value();

    if (!message) return null;

    // Add group info
    const group = db.get('telegram_groups')
      .find({ id: message.group_id })
      .value();

    // Count user's groups
    const allMessages = db.get('messages').value();
    const userGroupIds = new Set(
      allMessages
        .filter(msg => msg.sender_user_id === message.sender_user_id)
        .map(msg => msg.group_id)
    );

    return {
      ...message,
      group_name: group ? group.group_name : null,
      group_username: group ? group.group_username : null,
      user_group_count: userGroupIds.size
    };
  }

  static async update(id, data) {
    const updatedData = {
      ...data,
      processed_at: new Date().toISOString()
    };

    db.get('messages')
      .find({ id: parseInt(id) })
      .assign(updatedData)
      .write();

    return this.findById(id);
  }

  static async delete(id) {
    db.get('messages')
      .remove({ id: parseInt(id) })
      .write();
  }

  static async countByFilters(filters = {}) {
    let messages = db.get('messages').value();

    if (filters.is_dispatcher !== undefined) {
      messages = messages.filter(m => m.is_dispatcher === filters.is_dispatcher);
    }

    if (filters.is_approved !== undefined) {
      messages = messages.filter(m => m.is_approved === filters.is_approved);
    }

    if (filters.is_sent_to_channel !== undefined) {
      messages = messages.filter(m => m.is_sent_to_channel === filters.is_sent_to_channel);
    }

    return messages.length;
  }

  static async getStatistics() {
    const messages = db.get('messages').value() || [];
    const blockedUsers = db.get('blocked_users').value() || [];
    const blockedPhones = db.get('blocked_phones').value() || [];

    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    // Bugungi sana (00:00:00 dan)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    // Guruhga yuborilgan unikal telefon raqamlar
    const sentMessages = messages.filter(m => m.is_sent_to_channel && m.contact_phone);
    const uniquePhones = new Set(sentMessages.map(m => m.contact_phone));

    // Bloklangan userlar - avtomatik va qo'lda
    const autoBlockedUsers = blockedUsers.filter(u => u.blocked_by === 0 || u.blocked_by === null);
    const manualBlockedUsers = blockedUsers.filter(u => u.blocked_by && u.blocked_by !== 0);

    return {
      total_messages: messages.length,
      dispatcher_messages: messages.filter(m => m.is_dispatcher).length,
      approved_messages: messages.filter(m => m.is_approved).length,
      sent_messages: messages.filter(m => m.is_sent_to_channel).length,
      messages_today: messages.filter(m => new Date(m.message_date) > oneDayAgo).length,
      messages_week: messages.filter(m => new Date(m.message_date) > oneWeekAgo).length,
      blocked_users: blockedUsers.length,
      
      // Yangi statistikalar
      unique_phones_sent: uniquePhones.size,
      blocked_phones: blockedPhones.length,
      auto_blocked_users: autoBlockedUsers.length,
      manual_blocked_users: manualBlockedUsers.length,

      // Bugungi statistika (00:00:00 dan hozirgi vaqtgacha)
      sent_today: messages.filter(m => m.is_sent_to_channel && new Date(m.created_at) >= todayStart).length,
      blocked_today: blockedUsers.filter(u => new Date(u.blocked_at) >= todayStart).length
    };
  }
}

module.exports = Message;
