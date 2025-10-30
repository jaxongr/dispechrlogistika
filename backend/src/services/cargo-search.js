/**
 * Cargo Search Service
 * Yuk qidirish xizmati - O'zbekiston bo'ylab yo'nalishlar bo'yicha qidirish
 */

const { db } = require('../config/database');
const locationsData = require('../data/locations.json');

class CargoSearchService {
  constructor() {
    this.locations = locationsData.regions;
    // Tezkor qidiruv uchun keyword index
    this.keywordIndex = this.buildKeywordIndex();
  }

  /**
   * Keyword index yaratish (har bir kalit so'z uchun region)
   */
  buildKeywordIndex() {
    const index = new Map();

    Object.entries(this.locations).forEach(([regionKey, regionData]) => {
      // Region nomi
      index.set(regionData.name.toLowerCase(), regionKey);

      // Barcha keywords
      regionData.keywords.forEach(keyword => {
        index.set(keyword.toLowerCase(), regionKey);
      });

      // Districts
      if (regionData.districts) {
        regionData.districts.forEach(district => {
          index.set(district.toLowerCase(), regionKey);
        });
      }
    });

    return index;
  }

  /**
   * Matndan yo'nalishni topish (fuzzy matching)
   */
  findLocation(text) {
    if (!text) return null;

    const textLower = text.toLowerCase().trim();

    // 1. To'g'ridan-to'g'ri mos kelish
    if (this.keywordIndex.has(textLower)) {
      return this.keywordIndex.get(textLower);
    }

    // 2. Qisman mos kelish (substring)
    for (const [keyword, regionKey] of this.keywordIndex.entries()) {
      if (textLower.includes(keyword) || keyword.includes(textLower)) {
        return regionKey;
      }
    }

    // 3. So'zlar bo'yicha qidirish
    const words = textLower.split(/\s+/);
    for (const word of words) {
      if (word.length < 3) continue; // Juda qisqa so'zlarni o'tkazib yuborish

      for (const [keyword, regionKey] of this.keywordIndex.entries()) {
        if (keyword.includes(word) || word.includes(keyword)) {
          return regionKey;
        }
      }
    }

    return null;
  }

  /**
   * Xabardagi yo'nalishlarni topish (from -> to)
   */
  extractRouteFromMessage(messageText) {
    if (!messageText) return null;

    const text = messageText.toLowerCase();

    // Yo'nalish belgilarini qidirish: "dan", "ga", "→", "-", "=>", "ga"
    const routePatterns = [
      /(.+?)(дан|dan|dan|дон|don)\s*(.+?)(га|ga|га|ga)/i,
      /(.+?)\s*(→|->|=>|—|–)\s*(.+)/i,
      /(.+?)\s+(ga|га)\s+(.+)/i
    ];

    for (const pattern of routePatterns) {
      const match = text.match(pattern);
      if (match) {
        let fromText, toText;

        if (pattern.source.includes('дан')) {
          fromText = match[1].trim();
          toText = match[3].trim();
        } else {
          fromText = match[1].trim();
          toText = match[3] ? match[3].trim() : match[2].trim();
        }

        const fromLocation = this.findLocation(fromText);
        const toLocation = this.findLocation(toText);

        if (fromLocation || toLocation) {
          return {
            from: fromLocation,
            to: toLocation,
            fromText,
            toText
          };
        }
      }
    }

    // Agar yo'nalish topilmasa, matndan birorta shahar nomini qidirish
    const foundLocation = this.findLocation(text);
    if (foundLocation) {
      return {
        from: foundLocation,
        to: null,
        fromText: text,
        toText: null
      };
    }

    return null;
  }

  /**
   * Oxirgi 3 soatdagi xabarlarni olish
   */
  getRecentMessages(hoursAgo = 3) {
    const threeHoursAgo = new Date();
    threeHoursAgo.setHours(threeHoursAgo.getHours() - hoursAgo);

    const messages = db.get('messages').value() || [];

    return messages.filter(msg => {
      if (!msg.created_at) return false;
      const msgDate = new Date(msg.created_at);
      return msgDate >= threeHoursAgo && msg.sent_to_group === true;
    });
  }

