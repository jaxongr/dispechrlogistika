# HAYDOVCHI TIZIMI - TEST QILISH

## Bot Ma'lumotlari

**Bot:** @Yukchiborbot
**Link:** https://t.me/Yukchiborbot

## Test Qilish Uchun Commandlar

### 1. Asosiy Menyu
```
/haydovchilar
```
Natija: 4 ta tugma ko'rsatilishi kerak:
- 👤 Haydovchi tekshirish
- ➕ Haydovchi qo'shish
- 📋 Barcha haydovchilar
- 📊 Statistika

### 2. Haydovchi Tekshirish

1. `/haydovchilar` yuboring
2. "👤 Haydovchi tekshirish" tugmasini bosing
3. Telefon raqam kiriting (masalan: `+998901234567`)
4. Natija:
   - Agar topilsa: To'liq ma'lumot (telefon, mashina, qarz, tarix)
   - Agar topilmasa: "Haydovchi topilmadi" xabari

### 3. Qora Ro'yxatga Qo'shish

1. `/haydovchilar` yuboring
2. "➕ Haydovchi qo'shish" tugmasini bosing
3. "⚫ Qora ro'yxat (pul bermaydi)" tugmasini bosing
4. Ketma-ket kiriting:
   - Telefon raqam: `+998901234567`
   - Mashina turi: `Isuzu`
   - Mashina rangi: `oq`
   - Davlat raqam: `01A123BC`
   - Sabab: `Pul bermadi`
   - Qo'shimcha ma'lumot: `Telefon o'chiradi` (yoki `/skip`)
5. Natija: "✅ ⚫ QORA RO'YXATGA QO'SHILDI!" xabari

### 4. Oq Ro'yxatga Qo'shish

1. `/haydovchilar` yuboring
2. "➕ Haydovchi qo'shish" tugmasini bosing
3. "⚪ Oq ro'yxat (yaxshi haydovchi)" tugmasini bosing
4. Ketma-ket kiriting:
   - Telefon raqam: `+998907654321`
   - Mashina turi: `Kamaz`
   - Mashina rangi: `qora`
   - Davlat raqam: `01B456XY`
5. Natija: "✅ ⚪ OQ RO'YXATGA QO'SHILDI!" xabari

### 5. Statistika

1. `/haydovchilar` yuboring
2. "📊 Statistika" tugmasini bosing
3. Natija:
   - Qora ro'yxat: soni, jami qarz, oxirgi 30 kun
   - Oq ro'yxat: soni, oxirgi 30 kun
   - Eng faol dispatcherlar

### 6. Barcha Haydovchilar

1. `/haydovchilar` yuboring
2. "📋 Barcha haydovchilar" tugmasini bosing
3. Natija: Oxirgi 10 ta qora va oq ro'yxat

## Database Joylashuvi

```
database/db.json
```

Database ichida `drivers` array'i bo'lishi kerak.

## Test Natijalarini Tekshirish

### 1. Loglarni ko'rish:
```bash
ssh root@5.189.141.151 "pm2 logs dispatchr-logistics --lines 50"
```

### 2. Database'ni tekshirish:
```bash
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && cat database/db.json | python3 -c \"
import json, sys
data = json.load(sys.stdin)
print('🚛 Haydovchilar:', len(data.get('drivers', [])))
for d in data.get('drivers', [])[:3]:
    print(f\"  - {d['phone']} ({d['list_type']} ro'yxat)\")
\""
```

### 3. Bot ishlayotganini tekshirish:
```bash
ssh root@5.189.141.151 "pm2 status dispatchr-logistics"
```

## Kutilayotgan Xatti-Harakatlar

✅ **ISHLASHI KERAK:**
- `/haydovchilar` command javob berishi
- Tugmalarni bosish
- Haydovchi qo'shish (step-by-step)
- Telefon bo'yicha qidirish
- Statistikani ko'rish
- Ma'lumotlar database'ga saqlanishi

❌ **ISHLAMASLIGI KERAK:**
- Bot javob bermasa - PM2'ni restart qiling
- Tugmalar ishlamasa - bot yangilanganini tekshiring
- Database saqlanmasa - permissions tekshiring

## Muammo Bo'lsa

1. PM2 loglarini tekshiring
2. Bot'ni restart qiling: `pm2 restart dispatchr-logistics`
3. Database permissions: `ls -la database/db.json`
4. Files mavjudligini tekshiring:
   - `backend/src/services/driver-manager.js`
   - `backend/src/services/driver-bot-handler.js`
   - `backend/src/services/telegram-bot-simple.js` (driver handler import qilingan)

## Deployment Holati

✅ **Deploy qilindi:** 2025-10-28 17:39 (commit: 6583423)
✅ **Files mavjud:** driver-manager.js, driver-bot-handler.js
✅ **Database schema:** `drivers: []` qo'shilgan
✅ **Bot ishlamoqda:** @Yukchiborbot (ID: 7588317478)
