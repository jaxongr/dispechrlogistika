# 🆘 KOD TIKLASH QO'LLANMA

## ⭐ ISHLAYDIGAN VERSIYA - 2025-11-01

Agar kod buzilsa yoki muammo bo'lsa, **WORKING-PERFECTLY-2025-11-01** tag'iga qaytish kerak!

---

## 📌 SHU TAG'DA NIMA ISHLAYDI:

✅ **Buyurtma yaratish** - birinchi marta ham to'g'ri ishlaydi
✅ **30 daqiqalik spam prevention** - ikki marta buyurtma yaratish bloklangan
✅ **Double-submit prevention** - bir necha marta "Tasdiqlash" bosilmaydi
✅ **State reset** - /start va /menu orqali reset qilish
✅ **Telefon extraction** - 20, 33, 50, 55, 88, 90-99 operatorlar
✅ **Debug logging** - muammolarni tez topish uchun
✅ **Auto-expire** - 3 daqiqada guruhga yuborish
✅ **"Olindi" tugmasi** - boshqa userlardan o'chirish

---

## 🔢 VERSIYA TARIXI:

- **v2.5-stable** ← HOZIRGI VERSIYA (2025-11-01) - Spam prevention fix
- **v2.4-stable** - Avvalgi versiya
- **WORKING-PERFECTLY-2025-11-01** - Shu bilan bir xil (alternative tag)

---

## 🔄 TIKLASH USULLARI

### 1️⃣ Butun loyihani ishlaydigan holatga qaytarish

**Lokal kompyuterda:**
```bash
cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika"
git fetch --tags
git checkout WORKING-PERFECTLY-2025-11-01
```

**Serverda:**
```bash
ssh root@5.189.141.151
cd /var/www/dispatchr-logistics
git fetch --tags
git checkout WORKING-PERFECTLY-2025-11-01
pm2 restart dispatchr-logistics
```

---

### 2️⃣ Faqat backend fayllarni tiklash (frontend'ni saqlab qolish)

**Lokal:**
```bash
git checkout WORKING-PERFECTLY-2025-11-01 -- backend/
```

**Serverda:**
```bash
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git fetch --tags && git checkout WORKING-PERFECTLY-2025-11-01 -- backend/ && pm2 restart dispatchr-logistics"
```

---

### 3️⃣ Faqat bitta faylni tiklash

**Agar faqat bot-order.js buzilgan bo'lsa:**
```bash
git checkout WORKING-PERFECTLY-2025-11-01 -- backend/src/services/bot-order.js
```

**Agar telegram-bot.js buzilgan bo'lsa:**
```bash
git checkout WORKING-PERFECTLY-2025-11-01 -- backend/src/services/telegram-bot.js
```

---

### 4️⃣ Main branch'ga qaytish (yangi kod bilan davom etish)

Tiklashdan keyin qayta yangi kod yozmoqchi bo'lsangiz:
```bash
git checkout main
```

---

## 📊 VERSIYALAR RO'YXATI

| Tag nomi | Tavsif | Commit |
|----------|--------|--------|
| **v2.5-stable** | ⭐ To'liq ishlaydigan versiya (HOZIRGI) | 45daa0b |
| **WORKING-PERFECTLY-2025-11-01** | Alternative nom (shu bilan bir xil) | 45daa0b |
| v2.4-stable | Avvalgi stable versiya | a9ce6fe |
| v2.3-stable | Eski versiya | ... |

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

**Server'dan tiklash:**
```bash
ssh root@5.189.141.151
cd /var/www/dispatchr-logistics
node -e "const backup = require('./backend/src/services/database-backup'); backup.restoreFromBackup('db_backup_YYYY-MM-DD_HH-MM-SS.json')"
pm2 restart dispatchr-logistics
```

**GitHub'dan tiklash:**
```bash
git pull origin main
# Oxirgi backup database/backups/ da bo'ladi
# Manual tiklash kerak bo'lsa, faylni serverga yuklash
scp database/backups/db_backup_*.json root@5.189.141.151:/var/www/dispatchr-logistics/database/db.json
ssh root@5.189.141.151 "pm2 restart dispatchr-logistics"
```

---

**Yaratilgan:** 2025-11-01
**Oxirgi yangilanish:** 2025-11-01
**Status:** ✅ PRODUCTION READY
**Backup:** ✅ 3 JOYDA AVTOMATIK
