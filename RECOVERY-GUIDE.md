# 🆘 KOD TIKLASH QO'LLANMA

## ⭐ ISHLAYDIGAN VERSIYA - V2.6-STABLE

Agar kod buzilsa yoki muammo bo'lsa, **v2.6-stable** tag'iga qaytish kerak!

**Database backup:** `db_V2.6-STABLE_FINAL_20251101_223611.json` (20 MB)

---

## 📌 V2.6-STABLE DA NIMA ISHLAYDI:

✅ **Asosiy funksiyalar:**
  • Monitoring: 136 guruh
  • Filter system: Dispatcher detection, phone blocking
  • Target guruhga avtomatik yuborish
  • Bot buyurtma yaratish (30min rate limit)
  • Haydovchi oldindan bron qilish
  • SMS integratsiya

✅ **Broadcast tizimi:**
  • Auto-reply session: ULANGAN ✅
  • Single session broadcast: ISHLAYDI ✅
  • Multi-session broadcast: TAYYOR
  • Rate limiting: 3s interval (20 msg/min)
  • Concurrency prevention: FIXED ✅

✅ **Database system:**
  • Auto-backup: Har 6 soatda
  • GitHub Actions: Kunlik backup
  • 3-joyda saqlash

✅ **Barqarorlik:**
  • PM2 auto-restart
  • Error logging
  • Session management
  • Flood protection

---

## 🔢 VERSIYA TARIXI:

- **v2.6-stable** ← HOZIRGI VERSIYA (2025-11-01) - Full production ready
- **v2.5-stable** - Spam prevention fix
- **v2.4-stable** - Avvalgi versiya
- **WORKING-PERFECTLY-2025-11-01** - Alternative tag

---

## 🔄 TIKLASH USULLARI

### 1️⃣ Butun loyihani ishlaydigan holatga qaytarish

**Lokal kompyuterda:**
```bash
cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika"
git fetch --tags
git checkout v2.6-stable
```

**Serverda:**
```bash
ssh root@5.189.141.151
cd /var/www/dispatchr-logistics
git fetch --tags
git checkout v2.6-stable
pm2 restart dispatchr-logistics
```

---

### 2️⃣ Faqat backend fayllarni tiklash (frontend'ni saqlab qolish)

**Lokal:**
```bash
git checkout v2.6-stable -- backend/
```

**Serverda:**
```bash
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git fetch --tags && git checkout v2.6-stable -- backend/ && pm2 restart dispatchr-logistics"
```

---

### 3️⃣ Faqat bitta faylni tiklash

**Agar faqat bot-order.js buzilgan bo'lsa:**
```bash
git checkout v2.6-stable -- backend/src/services/bot-order.js
```

**Agar broadcast tizimi buzilgan bo'lsa:**
```bash
git checkout v2.6-stable -- backend/src/services/autoReplySession.js
git checkout v2.6-stable -- backend/src/models/BroadcastSession.js
```

---

### 4️⃣ Main branch'ga qaytish (yangi kod bilan davom etish)

Tiklashdan keyin qayta yangi kod yozmoqchi bo'lsangiz:
```bash
git checkout main
```

---

## 📊 VERSIYALAR RO'YXATI

| Tag nomi | Tavsif | Commit | Database Backup |
|----------|--------|--------|-----------------|
| **v2.6-stable** | ⭐ PRODUCTION READY (HOZIRGI) | 67e67a7 | db_V2.6-STABLE_FINAL_20251101_223611.json |
| **v2.5-stable** | Spam prevention fix | 45daa0b | - |
| v2.4-stable | Avvalgi stable versiya | a9ce6fe | - |
| **WORKING-PERFECTLY-2025-11-01** | Alternative tag | 45daa0b | - |

---

## 🚨 MUHIM ESLATMALAR

