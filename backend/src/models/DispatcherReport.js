const { db } = require('../config/database');

class DispatcherReport {
  /**
   * Yangi hisobot yaratish (tugma bosilganda)
   */
  static async create({ message_id, reported_by_user_id, reported_by_username, reported_by_full_name, reported_user_id, reported_user_username, channel_message_id }) {
    const report = {
      id: Date.now(),
      message_id, // Bizning database'dagi message ID
      reported_by_user_id, // Kim bosgani
      reported_by_username,
      reported_by_full_name,
      reported_user_id, // Kimni bloklashga harakat qilgani
      reported_user_username,
      channel_message_id, // Kanaldagi xabar ID
      reported_at: new Date().toISOString(),
      admin_notified: false, // Admin'ga xabar yuborilganmi
      admin_action: null, // 'blocked', 'ignored', 'kicked'
      admin_action_at: null
    };

    db.get('dispatcher_reports')
      .push(report)
      .write();

    return report;
  }

  /**
   * Ma'lum user nechta xabar haqida hisobot berganini olish
   */
  static async getReportsByUser(user_id) {
    const reports = db.get('dispatcher_reports')
      .filter({ reported_by_user_id: user_id })
      .value();

    return reports || [];
  }

  /**
   * Oxirgi 100 ta hisobot
   */
  static async getRecent(limit = 100) {
    const reports = db.get('dispatcher_reports')
      .orderBy(['reported_at'], ['desc'])
      .take(limit)
      .value();

    return reports || [];
  }

  /**
   * Ma'lum xabar uchun hisobotlar
   */
  static async getByMessageId(message_id) {
    const reports = db.get('dispatcher_reports')
      .filter({ message_id })
      .value();

    return reports || [];
  }

  /**
   * Admin action qo'shish
   */
  static async updateAdminAction(report_id, action) {
    db.get('dispatcher_reports')
      .find({ id: report_id })
      .assign({
        admin_action: action,
        admin_action_at: new Date().toISOString()
      })
      .write();

    return db.get('dispatcher_reports')
      .find({ id: report_id })
      .value();
  }

  /**
   * Admin notified qilish
   */
  static async markAsNotified(report_id) {
    db.get('dispatcher_reports')
      .find({ id: report_id })
      .assign({ admin_notified: true })
      .write();
  }

  /**
   * Statistika - kim nechta bloklagan
   */
  static async getStatistics() {
    const reports = db.get('dispatcher_reports').value() || [];

    // Userlar bo'yicha guruhlash
    const userStats = {};

    reports.forEach(report => {
      const userId = report.reported_by_user_id;
      if (!userStats[userId]) {
        userStats[userId] = {
          user_id: userId,
          username: report.reported_by_username,
          full_name: report.reported_by_full_name,
          total_reports: 0,
          last_report: null
        };
      }

      userStats[userId].total_reports += 1;

      if (!userStats[userId].last_report || report.reported_at > userStats[userId].last_report) {
        userStats[userId].last_report = report.reported_at;
      }
    });

    // Array'ga aylantirish va sorting
    const stats = Object.values(userStats)
      .sort((a, b) => b.total_reports - a.total_reports);

    return {
      total_reports: reports.length,
      unique_reporters: stats.length,
      top_reporters: stats.slice(0, 10),
      all_reporters: stats
    };
  }

  /**
   * Bugungi hisobotlar
   */
  static async getTodayReports() {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);

    const reports = db.get('dispatcher_reports')
      .filter(r => new Date(r.reported_at) >= todayStart)
      .value();

    return reports || [];
  }
}

module.exports = DispatcherReport;
