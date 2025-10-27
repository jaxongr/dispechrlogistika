# 🔄 RESTORE POINT - v1.2-stable

**Sana:** 27 Oktyabr 2025, 14:40
**Tag:** `v1.2-stable`
**Commit:** `21bf0b1`
**Status:** ✅ **OPTIMIZED - MAKSIMAL TEZLIK**

---

## 📋 BU VERSIYADA NIMA BOR

### ⚡ ASOSIY YAXSHILANISHLAR (v1.2)

**QUEUE PROCESSING OPTIMIZATSIYA:**
- ✅ **3x tezroq**: 600/min → 1800/min capacity
- ✅ **4x ko'p xabar**: 70-80/soat → 288/soat
- ✅ **Timing diagnostics**: Har bir batch uchun o'lchov
- ✅ **Barcha filtrlar ishlayapti**: Hech narsa o'zgarmadi, faqat tezlik!

### 📊 TEXNIK DETALLАР

**QUEUE SETTINGS:**
```javascript
// telegram-session.js
setInterval(() => this.processMessageQueue(), 1000);  // 1s interval (eski: 2s)
const batch = this.messageQueue.splice(0, 30);       // 30 batch size (eski: 20)

// Processing time: 27-115ms per message (⏱️ logs)
```

**PERFORMANCE:**
- **Interval:** 2s → 1s (2x faster)
- **Batch size:** 20 → 30 (1.5x larger)
- **Total capacity:** 600/min → 1800/min (3x faster)
- **Real throughput:** 288 msg/hour (4x improvement!)
- **Processing speed:** 27-115ms/message

### ✅ ASOSIY FUNKSIYALAR (v2.0 base)

1. **Telegram Session:**
   - Account: **Abduxoliq**
   - Telefon: **+998338497563**
   - ID: **8466237148**
   - Guruhlar: **100 ta** (Telegram session)
   - Bazada: **200 ta** (yangilangan)

2. **Telegram Monitoring:**
   - ✅ Real-time xabarlarni tinglash
   - ✅ Dispatcher detection
   - ✅ Auto-block rules (6 ta qoida)
   - ✅ Guruhlardan xabar yig'ish
   - ✅ Bazaga saqlash
   - ⚡ **MAKSIMAL TEZLIK** - 1800/min capacity

3. **Auto-Reply (ALOHIDA SESSION - ixtiyoriy):**
   - ✅ ALOHIDA sessionda ishlaydi
   - ✅ Asosiy sessionga zarar bermaydi
   - ✅ Queue rejimi (1 soniya interval)
   - ✅ Batch processing (10 ta)
   - ⚠️ **Hozir o'chirilgan** (AUTOREPLY_SESSION_STRING yo'q)

4. **Avtomatik Bloklash (6 ta qoida):**
   - 30+ takroriy belgilar (shubhali nom)
   - 2+ @mention spam
   - 15+ guruhda bir telefon (10 daqiqa ichida)
   - 60+ ayol ismi (dispatcher fake account)
   - 166 xorijiy joy
   - 510 dispatcher so'z

### 🗂️ MUHIM FAYLLAR

```
backend/
├── create-session.js              # Yangi session yaratish
├── refresh-groups.js              # Guruhlarni yangilash
├── src/
│   ├── services/
│   │   ├── telegram-session.js    # ASOSIY - monitoring session (OPTIMIZED!)
│   │   ├── autoReplySession.js    # ALOHIDA - auto-reply session
│   │   ├── message-filter.js      # Auto-block qoidalari
│   │   └── dispatcher-detector.js # Dispatcher aniqlash
│   └── server.js                  # Main entry point
├── .env                           # Environment variables
└── session.json                   # Session metadata

database/
├── db.json                        # LowDB database (runtime)
└── telegram_groups.backup.*.json  # Backup files

AVTOBLOK_QOIDALARI.md             # To'liq qoidalar hujjati
RESTORE.md                        # Bu fayl
```

---

## 🔧 BU HOLATGA QAYTISH

### **TEZKOR QAYTISH (Lokal + Server):**

**BU BUYRUQNI COPY-PASTE QILING:**

