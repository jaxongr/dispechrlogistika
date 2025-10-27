const { db } = require('../config/database');

/**
 * Broadcast Announcement Model
 * Ommaviy xabar yuborishda ishlatiladigan e'lonlarni boshqarish
 * Har bir e'lon alohida saqlanadi va xabar tashlanishi mumkin
 */
class BroadcastAnnouncement {
  /**
   * Yangi e'lon yaratish
   */
  static create(data) {
    const announcement = {
      id: Date.now(),
      message_text: data.message_text,
      is_active: true,                    // Faol yoki yo'q (yopilgan yuk = false)
      order: data.order || 0,             // Tartib raqami (0 = 1-chi)
      created_by: data.created_by,
      created_at: new Date().toISOString()
    };

    db.get('broadcast_announcements').push(announcement).write();
    console.log(`📝 E'lon yaratildi: ${announcement.id}`);
    return announcement;
  }

  /**
   * Barcha faol e'lonlarni olish
   */
  static getActiveAnnouncements() {
    return db.get('broadcast_announcements')
      .filter({ is_active: true })
      .sortBy('order')
      .value();
  }

  /**
   * Barcha e'lonlarni olish
   */
  static getAll() {
    return db.get('broadcast_announcements')
      .sortBy('order')
      .value();
  }

  /**
   * E'lonni ID bo'yicha olish
   */
  static findById(id) {
    return db.get('broadcast_announcements')
      .find({ id: parseInt(id) })
      .value();
  }

  /**
   * E'lonni yangilash
   */
  static update(id, data) {
    const announcement = db.get('broadcast_announcements')
      .find({ id: parseInt(id) })
      .assign(data)
      .write();

    console.log(`✏️ E'lon yangilandi: ${id}`);
    return announcement;
  }

  /**
   * E'lonni faol/nofaol qilish
   */
  static setActive(id, isActive) {
    return this.update(id, { is_active: isActive });
  }

  /**
   * E'lonni o'chirish
   */
  static delete(id) {
    db.get('broadcast_announcements')
      .remove({ id: parseInt(id) })
      .write();

    console.log(`🗑️ E'lon o'chirildi: ${id}`);
  }

  /**
   * Ommaviy xabar uchun kombinatsiya yaratish
   * 3 qator tashlab qo'shish
   */
  static generateCombinedMessage() {
    const announcements = this.getActiveAnnouncements();

    if (announcements.length === 0) {
      return null;
    }

    // Barcha e'lonlarni 3 qator tashlab birlashtiramiz
    const combinedMessage = announcements
      .map(ann => ann.message_text)
      .join('\n\n\n'); // 3 qator tashlab

    return combinedMessage;
  }
}

module.exports = BroadcastAnnouncement;