1. **Tag'ni o'chirish mumkin emas** - GitHub'da saqlanadi
2. **Serverda ham tiklash** - faqat lokal o'zgartirilsa yetarli emas
3. **PM2 restart** - har doim server kodini yangilaganingizdan keyin
4. **Backup** - GitHub'da avtomatik saqlanadi

---

## 📞 SERVERGA ULANISH

```bash
# SSH ulanish
ssh root@5.189.141.151

# Log'larni ko'rish
pm2 logs dispatchr-logistics --lines 100

# Bot statusini ko'rish
pm2 status

# Restart qilish
pm2 restart dispatchr-logistics
```

---

## 🔧 TIKLASHDA MUAMMO BO'LSA

**1. Git tag topilmasa:**
```bash
git fetch --tags --force
git tag -l
```

**2. Permission denied (serverda):**
```bash
# Lokal'dan serverga fayl yuborish
scp backend/src/services/bot-order.js root@5.189.141.151:/var/www/dispatchr-logistics/backend/src/services/
```

**3. Merge conflict:**
```bash
git reset --hard WORKING-PERFECTLY-2025-11-01
```

---

## ✅ TEKSHIRISH

Tiklaganingizdan keyin quyidagi testlarni o'tkazing:

1. `/start` yuboring - javob beradimi?
2. "📝 Buyurtma yaratish" - ishlayaptimi?
3. Buyurtma yarating va tasdiqlaing - birinchi marta ishlayaptimi?
4. 2-buyurtma yarating - 30 daqiqalik limit ko'rsatyaptimi?
5. `/start` yuboring va qayta buyurtma yarating - ishlayaptimi?

---

---

## 💾 DATABASE BACKUP TIZIMI

### **3 JOYDA AVTOMATIK SAQLASH:**

| Joy | Interval | Saqlash muddati | Status |
|-----|----------|-----------------|--------|
| **1. Server** | Har 6 soat | 7 kun | ✅ Ishlamoqda |
| **2. GitHub** | Har kuni 00:00 | 7 backup | ✅ Avtomatik |
| **3. Lokal** | Manual pull | Istalgancha | ✅ Tayyor |

### **Server Backup:**
- Interval: Har 6 soat
- Hajm: ~19 MB
- Joylashuv: `/var/www/dispatchr-logistics/database/backups/`
- Auto-cleanup: 7 kundan eski backup'lar o'chiriladi

### **GitHub Backup:**
- Schedule: Har kuni UTC 19:00 (UZ 00:00)
- Workflow: `.github/workflows/backup-database.yml`
- Oxirgi 7 ta backup saqlanadi
- Manual trigger: GitHub Actions → Run workflow

### **Database Tiklash:**

**V2.6-STABLE Database'ni tiklash:**
```bash
# Serverda
ssh root@5.189.141.151
cd /var/www/dispatchr-logistics/database
cp db_V2.6-STABLE_FINAL_20251101_223611.json db.json
cd ..
pm2 restart dispatchr-logistics
```

**Yoki backups papkasidan:**
```bash
ssh root@5.189.141.151
cd /var/www/dispatchr-logistics/database
cp backups/db_V2.6-STABLE_FINAL_20251101_223611.json db.json
cd ..
pm2 restart dispatchr-logistics
```

**Oxirgi avtomatik backup'dan tiklash:**
```bash
ssh root@5.189.141.151
cd /var/www/dispatchr-logistics/database
# Eng yangi backup'ni topish
ls -lt backups/db_backup_*.json | head -1
# Tiklash
cp backups/db_backup_YYYY-MM-DD_HH-MM-SS.json db.json
cd ..
pm2 restart dispatchr-logistics
```

---

**Yaratilgan:** 2025-11-01
**Oxirgi yangilanish:** 2025-11-01 22:40 (V2.6-STABLE)
**Status:** ✅ PRODUCTION READY
**Backup:** ✅ 3 JOYDA AVTOMATIK
**Hozirgi versiya:** v2.6-stable (commit: 67e67a7)
