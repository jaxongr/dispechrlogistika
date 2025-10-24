const { db } = require('../config/database');
const Message = require('./Message');

class DailyStatistics {
  /**
   * Bugungi statistikani saqlash
   * Har kecha 00:00 da avtomatik chaqiriladi
   */
  static async saveTodayStatistics() {
    try {
      // Kechagi kun uchun statistika (00:00:00 dan 23:59:59)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
      const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);

      const messages = db.get('messages').value() || [];
      const blockedUsers = db.get('blocked_users').value() || [];
      const blockedPhones = db.get('blocked_phones').value() || [];

      // Kechagi statistika
      const sentYesterday = messages.filter(m => {
        const createdAt = new Date(m.created_at);
        return m.is_sent_to_channel && createdAt >= yesterdayStart && createdAt <= yesterdayEnd;
      }).length;

      const blockedYesterday = blockedUsers.filter(u => {
        const blockedAt = new Date(u.blocked_at);
        return blockedAt >= yesterdayStart && blockedAt <= yesterdayEnd;
      }).length;

      const autoBlockedYesterday = blockedUsers.filter(u => {
        const blockedAt = new Date(u.blocked_at);
        return (u.blocked_by === 0 || u.blocked_by === null) &&
               blockedAt >= yesterdayStart && blockedAt <= yesterdayEnd;
      }).length;

      const totalMessages = messages.filter(m => {
        const messageDate = new Date(m.message_date);
        return messageDate >= yesterdayStart && messageDate <= yesterdayEnd;
      }).length;

      // Arxivga saqlash
      const dailyStat = {
        id: Date.now(),
        date: yesterdayStart.toISOString().split('T')[0], // YYYY-MM-DD format
        sent_to_group: sentYesterday,
        blocked_users: blockedYesterday,
        auto_blocked_users: autoBlockedYesterday,
        total_messages: totalMessages,
        blocked_phones: blockedPhones.length, // jami bloklangan telefonlar
        created_at: new Date().toISOString()
      };

      // Saqlash
      db.get('daily_statistics')
        .push(dailyStat)
        .write();

      console.log(`📊 Kunlik statistika saqlandi: ${dailyStat.date}`, dailyStat);
      return dailyStat;
    } catch (error) {
      console.error('❌ Kunlik statistika saqlashda xatolik:', error);
      throw error;
    }
  }

  /**
   * Oxirgi N kunlik statistikani olish
   */
  static async getLastDays(limit = 30) {
    const stats = db.get('daily_statistics')
      .orderBy(['date'], ['desc'])
      .take(limit)
      .value();

    return stats || [];
  }

  /**
   * Ma'lum sanalar oralig'idagi statistika
   */
  static async getByDateRange(startDate, endDate) {
    const stats = db.get('daily_statistics')
      .filter(s => s.date >= startDate && s.date <= endDate)
      .orderBy(['date'], ['desc'])
      .value();

    return stats || [];
  }

  /**
   * Umumiy statistika (barcha kunlar bo'yicha)
   */
  static async getTotalStatistics() {
    const stats = db.get('daily_statistics').value() || [];

    if (stats.length === 0) {
      return {
        total_days: 0,
        total_sent: 0,
        total_blocked: 0,
        avg_sent_per_day: 0,
        avg_blocked_per_day: 0
      };
    }

    const totalSent = stats.reduce((sum, s) => sum + (s.sent_to_group || 0), 0);
    const totalBlocked = stats.reduce((sum, s) => sum + (s.blocked_users || 0), 0);

    return {
      total_days: stats.length,
      total_sent: totalSent,
      total_blocked: totalBlocked,
      avg_sent_per_day: Math.round(totalSent / stats.length),
      avg_blocked_per_day: Math.round(totalBlocked / stats.length)
    };
  }
}

module.exports = DailyStatistics;
