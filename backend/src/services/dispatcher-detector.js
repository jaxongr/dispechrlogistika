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

    // Telefon raqamni topish
    const phoneRegex = /(\+?998)?[\s-]?(\d{2})[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})/;
    const phoneMatch = messageText.match(phoneRegex);
    if (phoneMatch) {
      data.contact_phone = phoneMatch[0].trim();
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
    const priceRegex = /(\d+[\s,]?\d*)\s*(сум|so'm|uzs|\$|dollar|дол)/i;
    const priceMatch = messageText.match(priceRegex);
    if (priceMatch) {
      data.price = priceMatch[0].trim();
    }

    return data;
  }
}

module.exports = new DispatcherDetector();
