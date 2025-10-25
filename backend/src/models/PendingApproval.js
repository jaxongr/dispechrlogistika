const { db } = require('../config/database');

/**
 * PendingApproval Model
 * Admin tasdiq uchun kutayotgan bloklashlar
 */
class PendingApproval {
  /**
   * Yangi pending approval yaratish
   */
  static async create({
    telegram_user_id,
    username,
    full_name,
    phone_number,
    message_id,
    message_text,
    reason,
    detected_by
  }) {
    const approval = {
      id: Date.now(),
      telegram_user_id,
      username: username || '',
      full_name: full_name || '',
      phone_number: phone_number || null,
      message_id, // Bizning database'dagi message ID
      message_text: message_text || '',
      reason, // Bloklash sababi
      detected_by, // Qaysi qoida aniqladi
      created_at: new Date().toISOString(),
      admin_notified: false,
      admin_response: null, // 'approved' yoki 'rejected'
      admin_responded_at: null
    };

    db.get('pending_approvals')
      .push(approval)
      .write();

    return approval;
  }

  /**
   * ID bo'yicha topish
   */
  static async findById(id) {
    return db.get('pending_approvals')
      .find({ id: parseInt(id) })
      .value();
  }

  /**
   * User ID bo'yicha topish
   */
  static async findByUserId(telegram_user_id) {
    return db.get('pending_approvals')
      .filter({ telegram_user_id: telegram_user_id.toString() })
      .value();
  }

  /**
   * Pending (javob berilmagan) approvallar
   */
  static async getPending() {
    return db.get('pending_approvals')
      .filter({ admin_response: null })
      .orderBy(['created_at'], ['desc'])
      .value();
  }

  /**
   * Admin javobini saqlash
   */
  static async updateAdminResponse(id, response) {
    db.get('pending_approvals')
      .find({ id: parseInt(id) })
      .assign({
        admin_response: response, // 'approved' yoki 'rejected'
        admin_responded_at: new Date().toISOString()
      })
      .write();

    return db.get('pending_approvals')
      .find({ id: parseInt(id) })
      .value();
  }

  /**
   * Admin notified qilish
   */
  static async markAsNotified(id) {
    db.get('pending_approvals')
      .find({ id: parseInt(id) })
      .assign({ admin_notified: true })
      .write();
  }

  /**
   * Statistika
   */
  static async getStats() {
    const all = db.get('pending_approvals').value() || [];
    const pending = all.filter(a => !a.admin_response);
    const approved = all.filter(a => a.admin_response === 'approved');
    const rejected = all.filter(a => a.admin_response === 'rejected');

    return {
      total: all.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length
    };
  }

  /**
   * Eski approvallarni o'chirish (30 kundan eski)
   */
  static async cleanup() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const all = db.get('pending_approvals').value() || [];
    const toKeep = all.filter(a => new Date(a.created_at) >= thirtyDaysAgo);

    db.set('pending_approvals', toKeep).write();

    return all.length - toKeep.length; // Deleted count
  }
}

module.exports = PendingApproval;
