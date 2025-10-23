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

    // Load dispatcher keywords
    try {
      const keywordsData = require('../data/dispatcher-keywords.json');
      this.dispatcherKeywords = keywordsData.keywords.map(k => k.toLowerCase());
      console.log(`✅ Loaded ${this.dispatcherKeywords.length} dispatcher keywords`);
    } catch (error) {
      console.error('❌ Failed to load dispatcher keywords:', error);
      this.dispatcherKeywords = [];
    }

    // Cleanup old data every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if username or bio contains dispatcher keywords
   */
  hasDispatcherKeywordsInProfile(username, fullName) {
    if (!username && !fullName) return false;

    const textToCheck = `${username || ''} ${fullName || ''}`.toLowerCase();

    // Check each keyword
    for (const keyword of this.dispatcherKeywords) {
      if (textToCheck.includes(keyword)) {
        return { found: true, keyword: keyword };
      }
    }

    return { found: false };
  }

  /**
   * Check if username/fullname is suspicious (too long, spam, unusual characters)
   * YANGI: Uzun va noodatiy belgilar bilan yozilgan username/fullname'larni aniqlash
   */
  isSuspiciousProfile(username, fullName) {
    const fullText = `${username || ''} ${fullName || ''}`;

    if (!fullText.trim()) return { suspicious: false };

    // 1. Juda uzun username/fullname (100+ belgi)
    if (fullText.length > 100) {
      return {
        suspicious: true,
        reason: `Juda uzun username/fullname (${fullText.length} belgi)`
      };
    }

    // 2. Takrorlanuvchi belgilar (bir xil belgi 10+ marta ketma-ket)
    const repeatingPattern = /(.)\1{9,}/;
    if (repeatingPattern.test(fullText)) {
      return {
        suspicious: true,
        reason: 'Takrorlanuvchi belgilar (spam)'
      };
    }

    // 3. Noodatiy Unicode belgilar (cuneiform, hieroglyphics, va boshqalar)
    // Cuneiform: U+12000-U+123FF, U+12400-U+1247F
    // Egyptian Hieroglyphs: U+13000-U+1342F
    // Va boshqa noodatiy Unicode bloklar
    const unusualUnicodePattern = /[\u{12000}-\u{1247F}\u{13000}-\u{1342F}\u{1D000}-\u{1F9FF}]/u;
    if (unusualUnicodePattern.test(fullText)) {
      return {
        suspicious: true,
        reason: 'Noodatiy Unicode belgilar'
      };
    }

    // 4. Ko'p emoji (15+ emoji)
    const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const emojiMatches = fullText.match(emojiPattern) || [];
    if (emojiMatches.length > 15) {
      return {
        suspicious: true,
        reason: `Ko'p emoji (${emojiMatches.length}ta)`
      };
    }

    // 5. Username faqat emoji va maxsus belgilardan iborat (harf yo'q)
    const hasLetters = /[a-zA-Zа-яА-ЯёЁўЎқҚғҒҳҲ]/;
    const hasOnlySpecialChars = !hasLetters.test(fullText) && fullText.length > 10;
    if (hasOnlySpecialChars) {
      return {
        suspicious: true,
        reason: 'Faqat maxsus belgilar (harf yo\'q)'
      };
    }

    return { suspicious: false };
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
   * Database'dan user'ning guruh sonini olish (barcha xabarlarga asoslangan)
   */
  getUserGroupCountFromDB(userId) {
    try {
      const { db } = require('../config/database');
      const messages = db.get('messages').value();

      // User'ning barcha xabarlaridan unique group_id'larni olish
      const userGroups = new Set(
        messages
          .filter(m => m.sender_user_id === userId)
          .map(m => m.group_id)
      );

      return userGroups.size;
    } catch (error) {
      console.error('❌ Error getting user group count from DB:', error);
      return 0;
    }
  }

  /**
   * Asosiy filter funksiyasi
   * @returns {Object} { shouldBlock: boolean, reason: string, isDispatcher: boolean }
   */
  checkMessage(messageData) {
    const { message_text, sender_user_id, sender_username, sender_full_name, group_id } = messageData;

    // 0. Username yoki full name'da kalit so'z bor mi?
    const keywordCheck = this.hasDispatcherKeywordsInProfile(sender_username, sender_full_name);
    if (keywordCheck.found) {
      return {
        shouldBlock: true,
        reason: `Username/Bio'da kalit so'z: "${keywordCheck.keyword}"`,
        isDispatcher: true,
        autoBlock: true
      };
    }

    // 0.1. YANGI: Shubhali username/fullname tekshiruvi (uzun, spam, noodatiy belgilar)
    const suspiciousCheck = this.isSuspiciousProfile(sender_username, sender_full_name);
    if (suspiciousCheck.suspicious) {
      return {
        shouldBlock: true,
        reason: `Shubhali profil: ${suspiciousCheck.reason}`,
        isDispatcher: true,
        autoBlock: true
      };
    }

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

    // 3. User'ning guruh sonini tekshirish - DATABASE'DAN!
    // In-memory cache'ni yangilash
    this.trackUserGroup(sender_user_id, group_id);

    // Database'dan to'liq guruh sonini olish (barcha xabarlarga asoslangan)
    const dbGroupCount = this.getUserGroupCountFromDB(sender_user_id);

    if (dbGroupCount >= 50) {
      return {
        shouldBlock: true,
        reason: `${dbGroupCount} guruhda faol (professional dispatcher)`,
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
