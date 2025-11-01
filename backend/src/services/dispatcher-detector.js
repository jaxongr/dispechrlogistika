/**
 * Dispatcher Detection Service
 *
 * Dispetcherlarni aniqlash uchun rule-based algoritm.
 * Quyidagi belgilar bo'yicha tekshiriladi:
 *
 * 1. "Диспечер керакмас" yoki shunga o'xshash matnlar
 * 2. Bir nechta telefon raqamlar (ko'pincha dispetcherlar ko'p raqam beradi)
 * 3. Ko'p emoji va "срочно" so'zlari
 * 4. "Логист" so'zi
 * 5. Formatlangan xabarlar (ko'pincha dispetcherlar template ishlatadi)
 */

class DispatcherDetector {
  constructor() {
    // Dispetcher indikatorlari (keywords)
    this.dispatcherKeywords = [
      'диспечер',
      'диспетчер',
      'логист',
      'dispechir',
      'dispetcher',
      'дисп',
      'безота килмасин',
      'шардмас',
      'шартмас',
      'керакмас',
      'kerakmas',
      'безота',
      'безотар',
      'посредник',
      'посредниклар',
      'iltimos.*kerakmas',
      'просьба.*не беспокоить'
    ];

    // Yuk egasi indikatorlari
    this.ownerKeywords = [
      'фахат шоферлар',
      'только водител',
      'faqat haydovchi',
      'faqat shofer',
      'шофер билан',
      'водител билан',
      'юк бор',
      'yuk bor',
      'груз есть'
    ];

    // Threshold (chegaralar)
    this.thresholds = {
      dispatcherScore: 0.7,  // Bu ball dan yuqori bo'lsa dispetcher
      ownerScore: 0.5        // Bu ball dan yuqori bo'lsa yuk egasi
    };
  }

  /**
   * Xabarni tahlil qiladi va dispetcher ekanligini aniqlaydi
   * @param {string} messageText - Tahlil qilinadigan xabar matni
   * @param {Object} metadata - Qo'shimcha ma'lumotlar (sender info, etc)
   * @returns {Object} - {isDispatcher: boolean, confidence: number, reasons: []}
   */
  analyze(messageText, metadata = {}) {
    const text = messageText.toLowerCase();
    let dispatcherScore = 0;
    let ownerScore = 0;
    const reasons = [];

    // 1. Dispetcher keywordlarini tekshirish
    let keywordMatches = 0;
    this.dispatcherKeywords.forEach(keyword => {
      const regex = new RegExp(keyword, 'i');
      if (regex.test(text)) {
        keywordMatches++;
        dispatcherScore += 0.3;
        reasons.push(`Dispetcher keyword topildi: "${keyword}"`);
      }
    });

    // 2. Yuk egasi keywordlarini tekshirish (minus ball)
    this.ownerKeywords.forEach(keyword => {
      const regex = new RegExp(keyword, 'i');
      if (regex.test(text)) {
        ownerScore += 0.3;
        dispatcherScore -= 0.2;
        reasons.push(`Yuk egasi keyword topildi: "${keyword}"`);
      }
    });

    // 3. Telefon raqamlarni sanash
    const phoneRegex = /(\+998|998)?\s?(\d{2})\s?(\d{3})\s?(\d{2})\s?(\d{2})|(\d{9})/g;
    const phones = text.match(phoneRegex) || [];

    if (phones.length > 3) {
      dispatcherScore += 0.4;
      reasons.push(`Ko'p telefon raqamlar topildi: ${phones.length}ta`);
    } else if (phones.length === 1 || phones.length === 2) {
      ownerScore += 0.2;
    }

    // 4. Emoji miqdorini tekshirish
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const emojis = text.match(emojiRegex) || [];

    if (emojis.length > 10) {
      dispatcherScore += 0.2;
      reasons.push(`Ko'p emojilar: ${emojis.length}ta`);
    }

    // 5. "СРОЧНО" so'zini tekshirish (ko'p marta takrorlanishi)
    const urgentRegex = /(срочно|срочни|срочна|zudlik|tezkor)/gi;
    const urgentMatches = text.match(urgentRegex) || [];

    if (urgentMatches.length > 5) {
      dispatcherScore += 0.3;
      reasons.push(`Ko'p "срочно" so'zlari: ${urgentMatches.length}ta`);
    }

    // 6. Xabar uzunligi va formatlanish
    const lines = messageText.split('\n').filter(l => l.trim());

    // Juda ko'p yo'nalishlar (bir xabarda 5+ marshurt)
    const routeRegex = /[🇷🇺🇺🇿🇰🇿🇧🇾🇹🇯]/g;
    const routeFlags = text.match(routeRegex) || [];

    if (routeFlags.length > 10 || lines.length > 30) {
      dispatcherScore += 0.3;
      reasons.push('Ko\'p yo\'nalishlar bitta xabarda');
    }

    // 7. Takroriy xabar formatlari (template ishlatish)
    if (text.includes('┈') || text.includes('━') || text.includes('═')) {
      dispatcherScore += 0.15;
      reasons.push('Template/formatlangan xabar');
    }

    // 8. Ko'p shahar nomlari
    const cities = ['москва', 'ташкент', 'самарканд', 'бухара', 'наманган', 'андижон',
                    'фергана', 'хорезм', 'навои', 'минск', 'алмата', 'душанбе'];
    let cityCount = 0;
    cities.forEach(city => {
      if (text.includes(city)) cityCount++;
    });

    if (cityCount > 10) {
      dispatcherScore += 0.2;
      reasons.push(`Juda ko'p shahar nomlari: ${cityCount}ta`);
    }

    // Final hisoblash
    const isDispatcher = dispatcherScore >= this.thresholds.dispatcherScore &&
                        dispatcherScore > ownerScore;
    const confidence = Math.min(Math.max(dispatcherScore, 0), 1);

    return {
      isDispatcher,
      confidence: parseFloat(confidence.toFixed(2)),
      dispatcherScore: parseFloat(dispatcherScore.toFixed(2)),
      ownerScore: parseFloat(ownerScore.toFixed(2)),
      reasons,
      phoneCount: phones.length,
      emojiCount: emojis.length,
      lineCount: lines.length
    };
  }

