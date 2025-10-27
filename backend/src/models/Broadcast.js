const { db } = require('../config/database');

/**
 * Broadcast Model - Ommaviy xabar yuborish
 */
class Broadcast {
  /**
   * Yangi broadcast yaratish
   */
  static create(data) {
    const broadcast = {
      id: Date.now(),
      message_text: data.message_text,
      target_groups: data.target_groups || [],      // [group_id1, group_id2, ...]
      status: 'pending',                             // pending, running, paused, completed, failed
      created_by: data.created_by,
      created_at: new Date().toISOString(),

      // Progress tracking
      total_groups: data.target_groups?.length || 0,
      sent_count: 0,
      failed_count: 0,
      started_at: null,
      completed_at: null,

      // Rate limiting settings
      interval_seconds: data.interval_seconds || 4,  // Har bir guruh orasida 4 soniya
      batch_size: data.batch_size || 20,             // 20 ta guruhga yuborib
      batch_pause_seconds: data.batch_pause_seconds || 30,  // 30 soniya dam olish
      cycle_pause_minutes: data.cycle_pause_minutes || 5,   // 5 daqiqa dam olib yana davom

      // Error tracking
      errors: [],
      last_sent_group_id: null
    };

    db.get('broadcasts').push(broadcast).write();
    console.log(`📢 Broadcast yaratildi: ${broadcast.id}`);
    return broadcast;
  }

  /**
   * Broadcast ni ID bo'yicha olish
   */
  static findById(id) {
    return db.get('broadcasts').find({ id: parseInt(id) }).value();
  }

  /**
   * Barcha broadcast'larni olish
   */
  static findAll(filters = {}) {
    let broadcasts = db.get('broadcasts').value();

    if (filters.status) {
      broadcasts = broadcasts.filter(b => b.status === filters.status);
    }

    // Sort by created_at DESC
    broadcasts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return broadcasts;
  }

  /**
   * Broadcast statusini yangilash
   */
  static updateStatus(id, status, additionalData = {}) {
    const broadcast = db.get('broadcasts')
      .find({ id: parseInt(id) })
      .assign({
        status,
        ...additionalData
      })
      .write();

    console.log(`📢 Broadcast ${id} status: ${status}`);
    return broadcast;
  }

  /**
   * Progress ni yangilash
   */
  static updateProgress(id, sentCount, failedCount, lastGroupId) {
    const broadcast = db.get('broadcasts')
      .find({ id: parseInt(id) })
      .assign({
        sent_count: sentCount,
        failed_count: failedCount,
        last_sent_group_id: lastGroupId
      })
      .write();

    return broadcast;
  }

  /**
   * Xato qo'shish
   */
  static addError(id, error) {
    const broadcast = this.findById(id);
    if (!broadcast) return null;

    const errors = broadcast.errors || [];
    errors.push({
      timestamp: new Date().toISOString(),
      message: error.message,
      group_id: error.group_id
    });

    db.get('broadcasts')
      .find({ id: parseInt(id) })
      .assign({ errors })
      .write();
  }

  /**
   * Broadcast ni o'chirish
   */
  static delete(id) {
    db.get('broadcasts')
      .remove({ id: parseInt(id) })
      .write();

    console.log(`🗑️ Broadcast o'chirildi: ${id}`);
  }

  /**
   * Running broadcast'ni topish
   */
  static findRunning() {
    return db.get('broadcasts')
      .filter(b => b.status === 'running')
      .value();
  }
}

module.exports = Broadcast;
