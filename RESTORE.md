# 🔄 RESTORE POINT - v2.0-stable

**Sana:** 27 Oktyabr 2025
**Tag:** `v2.0-stable`
**Commit:** `a7071bb`
**Status:** ✅ **PRODUCTION READY - STABLE**

---

## 📋 BU VERSIYADA NIMA BOR

### ✅ ASOSIY FUNKSIYALAR

1. **Yangi Session Ulandi:**
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

3. **Auto-Reply (ALOHIDA SESSION - ixtiyoriy):**
   - ✅ ALOHIDA sessionda ishlaydi
   - ✅ Asosiy sessionga zarar bermaydi
   - ✅ Queue rejimi (5 soniya interval)
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
│   │   ├── telegram-session.js    # ASOSIY - monitoring session
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

```bash
# 1. Lokal - v2.0-stable'ga qaytish
cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika"
git fetch --tags
git checkout v2.0-stable

# 2. Server - yangilash va restart
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git fetch --tags && git checkout v2.0-stable && pm2 restart dispatchr-logistics"

# 3. Tekshirish
ssh root@5.189.141.151 "pm2 logs dispatchr-logistics --lines 50"
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

# v2.0-stable'ga o'tish
git checkout v2.0-stable

# Tasdiqlash
git describe --tags
# Ko'rsatishi kerak: v2.0-stable
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
git checkout v2.0-stable

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

💬 Auto-reply session ishga tushmoqda...
⚠️  Auto-reply session topilmadi (AUTOREPLY_SESSION_STRING)
   Auto-reply o'chirilgan - faqat monitoring ishlaydi
```

---

## 🤖 CLAUDE CODE UCHUN PROMPTLAR

### **PROMPT 1: Oddiy Restore**

```
Loyihani v2.0-stable restore point'ga qaytaring. Quyidagi qadamlarni bajaring:

1. Lokal repositoryni v2.0-stable tag'ga checkout qiling
2. Serverga ulanib, projectni v2.0-stable'ga checkout qiling
3. PM2 ni restart qiling va loglarni tekshiring
4. Quyidagilarni tasdiqlang:
   - Session: Abduxoliq 998338497563
   - Guruhlar: 100 ta
   - Auto-reply: O'chirilgan (monitoring only)
   - Auto-block rules: Ishlayapti

RESTORE.md faylda batafsil ko'rsatmalar bor.
```

### **PROMPT 2: Kengaytirilgan Restore**

```
v2.0-stable restore point'ga qaytaring (27.10.2025). Bu stable versiya quyidagilarni o'z ichiga oladi:

ASOSIY:
- Yangi session: Abduxoliq +998338497563 (ID: 8466237148)
- 200 ta guruh bazada (yangilangan - eski 209 ta o'chirildi)
- Auto-reply ALOHIDA sessionda ishlaydi (hozir o'chirilgan)
- 6 ta auto-block qoida faol

FAYLLAR:
- backend/src/services/autoReplySession.js - alohida auto-reply moduli
- backend/create-session.js - session yaratish scripti
- backend/refresh-groups.js - guruhlarni yangilash scripti
- AVTOBLOK_QOIDALARI.md - to'liq qoidalar hujjati

QAYTISH QADAMLARI:
1. git checkout v2.0-stable (lokal)
2. ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git checkout v2.0-stable && pm2 restart dispatchr-logistics"
3. Loglarni tekshiring - "Abduxoliq 998338497563" ko'rinishi kerak
4. Auto-reply o'chirilgan bo'lishi kerak (ixtiyoriy feature)

RESTORE.md faylda to'liq ma'lumot bor.
```

### **PROMPT 3: Emergency Restore**

```
TEZKOR: Loyiha buzildi, v2.0-stable'ga qaytaring!

git checkout v2.0-stable
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git checkout v2.0-stable && pm2 restart dispatchr-logistics"
pm2 logs dispatchr-logistics --lines 50

"Abduxoliq 998338497563" va "100 ta guruh" ko'rinishi kerak.
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
git show v2.0-stable              # Tag ma'lumotlari
```

---

## 📊 STATISTIKA

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
- **Monitoring:** ✅ FAOL
- **Auto-reply:** ❌ O'CHIRILGAN (ixtiyoriy)
- **Auto-block:** ✅ FAOL
- **Database:** ✅ ISHLAYAPTI
- **Bot:** ✅ ISHLAYAPTI

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

### **3. Auto-reply yoqish kerak bo'lsa:**

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

### **4. Database backup:**

```bash
# Backup yaratish
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && cp database/db.json database/db.backup.$(date +%Y%m%d_%H%M%S).json"

# Backup'dan restore
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && cp database/db.backup.20251027_012345.json database/db.json && pm2 restart dispatchr-logistics"
```

---

## 📝 QACHON ISHLATISH

Bu restore point'ga qaytish kerak bo'ladigan holatlar:

1. **Kod buzilsa** - yangi o'zgarishlar xatolarga olib kelsa
2. **Session muammosi** - yangi session bilan muammo bo'lsa
3. **Stable versiya kerak** - ishonchli holatga qaytish kerak
4. **Test'dan keyin** - yangi feature test qilgandan keyin
5. **Production deploy** - stable versiyani deploy qilish kerak

---

## 🎯 VERSIYA TARIXI

### **v1.1-stable** (2025-10-25)
- Commit: 33d1d0b
- Session: Ustoz kunglao (eski)
- Auto-reply: 3 ta/min
- Blacklist: 5 ta + dynamic
- Status: Eski session ban bo'lgan

### **v2.0-stable** (2025-10-27) ⬅️ **HOZIRGI**
- Commit: a7071bb
- Session: Abduxoliq +998338497563 (YANGI)
- Auto-reply: Alohida session (o'chirilgan)
- Guruhlar: 200 ta (yangilangan)
- Status: ✅ PRODUCTION READY

---

## ✅ TAYYOR

Bu v2.0-stable - **to'liq ishlayotgan, stable, production-ready versiya!**

**Xususiyatlari:**
- ✅ Yangi session (ban yo'q)
- ✅ Guruhlar yangilangan
- ✅ Auto-reply alohida sessionda (himoyalangan)
- ✅ Monitoring to'liq ishlayapti
- ✅ Auto-block faol
- ✅ Xavfsiz va barqaror

**Bu restore point'ga ishonavering - u ishonchli ishlaydi!** 🚀

---

**Yaratildi:** 27 Oktyabr 2025
**Versiya:** v2.0-stable
**Status:** ✅ STABLE - PRODUCTION READY
**Keyingi yangilanish:** Kerak bo'lganda