  /**
   * Xabar matnidan logistika ma'lumotlarini ajratib olish
   * @param {string} messageText
   * @returns {Object} - Ajratilgan ma'lumotlar
   */
  extractLogisticsData(messageText) {
    const data = {
      route_from: null,
      route_to: null,
      cargo_type: null,
      weight: null,
      vehicle_type: null,
      contact_phone: null,
      price: null
    };

    // 🚀 COMPREHENSIVE PHONE NUMBER EXTRACTION - 1000+ FORMAT VARIATIONS
    // Barcha O'zbekiston telefon raqam formatlarini qo'llab-quvvatlaydi

    // Separator patterns - har xil belgilar (bo'shliq, nuqta, tire, qavs, va boshqalar)
    const sep = '[\\s\\.\\-\\_\\,\\(\\)\\[\\]\\{\\}\\|\\\\\\//]*'; // Flexible separator
    const sepReq = '[\\s\\.\\-\\_\\,\\(\\)\\[\\]\\{\\}\\|\\\\\\//]+'; // At least one separator

    // Build dynamic patterns using RegExp constructor for proper variable interpolation
    const phonePatterns = [
      // =====================================================
      // GROUP 1: +998 yoki 998 bilan (12 raqamli)
      // =====================================================

      // +998 90 123 45 67 (bo'shliq bilan) - using RegExp for proper interpolation
      new RegExp(`\\+?998${sep}(\\d{2})${sepReq}(\\d{3})${sepReq}(\\d{2})${sepReq}(\\d{2})`, 'g'),

      // +998 90 123 4567 (3-4 format)
      new RegExp(`\\+?998${sep}(\\d{2})${sepReq}(\\d{3})${sepReq}(\\d{4})`, 'g'),

      // +998 90 1234567 (2-7 format)
      new RegExp(`\\+?998${sep}(\\d{2})${sepReq}(\\d{7})`, 'g'),

      // +998 901234567 (bo'shliqsiz)
      new RegExp(`\\+?998${sep}(\\d{9})`, 'g'),

      // +998(90)123-45-67, +998.90.123.45.67, +998-90-123-45-67
      new RegExp(`\\+?998${sep}(\\d{2})${sep}(\\d{3})${sep}(\\d{2})${sep}(\\d{2})`, 'g'),

      // =====================================================
      // GROUP 2: 9 raqamli formatlar (operator code bilan)
      // O'zbekiston operator kodlari: 20, 33, 50, 55, 61-69, 71, 74-79, 88, 90-99
      // =====================================================

      // 20 007 00 58 (20 operator kodi bilan) - UMS, Perfectum
      new RegExp(`(?<!\\d)(20)${sepReq}(\\d{3})${sepReq}(\\d{2})${sepReq}(\\d{2})(?!\\d)`, 'g'),
      new RegExp(`(?<!\\d)(20)${sepReq}(\\d{3})${sepReq}(\\d{4})(?!\\d)`, 'g'),
      new RegExp(`(?<!\\d)(20)${sepReq}(\\d{7})(?!\\d)`, 'g'),
      /(?<!\d)(20\d{7})(?!\d)/g,

      // 90 123 45 67 (bo'shliq bilan, 2-3-2-2 format) ⭐ USER'S EXAMPLE: "88 149 04 07"
      new RegExp(`(?<!\\d)([3-9]\\d)${sepReq}(\\d{3})${sepReq}(\\d{2})${sepReq}(\\d{2})(?!\\d)`, 'g'),

      // 90 123 4567 (2-3-4 format)
      new RegExp(`(?<!\\d)([3-9]\\d)${sepReq}(\\d{3})${sepReq}(\\d{4})(?!\\d)`, 'g'),

      // 90 1234567 (2-7 format)
      new RegExp(`(?<!\\d)([3-9]\\d)${sepReq}(\\d{7})(?!\\d)`, 'g'),

      // 901234567 (9 raqam bo'shliqsiz)
      /(?<!\d)([3-9]\d\d{7})(?!\d)/g,

      // 90-123-45-67, 90.123.45.67, 90_123_45_67
      new RegExp(`(?<!\\d)(\\(?\\d{2}\\)?${sep}\\d{3}${sep}\\d{2}${sep}\\d{2})(?!\\d)`, 'g'),

      // =====================================================
      // GROUP 3: Maxsus formatlar va edge cases
      // =====================================================

      // Format: 9-0-1-2-3-4-5-6-7 (har bir raqam ajratilgan)
      new RegExp(`(?<!\\d)([3-9])${sep}(\\d)${sep}(\\d)${sep}(\\d)${sep}(\\d)${sep}(\\d)${sep}(\\d)${sep}(\\d)${sep}(\\d)(?!\\d)`, 'g'),

      // Format: 9 0 1 2 3 4 5 6 7 (bo'shliq bilan har bir raqam)
      /(?<!\d)([3-9])\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)(?!\d)/g,

      // Format: 901 234 567 (3-3-3)
      new RegExp(`(?<!\\d)([3-9]\\d{2})${sepReq}(\\d{3})${sepReq}(\\d{3})(?!\\d)`, 'g'),

      // Format: 9012 34567 (4-5)
      new RegExp(`(?<!\\d)([3-9]\\d{3})${sepReq}(\\d{5})(?!\\d)`, 'g'),

      // Format: 90123 4567 (5-4)
      new RegExp(`(?<!\\d)([3-9]\\d{4})${sepReq}(\\d{4})(?!\\d)`, 'g'),

      // =====================================================
      // GROUP 4: Mixed separator formatlar
      // =====================================================

      // 90.123-45 67, 90-123.45-67, 90 123-45.67 (aralash separatorlar)
      /(?<!\d)([3-9]\d)[\s\.\-]+(\d{3})[\s\.\-]+(\d{2})[\s\.\-]+(\d{2})(?!\d)/g,

      // (90) 123 45 67, [90] 123-45-67
      new RegExp(`(?<!\\d)[\\(\\[]([3-9]\\d)[\\)\\]]${sep}(\\d{3})${sep}(\\d{2})${sep}(\\d{2})(?!\\d)`, 'g'),

      // =====================================================
      // GROUP 5: Leading zero yoki prefix bilan
      // =====================================================

      // 0901234567, 0-90-123-45-67 (0 bilan boshlanadi)
      new RegExp(`(?<!\\d)0${sep}([3-9]\\d)${sep}(\\d{3})${sep}(\\d{2})${sep}(\\d{2})(?!\\d)`, 'g'),
      new RegExp(`(?<!\\d)0${sep}([3-9]\\d)${sep}(\\d{7})(?!\\d)`, 'g'),
      /(?<!\d)0([3-9]\d\d{7})(?!\d)/g,

      // =====================================================
      // GROUP 6: Unicode va maxsus belgilar
      // =====================================================

      // Telefon emojisi yonida: 📞 901234567, ☎️ 90 123 45 67
      new RegExp(`[📞☎️📱📲]${sep}(\\+?998)?${sep}([3-9]\\d)${sep}(\\d{3})${sep}(\\d{2})${sep}(\\d{2})`, 'g'),
      new RegExp(`[📞☎️📱📲]${sep}(\\+?998)?${sep}([3-9]\\d\\d{7})`, 'g'),

      // Tel: 901234567, Phone: 90 123 45 67, Тел: 901234567
      new RegExp(`(?:tel|phone|telefon|тел|телефон)[:\\s]+(\\+?998)?${sep}([3-9]\\d)${sep}(\\d{3})${sep}(\\d{2})${sep}(\\d{2})`, 'gi'),
      new RegExp(`(?:tel|phone|telefon|тел|телефон)[:\\s]+(\\+?998)?${sep}([3-9]\\d\\d{7})`, 'gi'),

      // =====================================================
      // GROUP 7: Anchor va URL formatlar
      // =====================================================

      // <a href="tel:+998901234567">
      /tel:(\+?998)?([3-9]\d\d{7})/gi,

      // =====================================================
      // GROUP 8: Barcha qolgan 9 raqamli kombinatsiyalar
      // =====================================================

      // Juda flexible pattern - har qanday separator bilan 9 ta raqam
      /(?<!\d)([3-9]\d)[\s\.\-\(\)]*(\d)[\s\.\-\(\)]*(\d)[\s\.\-\(\)]*(\d)[\s\.\-\(\)]*(\d)[\s\.\-\(\)]*(\d)[\s\.\-\(\)]*(\d)[\s\.\-\(\)]*(\d)[\s\.\-\(\)]*(\d)(?!\d)/g,
    ];

