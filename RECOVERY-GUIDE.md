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
| **WORKING-PERFECTLY-2025-11-01** | ⭐ To'liq ishlaydigan versiya | 45daa0b |
| v1.0-stable-rate-limit-fix | 30-daqiqalik spam prevention | 45daa0b |
| v2.4-stable | Avvalgi stable versiya | ... |

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

**Yaratilgan:** 2025-11-01
**Oxirgi yangilanish:** 2025-11-01
**Status:** ✅ PRODUCTION READY
