# 🔄 BACKUP & RESTORE GUIDE

**Backup yaratilgan sana:** 2025-10-25 (Yangilandi)
**Stable Version:** v1.1-stable
**Git Commit:** 33d1d0b

---

## 📦 HOZIRGI LOYIHA HOLATI

✅ **Ishlayotgan funksiyalar:**
- E'lonlarni avtomatik filter qilish
- Dispatcher auto-detection
- Auto-reply (Telegram Session orqali)
- SemySMS integratsiya
- Bloklash tizimi (Avtomatik)
- Dashboard
- Statistika
- Dynamic blacklist (USER_BANNED guruhlar avtomatik qo'shiladi)

✅ **Auto-Reply Settings:**
- Minutlik limit: 3 ta (xavfsiz)
- Soatlik limit: Cheksiz (99999)
- Cooldown: 1.0 soat (har userga)
- Delay: 13-17 soniya (flood control)
- Background ishlash (e'lonlarni bloklamaydi)
- **Blacklist:** TOP 5 eng xavfli guruh
- **Dynamic blacklist:** USER_BANNED guruhlar avtomatik qo'shiladi

✅ **Blacklist Guruhlari (5 ta - xavfsizlik):**
1. 🌏YUK_🎯markazi🇺🇿 (864 e'lon - ENG XAVFLI)
2. Yuk markazi |🇺🇿| Yuk bor (290 e'lon)
3. YUKLAR🚛 [LoadMe] (109 e'lon)
4. YUK markazi 🇺🇿
5. 🇺🇿🚚 Yuk markazi🚚🇺🇿

✅ **Bugun (2025-10-25):**
- 1000+ auto-reply yuborilgan
- 198 ta guruhga
- 294 ta turli userga
- Avtoblok ishlayapti
- E'lonlar target guruhga yuborilmoqda

---

## 🚨 RESTORE QILISH (Hozirgi holatga qaytarish)

### **Variant 1: Git Tag orqali (TAVSIYA ETILADI)**

```bash
# 1. Hozirgi holatga qaytarish
git fetch --all --tags
git checkout v1.1-stable

# 2. Serverga deploy qilish
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git fetch --all --tags && git checkout v1.1-stable && pm2 restart dispatchr-logistics"
```

### **Variant 2: Commit Hash orqali**

```bash
# 1. Hozirgi commit'ga qaytarish
git reset --hard 33d1d0b

# 2. Serverga deploy qilish
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git fetch origin && git reset --hard 33d1d0b && pm2 restart dispatchr-logistics"
```

---

## 📋 CLAUDE CODE BUYRUQLARI

### **To'liq restore uchun:**

```
Loyihani v1.1-stable tag'iga qaytaring. Qadamlar:
1. git fetch --all --tags
2. git checkout v1.1-stable
3. ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git fetch --all --tags && git checkout v1.1-stable && pm2 restart dispatchr-logistics"
```

### **Faqat server restore:**

```
Serverdagi loyihani stable holatga qaytaring:
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git fetch --all --tags && git checkout v1.1-stable && pm2 restart dispatchr-logistics"
```

---

## 🗂️ DATABASE BACKUP

```bash
# Server backup yaratish
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && cp database/db.json database/db.backup.$(date +%Y%m%d_%H%M%S).json"

# Database restore
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && cp database/db.backup.YYYYMMDD_HHMMSS.json database/db.json && pm2 restart dispatchr-logistics"
```

---

## ⚠️ EMERGENCY RESTORE

Agar hamma narsa buzilsa:

```bash
# Local restore
git fetch --all --tags
git checkout v1.1-stable

# Server restore
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git fetch --all --tags && git checkout v1.1-stable && pm2 restart dispatchr-logistics"
```

---

## 📊 HOZIRGI HOLAT (2025-10-25)

**Ishlayotgan:**
- ✅ E'lonlar filter - ISHLAYAPTI
- ✅ Avtoblok - ISHLAYAPTI
- ✅ Auto-reply - ISHLAYAPTI (3 ta/min, xavfsiz)
- ✅ Target guruhga yuborish - ISHLAYAPTI
- ✅ SemySMS - ISHLAYAPTI
- ✅ Dashboard - ISHLAYAPTI

**Ma'lum muammolar:**
- ⚠️ Telegram session ko'p guruhlarda USER_BANNED (100+ guruh)
- ⚠️ Dynamic blacklist ko'p guruhni block qilmoqda
- ℹ️ Auto-reply kam yuborilmoqda (session ban sabab)

**Kelajakda to'g'irlash kerak:**
- 🔧 Yangi Telegram session yaratish (ban bo'lmagan account)
- 🔧 Dynamic blacklist'ni optimallashtirish

---

## 🎯 BACKUP HISTORY

**v1.0-stable** (2025-10-25 - Oldingi)
- Commit: f307a59
- Auto-reply: 100 ta/soat
- Blacklist: 20 ta guruh

**v1.1-stable** (2025-10-25 - HOZIRGI)
- Commit: 33d1d0b
- Auto-reply: 3 ta/min (xavfsiz)
- Blacklist: 5 ta guruh + dynamic
- Avtoblok tiklandi

---

**MUHIM:** Bu v1.1-stable - to'liq ishlayotgan versiya!
**ESLATMA:** Session ban sabab ko'p guruhga auto-reply yuborilmayapti - bu normal holat.