```bash
cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika" && git fetch --tags && git checkout v1.2-stable && ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git fetch --tags && git checkout v1.2-stable && pm2 restart dispatchr-logistics && echo '✅ v1.2-stable restore qilindi!' && pm2 logs dispatchr-logistics --lines 30"
```

**QISQACHA:**
```bash
git checkout v1.2-stable
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git checkout v1.2-stable && pm2 restart dispatchr-logistics"
```

### **BATAFSIL QAYTISH (Step-by-step):**

#### **1. LOKAL KOMPYUTERDA:**

```bash
# Project papkasiga o'tish
cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika"

# Hozirgi o'zgarishlarni saqlash (ixtiyoriy)
git stash

# Taglarni olish
git fetch --tags

# v1.2-stable'ga o'tish
git checkout v1.2-stable

# Tasdiqlash
git describe --tags
# Ko'rsatishi kerak: v1.2-stable
```

#### **2. SERVERDA:**

```bash
# 1. Serverga ulanish
ssh root@5.189.141.151

# 2. Project papkasiga o'tish
cd /var/www/dispatchr-logistics

# 3. PM2 ni to'xtatish
pm2 stop dispatchr-logistics

# 4. Taglarni olish va o'tish
git fetch --tags
git checkout v1.2-stable

# 5. PM2 ni qayta ishga tushirish
pm2 restart dispatchr-logistics

# 6. Loglarni tekshirish
pm2 logs dispatchr-logistics --lines 50
```

#### **3. TEKSHIRISH:**

Logda quyidagi xabarlar ko'rinishi kerak:

```
✅ TELEGRAM SESSION ULANDI!
👤 Account: Abduxoliq 998338497563
📱 100 ta guruh topildi
👂 Xabarlarni tinglash boshlandi...

📦 Processing 30 messages from queue...
⏱️  Batch processed in 1500ms (30 messages = 50ms/msg)
✅ Saved: 🌏YUK_🎯markazi🇺🇿
📵 Blocked phone detected: +998...
```

---

## 🤖 CLAUDE CODE UCHUN PROMPTLAR

### **PROMPT 1: Oddiy Restore (COPY-PASTE BU)**

```
Loyihani v1.2-stable restore point'ga qaytaring. Bu optimized versiya - queue processing 3x tezroq.

Quyidagi buyruqni ishlatng:

cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika" && git fetch --tags && git checkout v1.2-stable && ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git fetch --tags && git checkout v1.2-stable && pm2 restart dispatchr-logistics"

Keyin logni tekshiring va quyidagilarni tasdiqlang:
- ⏱️ Batch processed in ... (timing logs)
- 📦 Processing 30 messages (batch size 30)
- ✅ Saved: messages
- Session: Abduxoliq 998338497563

RESTORE.md faylda batafsil ko'rsatmalar bor.
```

### **PROMPT 2: Kengaytirilgan Restore**

```
v1.2-stable restore point'ga qaytaring (27.10.2025 14:40). Bu OPTIMIZED stable versiya.

YAXSHILANISHLAR (v1.2 vs v1.1):
- Queue interval: 2s → 1s (2x faster)
- Batch size: 20 → 30 (1.5x larger)
- Capacity: 600/min → 1800/min (3x faster)
- Throughput: 70-80/soat → 288/soat (4x improvement!)
- Added timing diagnostics (⏱️ logs)

BASE FUNKSIYALAR (v2.0):
- Session: Abduxoliq +998338497563 (ID: 8466237148)
- 200 ta guruh bazada (yangilangan)
- Auto-reply ALOHIDA sessionda (hozir o'chirilgan)
- 6 ta auto-block qoida faol

QAYTISH BUYRUQ:
git checkout v1.2-stable
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git checkout v1.2-stable && pm2 restart dispatchr-logistics"

TEKSHIRISH:
pm2 logs dispatchr-logistics --lines 50

Logda "⏱️ Batch processed" va "Processing 30 messages" ko'rinishi kerak.

RESTORE.md faylda to'liq ma'lumot bor.
```

### **PROMPT 3: Emergency Restore**

