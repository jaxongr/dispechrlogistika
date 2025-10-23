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

    // Apply filters
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

    // Add group info and count user's groups
    const groups = db.get('telegram_groups').value();
    const allMessages = db.get('messages').value();

    messages = messages.map(m => {
      const group = groups.find(g => g.id === m.group_id);

      // Count how many unique groups this user has posted in
      const userGroupIds = new Set(
        allMessages
          .filter(msg => msg.sender_user_id === m.sender_user_id)
          .map(msg => msg.group_id)
      );

      return {
        ...m,
        group_name: group ? group.group_name : null,
        group_username: group ? group.group_username : null,
        user_group_count: userGroupIds.size // Number of groups user is active in
      };
    });

    // Pagination
    const total = messages.length;
    if (filters.offset) {
      messages = messages.slice(filters.offset);
    }
    if (filters.limit) {
      messages = messages.slice(0, filters.limit);
    }

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
    const messages = db.get('messages').value();

    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    return {
      total_messages: messages.length,
      dispatcher_messages: messages.filter(m => m.is_dispatcher).length,
      approved_messages: messages.filter(m => m.is_approved).length,
      sent_messages: messages.filter(m => m.is_sent_to_channel).length,
      messages_today: messages.filter(m => new Date(m.message_date) > oneDayAgo).length,
      messages_week: messages.filter(m => new Date(m.message_date) > oneWeekAgo).length
    };
  }
}

module.exports = Message;
