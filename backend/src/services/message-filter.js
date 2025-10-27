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
    this.phoneGroupTracker = new Map(); // phone -> { groups: Set, firstSeen: timestamp }
    this.userMessageHashes = new Map(); // user_id -> Set of message_hashes (dublikat tracking)

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

    // Ayollar ismlari ro'yxati (Dispatcher fake account'lar)
    this.femaleNames = [
      // Rus ayol ismlari
      'диана', 'diana', 'наташа', 'natasha', 'марина', 'marina', 'елена', 'elena', 'олга', 'olga',
      'светлана', 'svetlana', 'ирина', 'irina', 'татьяна', 'tatyana', 'анна', 'anna', 'мария', 'maria',
      'екатерина', 'ekaterina', 'юлия', 'julia', 'виктория', 'viktoria', 'алина', 'alina',
      'дарья', 'darya', 'полина', 'polina', 'кристина', 'kristina', 'анастасия', 'anastasia',
      'валентина', 'valentina', 'людмила', 'lyudmila', 'галина', 'galina', 'вера', 'vera',

      // O'zbek ayol ismlari
      'guli', 'gul', 'гули', 'гул', 'nigora', 'нигора', 'dilnoza', 'дильноза',
      'feruza', 'фируза', 'malika', 'малика', 'madina', 'мадина', 'nodira', 'нодира',
      'aziza', 'азиза', 'dildora', 'дилдора', 'nargiza', 'наргиза', 'shaxnoza', 'шахноза',

      // Boshqa ayol ismlari
      'angela', 'анжела', 'jessica', 'джессика', 'sophia', 'софия', 'isabella', 'изабелла',
      'victoria', 'виктория', 'natalia', 'наталья', 'katerina', 'катерина'
    ];

    // Ayol familyalari (dispatcher fake accounts)
    this.femaleSurnames = [
      // Rus ayol familyalari (-ova, -eva, -skaya, -aya tugashi)
      'ivanova', 'иванова', 'petrova', 'петрова', 'smirnova', 'смирнова',
      'kuznetsova', 'кузнецова', 'popova', 'попова', 'sokolova', 'соколова',
      'lebedeva', 'лебедева', 'kozlova', 'козлова', 'novikova', 'новикова',
      'morozova', 'морозова', 'volkova', 'волкова', 'solovyova', 'соловьёва',
      'vasilieva', 'васильева', 'zaitseva', 'зайцева', 'pavlova', 'павлова',
      'semyonova', 'семёнова', 'golubeva', 'голубева', 'vinogradova', 'виноградова',
      'bogdanova', 'богданова', 'vorobyova', 'воробьёва', 'fyodorova', 'фёдорова',
      'mikhailova', 'михайлова', 'belyaeva', 'беляева', 'tarasova', 'тарасова',
      'belova', 'белова', 'komarova', 'комарова', 'orlova', 'орлова',
      'medvedeva', 'медведева', 'egorova', 'егорова', 'romanova', 'романова',

      // O'zbek ayol familyalari (-va, -yeva tugashi)
      'karimova', 'каримова', 'rahimova', 'рахимова', 'abdullayeva', 'абдуллаева',
      'yusupova', 'юсупова', 'aliyeva', 'алиева', 'umarova', 'умарова',
      'ismoilova', 'исмоилова', 'sharipova', 'шарипова', 'nazarova', 'назарова',
      'ergasheva', 'эргашева', 'tursunova', 'турсунова', 'sultanova', 'султанова',
      'azimova', 'азимова', 'hasanova', 'хасанова', 'rashidova', 'рашидова',

      // Qozoq/Tojik ayol familyalari
      'ismailova', 'исмаилова', 'muratova', 'муратова', 'kasimova', 'касимова',
      'saidova', 'саидова', 'ahmedova', 'ахмедова', 'ibragimova', 'ибрагимова'
    ];

    console.log(`✅ Loaded ${this.femaleNames.length} female names + ${this.femaleSurnames.length} surnames for dispatcher detection`);

    // Whitelist user IDs (o'z session account va boshqalar)
    this.whitelistUserIds = [
      '8466237148', // Guli❤️ - Bizning session account
    ];

    console.log(`✅ Whitelist: ${this.whitelistUserIds.length} user ID`);

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
   * Check if username/fullname contains female name or surname (dispatcher fake account)
   */
  hasFemaleNameInProfile(username, fullName) {
    if (!username && !fullName) return false;

    const textToCheck = `${username || ''} ${fullName || ''}`.toLowerCase();

    // Check each female name
    for (const femaleName of this.femaleNames) {
      // Use word boundary to avoid partial matches
      // For example, "diana" should match "Diana Logistika" but not "indiana"
      const regex = new RegExp(`\\b${femaleName}\\b`, 'i');
      if (regex.test(textToCheck)) {
        return { found: true, name: femaleName, type: 'ism' };
      }
    }

    // Check each female surname
    for (const femaleSurname of this.femaleSurnames) {
      const regex = new RegExp(`\\b${femaleSurname}\\b`, 'i');
      if (regex.test(textToCheck)) {
        return { found: true, name: femaleSurname, type: 'familya' };
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
   * Telefon spam tekshirish (10 daqiqada 15+ guruhda bir xil raqam)
   * Dispatcherlar har xil e'lon yozadi lekin telefon raqami bir xil
   */
  isPhoneSpamming(phoneNumber, groupId) {
    if (!phoneNumber) return false;

    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;

    // Extract clean phone number (only digits)
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanPhone) return false;

    if (!this.phoneGroupTracker.has(cleanPhone)) {
      // First time seeing this phone
      this.phoneGroupTracker.set(cleanPhone, {
        groups: new Set([groupId]),
        firstSeen: now
      });
      return false;
    }

    const phoneData = this.phoneGroupTracker.get(cleanPhone);

    // Check if 10 minutes passed since first seen
    if (now - phoneData.firstSeen > tenMinutes) {
      // Reset tracking after 10 minutes
      this.phoneGroupTracker.set(cleanPhone, {
        groups: new Set([groupId]),
        firstSeen: now
      });
      return false;
    }

    // Add current group
    phoneData.groups.add(groupId);

    // Check if phone appeared in 15+ different groups
    if (phoneData.groups.size >= 15) {
      return true; // This is phone spam!
    }

    return false;
  }

  /**
   * Asosiy filter funksiyasi
   * @returns {Object} { shouldBlock: boolean, reason: string, isDispatcher: boolean }
   */
  checkMessage(messageData) {
    const { message_text, sender_user_id, sender_username, sender_full_name, group_id } = messageData;

    // WHITELIST: O'z session account va boshqa ishonchli userlar
    if (this.whitelistUserIds.includes(sender_user_id?.toString())) {
      return {
        shouldBlock: false,
        reason: 'Whitelist user',
        isDispatcher: false
      };
    }

    // DUBLIKAT TEKSHIRUVI: Bir xil xabarni ko'p guruhlarga spam qilish
    const messageHash = this.getMessageHash(message_text);

    if (!this.userMessageHashes.has(sender_user_id)) {
      this.userMessageHashes.set(sender_user_id, new Set());
    }

    const userHashes = this.userMessageHashes.get(sender_user_id);

    if (userHashes.has(messageHash)) {
      // Bu user bu xabarni allaqachon yuborgan (boshqa guruhda)
      return {
        shouldBlock: true,
        reason: 'Dublikat xabar (bir xil e\'lon ko\'p guruhlarda)',
        isDispatcher: true,
        autoBlock: true
      };
    }

    // Yangi xabar - hash'ni saqlash
    userHashes.add(messageHash);

    // Eski hash'larni tozalash (1000 tadan ko'p bo'lsa)
    if (userHashes.size > 1000) {
      const hashesArray = Array.from(userHashes);
      userHashes.clear();
      // Oxirgi 500 tasini saqlab qolish
      hashesArray.slice(-500).forEach(h => userHashes.add(h));
    }

    // 0. Username yoki full name'da kalit so'z bor mi?
    const keywordCheck = this.hasDispatcherKeywordsInProfile(sender_username, sender_full_name);
    if (keywordCheck.found) {
      return {
        shouldBlock: true,
        reason: `Username/Bio'da kalit so'z: "${keywordCheck.keyword}"`,
        isDispatcher: true,
        autoBlock: true  // Avtomatik bloklanadi
      };
    }

    // 0.0. YANGI: Ayol ismi yoki familyasi bor mi? (Dispatcher fake account)
    const femaleNameCheck = this.hasFemaleNameInProfile(sender_username, sender_full_name);
    if (femaleNameCheck.found) {
      const typeText = femaleNameCheck.type === 'familya' ? 'Ayol familyasi' : 'Ayol ismi';
      return {
        shouldBlock: true,
        reason: `${typeText} profilda: "${femaleNameCheck.name}" (dispatcher fake account)`,
        isDispatcher: true,
        autoBlock: true  // Avtomatik bloklanadi
      };
    }

    // 0.1. YANGI: Shubhali username/fullname tekshiruvi (uzun, spam, noodatiy belgilar)
    const suspiciousCheck = this.isSuspiciousProfile(sender_username, sender_full_name);
    if (suspiciousCheck.suspicious) {
      return {
        shouldBlock: true,
        reason: `Shubhali profil: ${suspiciousCheck.reason}`,
        isDispatcher: true,
        autoBlock: true  // Avtomatik bloklanadi
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
        autoBlock: true  // Avtomatik bloklanadi
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
        autoBlock: true  // Avtomatik bloklanadi
      };
    }

    // 2. Xabar uzunligi (200+ belgi = dispatcher)
    if (message_text.length > 200) {
      return {
        shouldBlock: true,
        reason: '200+ belgi (spam)',
        isDispatcher: true,
        autoBlock: true  // Avtomatik bloklanadi
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
        autoBlock: true  // Avtomatik bloklanadi
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
        autoBlock: true  // Avtomatik bloklanadi
      };
    }

    // 3. User'ning guruh sonini tekshirish
    const groupCount = this.trackUserGroup(sender_user_id, group_id);
    if (groupCount > 15) {
      return {
        shouldBlock: true,
        reason: '15+ guruhda (professional dispatcher)',
        isDispatcher: true,
        autoBlock: true  // Avtomatik bloklanadi
      };
    }

    // 4. Xabar chastotasini tekshirish (5 daqiqada 10+ xabar)
    const messageCount = this.trackUserMessage(sender_user_id);
    if (messageCount > 10) {
      return {
        shouldBlock: true,
        reason: 'Juda ko\'p xabar (spam)',
        isDispatcher: true,
        autoBlock: true  // Avtomatik bloklanadi
      };
    }

    // 5. YANGI: Telefon spam tekshirish (10 daqiqada 15+ guruhda bir xil raqam)
    // Dispatcherlar har xil e'lon yozadi, lekin telefon raqami bir xil
    // Avval xabardan telefon raqamni ajratib olamiz
    const phonePattern = /\+?998\d{9}|\+?7\d{10}|\b\d{9,12}\b/g;
    const phoneMatches = message_text.match(phonePattern);

    if (phoneMatches && phoneMatches.length > 0) {
      // Birinchi topilgan telefon raqamni olish
      const phoneNumber = phoneMatches[0];

      if (this.isPhoneSpamming(phoneNumber, group_id)) {
        const phoneData = this.phoneGroupTracker.get(phoneNumber.replace(/\D/g, ''));
        return {
          shouldBlock: true,
          reason: `Dispatcher telefon spam: ${phoneData.groups.size} ta guruhda (10 daqiqada)`,
          isDispatcher: true,
          autoBlock: true  // Avtomatik bloklanadi
        };
      }
    }

    // YANGI: Xabar matnida dispatcher kalit so'zlari tekshiruvi
    const dispatcherKeywords = [
      'диспечер керакмас',
      'диспетчер керакмас',
      'логист керакмас',
      'безота килмасин',
      'шартмас',
      'dispetchr kerakmas',
      'посредник',
      'фақат машина',
      'faqat mashina',
      'фақат шофер',
      'faqat shofer'
    ];

    const textLower = message_text ? message_text.toLowerCase() : '';
    for (const keyword of dispatcherKeywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        return {
          shouldBlock: true,
          reason: `Dispatcher kalit so'z xabarda: "${keyword}"`,
          isDispatcher: true,
          autoBlock: true  // Avtomatik bloklanadi
        };
      }
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
    const tenMinutes = 10 * 60 * 1000;

    // Clean old phone tracking data (older than 10 minutes)
    for (const [phone, data] of this.phoneGroupTracker.entries()) {
      if (now - data.firstSeen > tenMinutes) {
        this.phoneGroupTracker.delete(phone);
      }
    }

    // Clean old messages (if still needed for other purposes)
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

    console.log(`🧹 Cleanup: ${this.phoneGroupTracker.size} phones, ${this.userMessageCount.size} users tracked`);
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