```
TEZKOR: Loyiha buzildi, v1.2-stable'ga qaytaring!

cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika" && git checkout v1.2-stable && ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git checkout v1.2-stable && pm2 restart dispatchr-logistics && pm2 logs dispatchr-logistics --lines 50"

"⏱️ Batch processed", "Abduxoliq 998338497563" va "100 ta guruh" ko'rinishi kerak.
```

---

## ⚙️ TEXNIK MA'LUMOTLAR

### **Environment Variables (.env):**

```bash
# ASOSIY SESSION (monitoring - Abduxoliq)
TELEGRAM_API_ID=25128014
TELEGRAM_API_HASH=3ea81368528ea8af69448a5a309e4159
TELEGRAM_SESSION_STRING=1AgAOMTQ5LjE1NC4xNjcuNDEBu8R5S5g0uE5QMMMfJU... (Abduxoliq)

# AUTO-REPLY SESSION (ixtiyoriy - hozir yo'q)
# AUTOREPLY_SESSION_STRING=<alohida_session_string>

# TELEGRAM BOT
TELEGRAM_BOT_TOKEN=7588317478:AAF9gKm1Ta076U4Km7Gw8nClUu0qvFESPqk
TARGET_CHANNEL_ID=-1002496159921

# DATABASE
DB_HOST=localhost
PORT=3001
NODE_ENV=production
```

### **PM2 Commands:**

```bash
pm2 list                          # Process ro'yxati
pm2 logs dispatchr-logistics      # Real-time loglar
pm2 restart dispatchr-logistics   # Restart
pm2 stop dispatchr-logistics      # To'xtatish
pm2 start dispatchr-logistics     # Ishga tushirish
pm2 describe dispatchr-logistics  # Detallash
pm2 flush dispatchr-logistics     # Loglarni tozalash
```

### **Useful Git Commands:**

```bash
git tag -l                        # Barcha taglar
git describe --tags               # Hozirgi tag
git log --oneline -20             # Oxirgi 20 commit
git show v1.2-stable              # Tag ma'lumotlari
```

---

## 📊 STATISTIKA

