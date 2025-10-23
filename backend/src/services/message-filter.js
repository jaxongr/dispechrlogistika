/**
 * Message Filter Service
 * Dispatcherlarni aniqlash va dublikat xabarlarni filterlash
 */

class MessageFilter {
  constructor() {
    // In-memory cache for quick checks
    this.userMessageCount = new Map(); // user_id -> { count, lastReset }
    this.recentMessages = new Map(); // message_hash -> timestamp
    this.userGroupCount = new Map(); // user_id -> Set of group_ids

    // Cleanup old data every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Telefon raqam bormi tekshirish
   */
  hasPhoneNumber(text) {
    // Uzbekistan: +998, 998, or just 9 digits
    // Russia: +7, 7, or 11 digits
    // Kazakhstan: +7, 7
    const phonePatterns = [
      /\+?998\s*\d{2}\s*\d{3}\s*\d{2}\s*\d{2}/,  // Uzbek format
      /\+?998\d{9}/,                               // Uzbek compact
      /\+?7\s*\d{3}\s*\d{3}\s*\d{2}\s*\d{2}/,    // Russia/Kazakhstan
      /\+?7\d{10}/,                                // Russia/Kazakhstan compact
      /\b\d{9,12}\b/,                              // Any 9-12 digit number
      /\d{2}\.\d{3}\.\d{2}\.\d{2}/,               // Format: 90.123.45.67
      /\d{3}\s*\d{3}\s*\d{3}/,                    // Format: 901 234 567
    ];

    return phonePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Xabar hash yaratish (dublikat aniqlash uchun)
   */
  getMessageHash(text) {
    // Remove emojis, whitespace, normalize
    const normalized = text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    return normalized.substring(0, 200); // First 200 chars for comparison
  }

  /**
   * User'ning guruh sonini tracking qilish
   */
  trackUserGroup(userId, groupId) {
    if (!this.userGroupCount.has(userId)) {
      this.userGroupCount.set(userId, new Set());
    }
    this.userGroupCount.get(userId).add(groupId);
    return this.userGroupCount.get(userId).size;
  }

  /**
   * User'ning xabar chastotasini tracking qilish
   */
  trackUserMessage(userId) {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (!this.userMessageCount.has(userId)) {
      this.userMessageCount.set(userId, { count: 1, lastReset: now });
      return 1;
    }

    const data = this.userMessageCount.get(userId);

    // Reset if more than 5 minutes passed
    if (now - data.lastReset > fiveMinutes) {
      data.count = 1;
      data.lastReset = now;
    } else {
      data.count++;
    }

    return data.count;
  }

  /**
   * Dublikat xabar tekshirish (20 daqiqa)
   */
  isDuplicateMessage(text, userId) {
    const hash = this.getMessageHash(text);
    const key = `${userId}:${hash}`;
    const now = Date.now();
    const twentyMinutes = 20 * 60 * 1000;

    if (this.recentMessages.has(key)) {
      const lastTime = this.recentMessages.get(key);
      if (now - lastTime < twentyMinutes) {
        return true; // Duplicate within 20 minutes
      }
    }

    // Save this message
    this.recentMessages.set(key, now);
    return false;
  }

  /**
   * Asosiy filter funksiyasi
   * @returns {Object} { shouldBlock: boolean, reason: string, isDispatcher: boolean }
   */
  checkMessage(messageData) {
    const { message_text, sender_user_id, group_id } = messageData;

    // 1. Telefon raqam tekshirish
    if (!this.hasPhoneNumber(message_text)) {
      return {
        shouldBlock: true,
        reason: 'Telefon raqam yo\'q',
        isDispatcher: false
      };
    }

    // 2. Xabar uzunligi (250+ belgi = dispatcher)
    if (message_text.length > 250) {
      return {
        shouldBlock: true,
        reason: '250+ belgi (spam)',
        isDispatcher: true,
        autoBlock: true
      };
    }

    // 3. User'ning guruh sonini tekshirish
    const groupCount = this.trackUserGroup(sender_user_id, group_id);
    if (groupCount > 50) {
      return {
        shouldBlock: true,
        reason: '50+ guruhda (professional dispatcher)',
        isDispatcher: true,
        autoBlock: true
      };
    }

    // 4. Xabar chastotasini tekshirish (5 daqiqada 10+ xabar)
    const messageCount = this.trackUserMessage(sender_user_id);
    if (messageCount > 10) {
      return {
        shouldBlock: true,
        reason: 'Juda ko\'p xabar (spam)',
        isDispatcher: true,
        autoBlock: true
      };
    }

    // 5. Dublikat tekshirish (20 daqiqa ichida)
    if (this.isDuplicateMessage(message_text, sender_user_id)) {
      return {
        shouldBlock: true,
        reason: 'Dublikat xabar (20 daqiqa ichida)',
        isDispatcher: false
      };
    }

    // Hammasi OK
    return {
      shouldBlock: false,
      reason: 'OK',
      isDispatcher: false
    };
  }

  /**
   * Eski ma'lumotlarni tozalash
   */
  cleanup() {
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;

    // Clean old messages
    for (const [key, timestamp] of this.recentMessages.entries()) {
      if (now - timestamp > thirtyMinutes) {
        this.recentMessages.delete(key);
      }
    }

    // Clean old user message counts (keep only last hour)
    const oneHour = 60 * 60 * 1000;
    for (const [userId, data] of this.userMessageCount.entries()) {
      if (now - data.lastReset > oneHour) {
        this.userMessageCount.delete(userId);
      }
    }

    console.log(`🧹 Cleanup: ${this.recentMessages.size} messages, ${this.userMessageCount.size} users tracked`);
  }

  /**
   * Statistika
   */
  getStats() {
    return {
      trackedMessages: this.recentMessages.size,
      trackedUsers: this.userMessageCount.size,
      trackedUserGroups: this.userGroupCount.size
    };
  }
}

module.exports = new MessageFilter();