    let phoneNumbers = [];

    // Process each pattern
    for (const pattern of phonePatterns) {
      const matches = messageText.matchAll(pattern);
      for (const match of matches) {
        const rawPhone = match[0];

        // Faqat raqamlarni qoldirish (barcha separatorlarni olib tashlash)
        let digitsOnly = rawPhone.replace(/\D/g, '');

        // Leading 0 ni olib tashlash (0901234567 -> 901234567)
        if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
          digitsOnly = digitsOnly.substring(1);
        }

        // VALIDATION: O'zbekiston operator kodlarini tekshirish
        // Valid operator codes: 20, 33, 50, 55, 61-69, 71, 74-79, 88, 90-99
        const validOperatorCodes = [
          '20', // UMS, Perfectum
          '33', '50', '55',
          '61', '62', '65', '66', '67', '69',
          '71', '74', '75', '76', '77', '78', '79',
          '88',
          '90', '91', '93', '94', '95', '97', '98', '99'
        ];

        let normalizedPhone = null;

        // CASE 1: 9 raqamli (operator code + 7 raqam)
        if (digitsOnly.length === 9) {
          const operatorCode = digitsOnly.substring(0, 2);
          if (validOperatorCodes.includes(operatorCode)) {
            normalizedPhone = '998' + digitsOnly;
          }
        }

        // CASE 2: 12 raqamli (998 + 9 raqam)
        else if (digitsOnly.length === 12 && digitsOnly.startsWith('998')) {
          const operatorCode = digitsOnly.substring(3, 5);
          if (validOperatorCodes.includes(operatorCode)) {
            normalizedPhone = digitsOnly;
          }
        }

        // CASE 3: 11 raqamli (98 + 9 raqam - birinchi 9 tushib ketgan)
        else if (digitsOnly.length === 11 && digitsOnly.startsWith('98')) {
          const operatorCode = digitsOnly.substring(2, 4);
          if (validOperatorCodes.includes(operatorCode)) {
            normalizedPhone = '9' + digitsOnly;
          }
        }

        // CASE 4: 10 raqamli (0 + 9 raqam)
        else if (digitsOnly.length === 10 && digitsOnly.startsWith('0')) {
          const operatorCode = digitsOnly.substring(1, 3);
          if (validOperatorCodes.includes(operatorCode)) {
            normalizedPhone = '998' + digitsOnly.substring(1);
          }
        }

        if (normalizedPhone) {
          phoneNumbers.push(normalizedPhone);
        }
      }
    }

    // Birinchi topilgan telefon raqamni olish va +998 formatida saqlash
    if (phoneNumbers.length > 0) {
      // Dublikatlarni olib tashlash
      phoneNumbers = [...new Set(phoneNumbers)];
      // +998 qo'shish
      data.contact_phone = '+' + phoneNumbers[0];
    }

    // Og'irlikni topish (tonna)
    const weightRegex = /(\d+[\.,]?\d*)\s*(т|тонн|tonna|ton)/i;
    const weightMatch = messageText.match(weightRegex);
    if (weightMatch) {
      data.weight = weightMatch[0].trim();
    }

    // Transport turini topish
    const vehicleTypes = ['фура', 'тент', 'реф', 'рефка', 'исузи', 'isuzu', 'mega', 'мега',
                          'kонтейнер', 'контейнер', 'kantainer', 'борт'];
    for (const vehicle of vehicleTypes) {
      const regex = new RegExp(vehicle, 'i');
      if (regex.test(messageText)) {
        data.vehicle_type = vehicle;
        break;
      }
    }

    // Narxni topish
    const priceRegex = /(\d+[\s,]?\d*)\s*(сум|so'm|uzs|$|dollar|дол)/i;
    const priceMatch = messageText.match(priceRegex);
    if (priceMatch) {
      data.price = priceMatch[0].trim();
    }

    return data;
  }
}

module.exports = new DispatcherDetector();