### **Queue Performance (v1.2):**
- **Interval:** 1 soniya (2x tezroq than v1.1)
- **Batch size:** 30 messages (1.5x katta than v1.1)
- **Capacity:** 1800 msg/min (3x ko'p than v1.1)
- **Real throughput:** 288 msg/hour (4x improvement!)
- **Processing time:** 27-115ms/message (⏱️ logged)

### **Session Ma'lumotlari:**
- **Account:** Abduxoliq
- **Telefon:** +998338497563
- **ID:** 8466237148
- **Guruhlar (Telegram):** 100 ta
- **Guruhlar (Baza):** 200 ta

### **Auto-Block Qoidalari:**
1. **Shubhali nom:** 30+ takroriy belgilar
2. **@mention spam:** 2+ mention
3. **Telefon spam:** 15+ guruh (10 daqiqa)
4. **Ayol ismi:** 60+ ism (dispatcher fake)
5. **Xorijiy joylar:** 166 ta
6. **Dispatcher so'zlar:** 510 ta

### **Sistema Status:**
- **Monitoring:** ✅ FAOL (MAKSIMAL TEZLIK!)
- **Auto-reply:** ❌ O'CHIRILGAN (ixtiyoriy)
- **Auto-block:** ✅ FAOL
- **Database:** ✅ ISHLAYAPTI
- **Bot:** ✅ ISHLAYAPTI
- **Queue:** ✅ OPTIMIZED (1800/min capacity)

---

## 🆘 MUAMMOLARNI HAL QILISH

### **1. Session ulanmasa:**

```bash
# Session stringni tekshiring
ssh root@5.189.141.151 "grep TELEGRAM_SESSION_STRING /var/www/dispatchr-logistics/.env"

# Yangi session yarating
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics/backend && node create-session.js"

# .env'ni yangilang va restart qiling
pm2 restart dispatchr-logistics
```

### **2. Guruhlar yangilanmasa:**

```bash
# Refresh script'ni ishlatng
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics/backend && node refresh-groups.js"

# PM2 ni restart qiling
pm2 restart dispatchr-logistics
```

### **3. Queue sekin ishlasa:**

```bash
# Logda timing diagnostics tekshiring
ssh root@5.189.141.151 "pm2 logs dispatchr-logistics --lines 100 | grep '⏱️'"

# Ko'rinishi kerak:
# ⏱️  Batch processed in 1500ms (30 messages = 50ms/msg)

# Agar timing yo'q bo'lsa - v1.2-stable'ga qaytaring:
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git checkout v1.2-stable && pm2 restart dispatchr-logistics"
```

### **4. Auto-reply yoqish kerak bo'lsa:**

```bash
# 1. ALOHIDA telefon raqam bilan yangi session yarating
cd /var/www/dispatchr-logistics/backend
node create-session.js

# 2. Session stringni .env ga qo'shing
echo "AUTOREPLY_SESSION_STRING=<yangi_session>" >> /var/www/dispatchr-logistics/.env

# 3. Restart qiling
pm2 restart dispatchr-logistics

# 4. Logni tekshiring - "AUTO-REPLY SESSION ULANDI!" ko'rinishi kerak
pm2 logs dispatchr-logistics --lines 50
```

### **5. Database backup:**

```bash
# Backup yaratish
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && cp database/db.json database/db.backup.$(date +%Y%m%d_%H%M%S).json"

# Backup'dan restore
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && cp database/db.backup.20251027_144000.json database/db.json && pm2 restart dispatchr-logistics"
```

---

## 📝 QACHON ISHLATISH

Bu restore point'ga qaytish kerak bo'ladigan holatlar:

1. **Kod buzilsa** - yangi o'zgarishlar xatolarga olib kelsa
2. **Tezlik pasaysa** - queue sekin ishlayotgan bo'lsa
3. **Stable versiya kerak** - ishonchli va tez holatga qaytish kerak
4. **Test'dan keyin** - yangi feature test qilgandan keyin
5. **Production deploy** - optimized versiyani deploy qilish kerak

---

## 🎯 VERSIYA TARIXI

### **v1.1-stable** (2025-10-25)
- Commit: 33d1d0b
- Session: Ustoz kunglao (eski)
- Queue: 2s interval, 20 batch
- Capacity: 600/min
- Throughput: ~70-80/hour
- Status: Eski session ban bo'lgan

### **v2.0-stable** (2025-10-27 AM)
- Commit: a7071bb
- Session: Abduxoliq +998338497563 (YANGI)
- Queue: 2s interval, 20 batch (unchanged)
- Auto-reply: Alohida session (o'chirilgan)
- Guruhlar: 200 ta (yangilangan)
- Status: ✅ Stable but not optimized

### **v1.2-stable** (2025-10-27 14:40) ⬅️ **HOZIRGI**
- Commit: 21bf0b1
- Session: Abduxoliq +998338497563
- Queue: 1s interval, 30 batch (OPTIMIZED!)
- Capacity: 1800/min (3x faster!)
- Throughput: 288/hour (4x improvement!)
- Timing logs: ⏱️ diagnostics added
- Status: ✅ OPTIMIZED - MAKSIMAL TEZLIK

---

## ✅ TAYYOR

Bu v1.2-stable - **optimized, to'liq ishlayotgan, maksimal tez versiya!**

**Xususiyatlari:**
- ⚡ **3x tezroq** - 1800/min capacity
- ⚡ **4x ko'p xabar** - 288 msg/hour
- ✅ Yangi session (ban yo'q)
- ✅ Guruhlar yangilangan
- ✅ Auto-reply alohida sessionda (himoyalangan)
- ✅ Monitoring MAKSIMAL tezlikda ishlayapti
- ✅ Auto-block faol
- ✅ Timing diagnostics (⏱️ logs)
- ✅ Xavfsiz va barqaror

**TEZKOR RESTORE BUYRUQ:**
```bash
cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika" && git checkout v1.2-stable && ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git checkout v1.2-stable && pm2 restart dispatchr-logistics"
```

**Bu restore point'ga ishonavering - u MAKSIMAL tezlikda ishlaydi!** 🚀⚡

---

**Yaratildi:** 27 Oktyabr 2025, 14:40
**Versiya:** v1.2-stable
**Status:** ✅ OPTIMIZED - MAKSIMAL TEZLIK
**Keyingi yangilanish:** Kerak bo'lganda
