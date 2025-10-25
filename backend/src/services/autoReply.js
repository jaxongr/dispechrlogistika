/**
 * Auto-Reply Service
 *
 * Dispatcher userlar guruhlarda xabar yozganda avtomatik javob berish
 */

const { db } = require('../config/database');

class AutoReplyService {
  constructor() {
    this.lastReplyTime = null;
  }

  /**
   * Get auto-reply settings from database
   */
  getSettings() {
    const settings = db.get('auto_reply_settings').value();
    if (!settings) {
      const defaultSettings = {
        enabled: false,
        template: 'Assalomu alaykum hurmatli dispechr! Sizni ish samaradorligingizni oshirish uchun guruh ochdik! U yerda barcha yukchilardan yuk beriladi tekinga! Guruhga qo\'shilish uchun profil shapkasidagi guruhga qo\'shiling!',
        max_replies_per_hour: 50,
        cooldown_hours: 1,
        check_target_group: true,
        last_updated: new Date().toISOString()
      };
      db.set('auto_reply_settings', defaultSettings).write();
      return defaultSettings;
    }
    return settings;
  }

  /**
   * Update auto-reply settings
   */
  updateSettings(newSettings) {
    const current = this.getSettings();
    const updated = {
      ...current,
      ...newSettings,
      last_updated: new Date().toISOString()
    };
    db.set('auto_reply_settings', updated).write();
    return updated;
  }

  /**
   * Check if can reply to user (cooldown check)
   */
  canReplyToUser(userId, groupId) {
    const settings = this.getSettings();

    if (!settings.enabled) {
      return { allowed: false, reason: 'disabled' };
    }

    const cooldownMs = settings.cooldown_hours * 60 * 60 * 1000;
    const now = Date.now();

    // Find last reply to this user in this group
    const lastReply = db.get('dispatcher_auto_replies')
      .filter({ user_id: userId.toString(), group_id: groupId.toString() })
      .orderBy('replied_at', 'desc')
      .first()
      .value();

    if (lastReply) {
      const timeSinceLastReply = now - new Date(lastReply.replied_at).getTime();
      if (timeSinceLastReply < cooldownMs) {
        const remainingMinutes = Math.ceil((cooldownMs - timeSinceLastReply) / 1000 / 60);
        return {
          allowed: false,
          reason: 'cooldown',
          remainingMinutes
        };
      }
    }

    // Check hourly limit
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const repliesLastHour = db.get('dispatcher_auto_replies')
      .filter(r => new Date(r.replied_at) > oneHourAgo)
      .size()
      .value();

    if (repliesLastHour >= settings.max_replies_per_hour) {
      return {
        allowed: false,
        reason: 'hourly_limit',
        limit: settings.max_replies_per_hour
      };
    }

    return { allowed: true };
  }

  /**
   * Send auto-reply to dispatcher in group using Telegram Session
   */
  async sendAutoReply(sessionClient, userId, username, groupId, groupName, messageId) {
    try {
      const settings = this.getSettings();

      // Check if enabled
      if (!settings.enabled) {
        console.log('⏭️ Auto-reply disabled');
        return { success: false, reason: 'disabled' };
      }

      // Check cooldown and limits
      const canReply = this.canReplyToUser(userId, groupId);
      if (!canReply.allowed) {
        console.log(`⏭️ Cannot reply to ${username}: ${canReply.reason}`);
        return { success: false, ...canReply };
      }

      // Check if user is in target group (skip if already there)
      if (settings.check_target_group) {
        const telegramBot = require('./telegram-bot');
        const isInTargetGroup = await telegramBot.isUserInGroup(userId);

        if (isInTargetGroup) {
          console.log(`⏭️ User ${username} already in target group - skip auto-reply`);
          return { success: false, reason: 'already_in_target_group' };
        }
      }

      // Send reply message via Telegram Session
      const result = await sessionClient.sendMessage(
        groupId,
        settings.template,
        messageId
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      console.log(`✅ Auto-reply sent to ${username} in ${groupName}`);

      // Save to history
      this.saveReplyHistory({
        user_id: userId.toString(),
        username: username || '',
        group_id: groupId.toString(),
        group_name: groupName || '',
        message_id: messageId,
        reply_message_id: result.message_id,
        replied_at: new Date().toISOString()
      });

      this.lastReplyTime = Date.now();

      return {
        success: true,
        reply_message_id: result.message_id
      };

    } catch (error) {
      console.error(`❌ Auto-reply error for ${username}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save reply to history
   */
  saveReplyHistory(replyData) {
    try {
      const history = db.get('dispatcher_auto_replies').value() || [];

      const reply = {
        id: Date.now(),
        ...replyData,
        created_at: new Date().toISOString()
      };

      history.push(reply);

      // Keep only last 1000 replies
      if (history.length > 1000) {
        history.shift();
      }

      db.set('dispatcher_auto_replies', history).write();
    } catch (error) {
      console.error('❌ Save reply history error:', error.message);
    }
  }

  /**
   * Get auto-reply history
   */
  getReplyHistory(limit = 100) {
    try {
      const history = db.get('dispatcher_auto_replies').value() || [];
      return history
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit);
    } catch (error) {
      console.error('❌ Get reply history error:', error.message);
      return [];
    }
  }

  /**
   * Get statistics
   */
  getStatistics() {
    try {
      const history = db.get('dispatcher_auto_replies').value() || [];
      const now = Date.now();
      const oneHourAgo = new Date(now - 60 * 60 * 1000);
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

      return {
        total_replies: history.length,
        replies_last_hour: history.filter(r => new Date(r.replied_at) > oneHourAgo).length,
        replies_last_24h: history.filter(r => new Date(r.replied_at) > oneDayAgo).length,
        unique_users: new Set(history.map(r => r.user_id)).size,
        unique_groups: new Set(history.map(r => r.group_id)).size
      };
    } catch (error) {
      console.error('❌ Get statistics error:', error.message);
      return {
        total_replies: 0,
        replies_last_hour: 0,
        replies_last_24h: 0,
        unique_users: 0,
        unique_groups: 0
      };
    }
  }
}

module.exports = new AutoReplyService();