  /**
   * A -> B yo'nalish bo'yicha qidirish (ikki tomonlama)
   */
  searchTwoWayRoute(fromLocation, toLocation) {
    const recentMessages = this.getRecentMessages();
    const results = [];

    for (const msg of recentMessages) {
      const route = this.extractRouteFromMessage(msg.message_text);

      if (!route) continue;

      // A -> B yoki B -> A
      const matchesForward = route.from === fromLocation && route.to === toLocation;
      const matchesBackward = route.from === toLocation && route.to === fromLocation;

      if (matchesForward || matchesBackward) {
        results.push({
          ...msg,
          route: route,
          direction: matchesForward ? 'forward' : 'backward',
          timeAgo: this.getTimeAgo(msg.created_at)
        });
      }
    }

    // Eng yangilarini birinchi qilib sort qilish
    return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  /**
   * A -> ? (ixtiyoriy) yo'nalish bo'yicha qidirish
   */
  searchFromLocation(fromLocation) {
    const recentMessages = this.getRecentMessages();
    const results = [];

    for (const msg of recentMessages) {
      const route = this.extractRouteFromMessage(msg.message_text);

      if (!route) continue;

      // Faqat "from" mos kelishi kerak
      if (route.from === fromLocation) {
        results.push({
          ...msg,
          route: route,
          timeAgo: this.getTimeAgo(msg.created_at)
        });
      }
    }

    // Eng yangilarini birinchi qilib sort qilish
    return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  /**
   * Qancha vaqt oldin (human-readable)
   */
  getTimeAgo(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Hozirgina';
    if (diffMins < 60) return `${diffMins} daqiqa oldin`;
    if (diffHours < 3) return `${diffHours} soat ${diffMins % 60} daqiqa oldin`;
    return `${diffHours} soat oldin`;
  }

  /**
   * Natijalarni format qilish (Telegram uchun)
   */
  formatResults(results, searchType, fromLocation, toLocation = null) {
    if (results.length === 0) {
      const fromName = this.locations[fromLocation]?.name || fromLocation;
      const toName = toLocation ? this.locations[toLocation]?.name : 'har qanday yo\'nalish';

      return `❌ Afsuski, oxirgi 3 soat ichida <b>${fromName}</b> → <b>${toName}</b> yo'nalishi bo'yicha e'lonlar topilmadi.\n\n💡 Keyinroq qayta urinib ko'ring yoki boshqa yo'nalishni qidiring.`;
    }

    const fromName = this.locations[fromLocation]?.name || fromLocation;
    const toName = toLocation ? this.locations[toLocation]?.name : '';

    let message = searchType === 'two-way'
      ? `🔍 <b>${fromName} ↔️ ${toName}</b> yo'nalishi bo'yicha e'lonlar:\n\n`
      : `🔍 <b>${fromName} → ?</b> yo'nalishi bo'yicha e'lonlar:\n\n`;

    message += `📊 Jami topildi: <b>${results.length} ta</b> e'lon\n`;
    message += `⏰ Oxirgi 3 soat ichida\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Faqat birinchi 10 ta natijani ko'rsatish
    const limitedResults = results.slice(0, 10);

    limitedResults.forEach((result, index) => {
      const routeFrom = this.locations[result.route.from]?.name || result.route.fromText;
      const routeTo = result.route.to ? (this.locations[result.route.to]?.name || result.route.toText) : '?';

      message += `${index + 1}. `;

      if (searchType === 'two-way' && result.direction === 'backward') {
        message += `🔄 <b>${routeFrom} → ${routeTo}</b>\n`;
      } else {
        message += `🚛 <b>${routeFrom} → ${routeTo}</b>\n`;
      }

      // Xabar matni (maksimal 150 belgi)
      let text = result.message_text || '';
      if (text.length > 150) {
        text = text.substring(0, 150) + '...';
      }
      message += `📝 ${text}\n`;

      // Telefon raqam
      if (result.contact_phone) {
        message += `📞 ${result.contact_phone}\n`;
      }

      // Vaqt
      message += `⏰ ${result.timeAgo}\n\n`;
    });

    if (results.length > 10) {
      message += `\n... va yana <b>${results.length - 10} ta</b> e'lon\n`;
    }

    message += `\n💡 <i>E'lon beruvchi bilan bog'lanish uchun telefon raqamdan foydalaning</i>`;

    return message;
  }

  /**
   * Get all location names (for autocomplete/keyboard)
   */
  getAllLocationNames() {
    return Object.values(this.locations).map(loc => loc.name);
  }

  /**
   * Get location name by key
   */
  getLocationName(locationKey) {
    return this.locations[locationKey]?.name || locationKey;
  }
}

// Export single instance
module.exports = new CargoSearchService();
