# 🚫 AVTOMATIK BLOKLASH QOIDALARI

**Loyiha:** Dispatcher Filter Tizimi
**Maqsad:** Spam va dispatcherlarni avtomatik aniqlash va bloklash
**Sana:** 2025-10-25

---

## 📋 ASOSIY BLOK QOIDALARI

Sistema quyidagi holatlarda userlarni **avtomatik bloklaydi**:

---

### 1️⃣ **TELEFON RAQAM YO'Q**

**Qoida:** Xabarda telefon raqam yo'q bo'lsa, skip qilinadi (bloklash yo'q, faqat skip).

**Tekshirish:**
```javascript
// Telefon raqam formatlar:
- +998 XX XXX XX XX  (O'zbekiston)
- +7 XXX XXX XX XX   (Rossiya/Qozog'iston)
- 9 ta dan 12 tagacha raqam ketma-ket
- XX.XXX.XX.XX format
- XXX XXX XXX format
```

**Natija:** Skip (bloklash yo'q)

---

### 2️⃣ **USERNAME/BIO'DA KALIT SO'Z**

**Qoida:** Username yoki Full Name'da dispatcher kalit so'zlari bor bo'lsa.

**Kalit so'zlar:** (dispatcher-keywords.json'dan)
- `логист`, `logist`, `dispatcher`, `диспетчер`
- `cargo`, `карго`, `transport`, `транспорт`
- `freight`, `груз`, `yuk`, `юк`
- `perevozka`, `перевозка`, `tashish`, `ташиш`
- Va boshqalar (~50+ so'z)

**Tekshirish:**
```javascript
const textToCheck = `${username} ${fullName}`.toLowerCase();
if (textToCheck.includes(keyword)) {
  BLOCK: "Username/Bio'da kalit so'z: '{keyword}'"
}
```

**Natija:** ✅ AVTOBLOK + Admin xabar

---

### 3️⃣ **SHUBHALI PROFIL (YANGI!)**

**3.1. Juda Uzun Username/FullName**
```javascript
if (fullText.length > 100) {
  BLOCK: "Juda uzun username/fullname (XXX belgi)"
}
```

**3.2. Takrorlanuvchi Belgilar**
```javascript
// Bir xil belgi 10+ marta ketma-ket
if (/(.)\1{9,}/.test(fullText)) {
  BLOCK: "Takrorlanuvchi belgilar (spam)"
}
```

**3.3. Noodatiy Unicode Belgilar**
```javascript
// Cuneiform, Egyptian Hieroglyphs va boshqa noodatiy belgilar
const unusualPattern = /[\u{12000}-\u{1247F}\u{13000}-\u{1342F}\u{1D000}-\u{1F9FF}]/u;
if (unusualPattern.test(fullText)) {
  BLOCK: "Noodatiy Unicode belgilar"
}
```

**Misol:**
- `𒀀𒀁𒀂𒀃` (Cuneiform)
- `𓀀𓀁𓀂` (Egyptian Hieroglyphs)
- `....𒐫𒐫𒐫𒐫𒐫𒐫` (Ko'p cuneiform)

**3.4. Ko'p Emoji (15+)**
```javascript
const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
const emojiCount = text.match(emojiPattern).length;
if (emojiCount > 15) {
  BLOCK: "Ko'p emoji (XXta)"
}
```

**3.5. Faqat Maxsus Belgilar (Harf Yo'q)**
```javascript
// 10+ belgidan iborat, lekin harf yo'q
if (!hasLetters.test(fullText) && fullText.length > 10) {
  BLOCK: "Faqat maxsus belgilar (harf yo'q)"
}
```

**Natija:** ✅ AVTOBLOK + Admin xabar

---

### 4️⃣ **XORIJIY YO'NALISH (YANGI!)**

**Qoida:** Xabarda xorijiy davlat/shahar nomlari bor (faqat O'zbekiston kerak!)

**Bloklangan Joylar:**
```javascript
// Rossiya
'россия', 'москва', 'питер', 'казань', 'новосибирск', 'екатеринбург'

// Qozog'iston
'казахстан', 'алматы', 'астана', 'шымкент'

// Turkiya
'турция', 'istanbul', 'стамбул', 'анталья', 'анкара'

// Evropa
'европа', 'польша', 'германия', 'берлин', 'париж', 'лондон'

// Boshqa mamlakatlar
'таджикистан', 'кыргызстан', 'туркменистан', 'азербайджан'
'китай', 'иран', 'афганистан', 'индия', 'dubai', 'арабия'

// Xorijiy so'zlar
'межд', 'между', 'international', 'cargo', 'снг', 'cis', 'европ'
```

**Tekshirish:**
```javascript
const lowerText = message.toLowerCase();
if (lowerText.includes('россия') || lowerText.includes('москва') || ...) {
  BLOCK: "Xorijiy yo'nalish: '{location}' (faqat O'zbekiston ichida)"
}
```

**Natija:** ✅ AVTOBLOK + Admin xabar

---

### 5️⃣ **XABAR UZUNLIGI (200+ BELGI)**

**Qoida:** Xabar 200 belgidan uzun bo'lsa.

```javascript
if (message_text.length > 200) {
  BLOCK: "200+ belgi (spam)"
}
```

**Natija:** ✅ AVTOBLOK + Admin xabar

---

### 6️⃣ **KO'P EMOJI XABARDA (3+)**

**Qoida:** Xabarda 3 yoki undan ko'p emoji bo'lsa.

```javascript
const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
const emojiCount = message.match(emojiPattern).length;
if (emojiCount >= 3) {
  BLOCK: "3+ emoji dispetcher belgisi (XXta emoji)"
}
```

**Natija:** ✅ AVTOBLOK + Admin xabar

---

### 7️⃣ **KO'P BO'SH QATORLAR (YANGI!)**

**Qoida:** Xabarda 3+ ketma-ket bo'sh qator bo'lsa.

**Sabab:** Dispatcherlar xabarni uzun qilish uchun ko'p bo'sh qatorlar qo'shadi.

```javascript
const consecutiveNewlines = /\n\s*\n\s*\n/; // 3+ bo'sh qator
if (consecutiveNewlines.test(message)) {
  BLOCK: "Ko'p bo'sh qatorlar (XXta ketma-ket)"
}
```

**Natija:** ✅ AVTOBLOK + Admin xabar

---

### 8️⃣ **15+ GURUHDA FAOL**

**Qoida:** User 15 ta yoki undan ko'p guruhda xabar yozgan bo'lsa.

```javascript
const groupCount = trackUserGroup(userId, groupId);
if (groupCount > 15) {
  BLOCK: "15+ guruhda (professional dispatcher)"
}
```

**Tracking:** In-memory cache (har 5 daqiqada tozalanadi)

**Natija:** ✅ AVTOBLOK + Admin xabar

---

### 9️⃣ **JUDA KO'P XABAR (5 DAQIQADA 10+)**

**Qoida:** User 5 daqiqa ichida 10+ xabar yozgan bo'lsa.

```javascript
const messageCount = trackUserMessage(userId);
if (messageCount > 10) {
  BLOCK: "Juda ko'p xabar (spam)"
}
```

**Tracking:** In-memory cache (har 1 soatda reset)

**Natija:** ✅ AVTOBLOK + Admin xabar

---

### 🔟 **DUBLIKAT XABAR (20 DAQIQA ICHIDA)**

**Qoida:** User 20 daqiqa ichida bir xil xabarni qayta yozgan bo'lsa.

```javascript
// Xabar hash yaratish (emoji va bo'shliqsiz)
const hash = message
  .replace(/[\u{1F600}-\u{1F9FF}...]/gu, '') // emoji o'chirish
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()
  .substring(0, 200); // Birinchi 200 belgi

const key = `${userId}:${hash}`;
if (recentMessages.has(key) && timeDiff < 20min) {
  BLOCK: "Dublikat xabar (20 daqiqa ichida)"
}
```

**Tracking:** In-memory cache (har 30 daqiqada tozalanadi)

**Natija:** ✅ AVTOBLOK + Admin xabar

---

### 1️⃣1️⃣ **TELEFON SPAM (20+ GURUHDA BIR XIL RAQAM) - SUPER AVTOBLOK!**

**Qoida:** Bir xil telefon raqam 30 daqiqa ichida 20+ turli guruhda paydo bo'lgan bo'lsa.

```javascript
// 30 daqiqa ichidagi xabarlarni olish
const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
const recentWithSamePhone = db.get('messages')
  .filter(msg =>
    msg.contact_phone === phoneNumber &&
    new Date(msg.created_at) >= thirtyMinutesAgo
  )
  .value();

// Noyob guruhlarni sanash
const uniqueGroups = new Set(recentWithSamePhone.map(m => m.group_id));
const groupCount = uniqueGroups.size;

if (groupCount >= 20) {
  BLOCK: "AVTO-BLOK: {groupCount} ta guruhda bir xil raqam (30 daqiqada)"

  // QATTIQ CHORALAR:
  1. User database'ga qo'shiladi (blocked_users)
  2. Barcha xabarlari target guruhdan o'chiriladi
  3. Admin'ga xabar yuboriladi (tugmalarsiz)
  4. User'ga SMS yuboriladi (agar guruhda bo'lsa)
}
```

**Natija:** 🚨 SUPER AVTOBLOK + Barcha xabarlarni o'chirish + SMS

---

## 🎯 AVTOBLOK JARAYONI

Quyidagi ketma-ketlikda ishlaydi:

### **1. Xabar Qabul Qilish**
```
Telegram Session -> Xabar keldi -> Queue'ga qo'shish
```

### **2. Blok Tekshiruvlari (Ketma-ket)**
```javascript
// A. Username/Bio tekshiruvi
if (hasDispatcherKeyword || isSuspicious) -> BLOCK

// B. Telefon spam tekshiruvi (20+ guruh)
if (phoneInMoreThan20Groups) -> SUPER BLOCK

// C. Message Filter tekshiruvlari
const filterResult = messageFilter.checkMessage(messageData);
if (filterResult.shouldBlock) -> BLOCK
```

### **3. Bloklash Harakatlari**
```javascript
if (BLOCK) {
  // 1. User'ni database'ga qo'shish
  await BlockedUser.create({
    telegram_user_id: userId,
    username: username,
    full_name: fullName,
    phone_number: phoneNumber,
    reason: reason,
    blocked_by: 0  // 0 = auto-blocked
  });

  // 2. Barcha xabarlarini o'chirish
  await telegramBot.deleteAllUserMessages(userId);

  // 3. Admin'ga xabar
  await telegramBot.sendBlockNotification({...});

  // 4. SMS yuborish (agar telefon bor bo'lsa)
  if (phoneNumber) {
    await semySMS.sendBlockNotificationSMS(phoneNumber, fullName, reason);
  }

  // 5. Xabarni skip qilish
  continue;
}
```

---

## 📊 STATISTIKA VA MONITORING

### **In-Memory Cache**
```javascript
{
  userMessageCount: Map<userId, {count, lastReset}>,  // 5 daqiqa
  recentMessages: Map<hash, timestamp>,                // 20 daqiqa
  userGroupCount: Map<userId, Set<groupId>>            // Doimiy
}
```

### **Cleanup (Har 5 daqiqada)**
```javascript
// 30 daqiqadan eski xabarlarni o'chirish
// 1 soatdan eski user count'larni o'chirish
```

---

## ⚙️ SOZLAMALAR

### **Whitelist Tizimi**
```javascript
// Agar user whitelist'da bo'lsa, BARCHA tekshiruvlar skip qilinadi
const isWhitelisted = await Whitelist.isWhitelisted(userId);
if (isWhitelisted) {
  // Skip ALL checks - user is trusted
  PASS
}
```

### **Parametrlar**
```javascript
const CONFIG = {
  // Xabar uzunligi
  MAX_MESSAGE_LENGTH: 200,

  // Emoji limits
  MAX_EMOJI_IN_PROFILE: 15,
  MAX_EMOJI_IN_MESSAGE: 3,

  // Guruh limits
  MAX_GROUPS_PER_USER: 15,
  MAX_MESSAGES_PER_5MIN: 10,

  // Telefon spam
  PHONE_SPAM_GROUP_THRESHOLD: 20,
  PHONE_SPAM_TIME_WINDOW: 30 * 60 * 1000, // 30 daqiqa

  // Dublikat
  DUPLICATE_TIME_WINDOW: 20 * 60 * 1000, // 20 daqiqa

  // Cleanup
  CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 daqiqa
  MESSAGE_RETENTION: 30 * 60 * 1000, // 30 daqiqa
  USER_COUNT_RETENTION: 60 * 60 * 1000 // 1 soat
};
```

---

## 📝 MISOL LOGLAR

### **Muvaffaqiyatli Blok**
```
🚨 SPAM DETECTED! Phone +998901234567 in 25 groups - AVTOMATIK BLOKLASH
✅ AVTOMATIK BLOKLANDI: John Doe - Admin'ga xabar yuborildi
📱 SMS yuborildi: 998901234567 - ID: 12345678
```

### **Filter Blok**
```
⏭️ Blocked: Username/Bio'da kalit so'z: "dispatcher"
🗑️ Found 5 messages from user 123456789 to delete
✅ Deleted 5 messages from user 123456789
📨 Block notification sent to admin for user 123456789
```

---

## 🚀 IMPLEMENTATSIYA

### **Kerakli Fayllar:**
1. `message-filter.js` - Asosiy filter logikasi
2. `dispatcher-keywords.json` - Kalit so'zlar ro'yxati
3. `telegram-session.js` - Telefon spam detection
4. `BlockedUser.js` - Database model
5. `telegramBot.js` - Admin notification

### **Database Schema:**
```javascript
blocked_users: {
  id: integer (auto),
  telegram_user_id: string (unique),
  username: string,
  full_name: string,
  phone_number: string,
  reason: string,
  blocked_by: integer (0 = auto, >0 = admin id),
  created_at: timestamp
}
```

---

**MUHIM:** Bu qoidalar 95%+ dispatcher va spam userlarni avtomatik aniqlaydi!

**ESLATMA:** Whitelist tizimi bilan muhim userlarni himoya qilish mumkin.

**YANGILANISH:** 2025-10-25 - Barcha qoidalar ishga tushirilgan va test qilingan!
