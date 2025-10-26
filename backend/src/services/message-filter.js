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

    // Xorijiy davlatlar va shaharlar ro'yxati (faqat O'zbekiston kerak!)
    this.foreignLocations = [
      // Rossiya shaharlari
      'россия', 'russia', 'moskva', 'москва', 'piter', 'питер', 'petersburg', 'петербург',
      'kazan', 'казань', 'novosibirsk', 'новосибирск', 'yekaterinburg', 'екатеринбург',
      'saratov', 'саратов', 'samara', 'самара', 'rostov', 'ростов', 'краснодар', 'krasnodar',
      'vladivostok', 'владивосток', 'omsk', 'омск', 'chelyabinsk', 'челябинск',
      'krasnoyarsk', 'красноярск', 'voronezh', 'воронеж', 'perm', 'пермь', 'volgograd', 'волгоград',

      // Qozog'iston
      'казахстан', 'kazakhstan', 'almaty', 'алматы', 'astana', 'астана', 'nur-sultan', 'нур-султан',
      'shymkent', 'шымкент', 'aktobe', 'актобе', 'karaganda', 'караганда',

      // Turkiya
      'турция', 'turkey', 'turkiye', 'istanbul', 'стамбул', 'antalya', 'анталья',
      'ankara', 'анкара', 'izmir', 'измир', 'bursa', 'бурса',

      // Evropa
      'европа', 'europe', 'polsha', 'польша', 'poland', 'warsaw', 'варшава',
      'germany', 'германия', 'berlin', 'берлин', 'munich', 'мюнхен',
      'italy', 'италия', 'рим', 'rome', 'milano', 'милан',
      'france', 'франция', 'paris', 'париж', 'london', 'лондон', 'england', 'англия',
      'spain', 'испания', 'madrid', 'мадрид', 'barcelona', 'барселона',
      'netherlands', 'нидерланды', 'amsterdam', 'амстердам',
      'belgium', 'бельгия', 'brussels', 'брюссель',
      'czech', 'чехия', 'prague', 'прага',
      'austria', 'австрия', 'vienna', 'вена',

      // Tojikiston
      'таджикистан', 'tajikistan', 'dushanbe', 'душанбе',

      // Qirg'iziston
      'кыргызстан', 'kyrgyzstan', 'bishkek', 'бишкек',

      // Turkmaniston
      'туркменистан', 'turkmenistan', 'ashgabat', 'ашхабад',

      // Ozarbayjon
      'азербайджан', 'azerbaijan', 'baku', 'баку',

      // Xitoy
      'китай', 'china', 'urumqi', 'урумчи', 'beijing', 'пекин', 'shanghai', 'шанхай',

      // Eron
      'иран', 'iran', 'tehran', 'тегеран',

      // Afg'oniston
      'афганистан', 'afghanistan', 'kabul', 'кабул',

      // Hindiston
      'индия', 'india', 'delhi', 'дели', 'mumbai', 'мумбаи',

      // Arabiston
      'дубай', 'dubai', 'uae', 'оаэ', 'arab', 'арабия', 'saudi', 'саудия',

      // Boshqa xorijiy so'zlar
      'межд', 'между', 'international', 'cargo', 'карго', 'снг', 'cis', 'европ'
    ];

    console.log(`✅ Loaded ${this.foreignLocations.length} foreign locations for blocking`);

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
   * SODDALASHTIRILDI: Faqat 30+ takrorlanuvchi belgilar tekshiriladi
   */
  isSuspiciousProfile(username, fullName) {
    const fullText = `${username || ''} ${fullName || ''}`;

    if (!fullText.trim()) return { suspicious: false };

    // FAQAT BU QOIDA QOLDI: Takrorlanuvchi belgilar (bir xil belgi 30+ marta ketma-ket)
    // Masalan: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (30+ ta 'a')
    const repeatingPattern = /(.)\1{29,}/;  // 30+ takrorlanuvchi belgi
    if (repeatingPattern.test(fullText)) {
      // Find which character is repeating
      const match = fullText.match(repeatingPattern);
      const repeatCount = match ? match[0].length : 30;
      return {
        suspicious: true,
        reason: `Spam: ${repeatCount} ta takrorlanuvchi belgi`
      };
    }

    return { suspicious: false };
  }

  /**
   * Xorijiy joy/davlat bormi tekshirish (faqat O'zbekiston kerak!)
   */
  hasForeignLocation(text) {
    if (!text) return { found: false };

    const lowerText = text.toLowerCase();

    // Check each foreign location
    for (const location of this.foreignLocations) {
      if (lowerText.includes(location)) {
        return {
          found: true,
          location: location,
          reason: `Xorijiy yo'nalish: "${location}"`
        };
      }
    }

    return { found: false };
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
    const { message_text, sender_user_id, sender_username, sender_full_name, group_id } = messageData;

    // 0. Username yoki full name'da kalit so'z bor mi?
    const keywordCheck = this.hasDispatcherKeywordsInProfile(sender_username, sender_full_name);
    if (keywordCheck.found) {
      return {
        shouldBlock: true,
        reason: `Username/Bio'da kalit so'z: "${keywordCheck.keyword}"`,
        isDispatcher: true,
        autoBlock: false  // Admin tasdiq kutiladi
      };
    }

    // 0.1. YANGI: Shubhali username/fullname tekshiruvi (uzun, spam, noodatiy belgilar)
    const suspiciousCheck = this.isSuspiciousProfile(sender_username, sender_full_name);
    if (suspiciousCheck.suspicious) {
      return {
        shouldBlock: true,
        reason: `Shubhali profil: ${suspiciousCheck.reason}`,
        isDispatcher: true,
        autoBlock: false  // Admin tasdiq kutiladi
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

    // 1.1. YANGI: Xorijiy yo'nalish tekshirish (faqat O'zbekiston kerak!)
    const foreignCheck = this.hasForeignLocation(message_text);
    if (foreignCheck.found) {
      return {
        shouldBlock: true,
        reason: `${foreignCheck.reason} (faqat O'zbekiston ichida)`,
        isDispatcher: true,
        autoBlock: false  // Admin tasdiq kutiladi
      };
    }

    // 1.2. YANGI: Ko'p @mention spam (2+ mention = dispatcher reklama)
    // Dispatcherlar o'zlarini va do'stlarini tag qilish orqali reklama qilishadi
    const mentionPattern = /@[\w]+/g;
    const mentionMatches = message_text.match(mentionPattern) || [];
    if (mentionMatches.length >= 2) {
      return {
        shouldBlock: true,
        reason: `Ko'p @mention spam (${mentionMatches.length} ta mention)`,
        isDispatcher: true,
        autoBlock: false  // Admin tasdiq kutiladi
      };
    }

    // 2. Xabar uzunligi (200+ belgi = dispatcher)
    if (message_text.length > 200) {
      return {
        shouldBlock: true,
        reason: '200+ belgi (spam)',
        isDispatcher: true,
        autoBlock: false  // Admin tasdiq kutiladi
      };
    }

    // 2.1. YANGI: Xabardagi emoji soni (3+ emoji = dispatcher)
    const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const emojiMatches = message_text.match(emojiPattern) || [];
    if (emojiMatches.length >= 3) {
      return {
        shouldBlock: true,
        reason: `3+ emoji dispetcher belgisi (${emojiMatches.length}ta emoji)`,
        isDispatcher: true,
        autoBlock: false  // Admin tasdiq kutiladi
      };
    }

    // 2.2. YANGI: Ko'p bo'sh qatorlar (3+ ketma-ket bo'sh qator = dispatcher)
    // Dispatcherlar xabarni uzun qilish uchun ko'p bo'sh qatorlar qo'shishadi
    const consecutiveNewlines = /\n\s*\n\s*\n/; // 3+ bo'sh qator ketma-ket
    if (consecutiveNewlines.test(message_text)) {
      // Count how many blank lines
      const blankLineGroups = message_text.match(/(\n\s*){3,}/g) || [];
      const maxConsecutive = blankLineGroups.length > 0
        ? Math.max(...blankLineGroups.map(g => (g.match(/\n/g) || []).length))
        : 0;

      return {
        shouldBlock: true,
        reason: `Ko'p bo'sh qatorlar (${maxConsecutive}ta ketma-ket)`,
        isDispatcher: true,
        autoBlock: false  // Admin tasdiq kutiladi
      };
    }

    // 3. User'ning guruh sonini tekshirish
    const groupCount = this.trackUserGroup(sender_user_id, group_id);
    if (groupCount > 15) {
      return {
        shouldBlock: true,
        reason: '15+ guruhda (professional dispatcher)',
        isDispatcher: true,
        autoBlock: false  // Admin tasdiq kutiladi
      };
    }

    // 4. Xabar chastotasini tekshirish (5 daqiqada 10+ xabar)
    const messageCount = this.trackUserMessage(sender_user_id);
    if (messageCount > 10) {
      return {
        shouldBlock: true,
        reason: 'Juda ko\'p xabar (spam)',
        isDispatcher: true,
        autoBlock: false  // Admin tasdiq kutiladi
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
