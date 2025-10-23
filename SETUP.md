# 🚀 Tizimni sozlash - Step by Step

Bu qo'llanma sizga loyihani 0 dan sozlashda yordam beradi.

## Bosqich 1: Talablar

### Kerakli dasturlar

1. **Node.js** (v16 yoki yuqori)
   - Download: https://nodejs.org/
   - Terminal: `node --version` (tekshirish)

2. **PostgreSQL** (v12 yoki yuqori)
   - Download: https://www.postgresql.org/download/
   - Terminal: `psql --version` (tekshirish)

3. **Git** (optional)
   - Download: https://git-scm.com/

4. **Code Editor** (VS Code tavsiya etiladi)
   - Download: https://code.visualstudio.com/

## Bosqich 2: Telegram API sozlash

### 2.1. API credentials olish

1. Telegram'ga kiring: https://my.telegram.org
2. "API development tools" ga o'ting
3. "Create new application" bosing
4. Ma'lumotlarni to'ldiring:
   - App title: `Logistics Filter`
   - Short name: `logistics`
   - Platform: `Desktop`
5. **API ID** va **API Hash** ni saqlang

### 2.2. Bot yaratish

1. Telegram'da @BotFather ni oching
2. `/newbot` yuboring
3. Bot nomi va username bering:
   - Name: `Logistics Filter Bot`
   - Username: `logistics_filter_bot` (unique bo'lishi kerak)
4. **Bot Token** ni saqlang

### 2.3. To'lovlarni sozlash (optional)

1. @BotFather'da `/mybots` → botingiz → `Payments`
2. Provider tanlang (masalan, Telegram Stars)
3. Provider token'ni saqlang

### 2.4. Kanal yaratish

1. Telegram'da yangi kanal yarating (pulli obuna uchun)
2. Kanalga botni admin qilib qo'shing
3. Kanal ID'sini oling:
   - @username_to_id_bot ga kanal postini forward qiling
   - ID ni saqlang (masalan: `-1001234567890`)

## Bosqich 3: Database sozlash

### 3.1. PostgreSQL'ni ishga tushirish

Windows:
```bash
# Services'da PostgreSQL'ni ishga tushiring
# yoki
pg_ctl -D "C:\Program Files\PostgreSQL\14\data" start
```

Linux/Mac:
```bash
sudo service postgresql start
```

### 3.2. Database yaratish

Terminal'da:

```bash
# PostgreSQL'ga kirish
psql -U postgres

# Password: (postgres'ning paroli)
```

PostgreSQL shell'da:

```sql
-- Database yaratish
CREATE DATABASE logistics_dispatch;

-- User yaratish (optional)
CREATE USER logistics_user WITH PASSWORD 'strong_password';

-- Permissions
GRANT ALL PRIVILEGES ON DATABASE logistics_dispatch TO logistics_user;

-- Chiqish
\q
```

## Bosqich 4: Loyiha fayllarini sozlash

### 4.1. Dependencies o'rnatish

```bash
cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika\backend"
npm install
```

Kutish: 2-3 daqiqa

### 4.2. .env faylini sozlash

`backend/.env` faylini oching va to'ldiring:

```env
# Database (o'zingiznikini yozing)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=logistics_dispatch
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# JWT (random string yarating)
JWT_SECRET=your_random_secret_key_here_min_32_chars

# Telegram (Bosqich 2 dan)
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890

# Bot Token (Bosqich 2.2 dan)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Channel (Bosqich 2.4 dan)
TARGET_CHANNEL_ID=-1001234567890
TARGET_CHANNEL_USERNAME=your_channel_username

# TELEGRAM_SESSION_STRING - keyinroq to'ldiriladi
TELEGRAM_SESSION_STRING=
```

### 4.3. Database jadvallarini yaratish

```bash
npm run init-db
```

Ko'rinish:
```
🚀 Starting database initialization...
✅ Database initialized successfully!
📊 Created tables:
   - roles
   - users
   - telegram_groups
   ...
👤 Default admin user created:
   Username: admin
   Password: admin123 (PLEASE CHANGE THIS!)
```

## Bosqich 5: Telegram Session sozlash

### 5.1. Session yaratish

```bash
npm run dev
```

Dastur so'raydi:

```
Telefon raqamingizni kiriting (+998...): +998901234567
```

Kiriting: `+998901234567`

```
Telegram dan kelgan kodni kiriting: 12345
```

Telegram'dan kelgan 5 xonali kodni kiriting.

Agar 2FA bor bo'lsa:
```
2FA parolni kiriting: your_2fa_password
```

Muvaffaqiyatli bo'lsa:
```
✅ Telegram ga muvaffaqiyatli ulandi!
📝 Session string: 1AbCdEfGh...
⚠️  Bu session string ni .env fayliga qo'shing!
```

### 5.2. Session string ni saqlash

Terminal'dagi session string'ni nusxalang va `.env` fayliga qo'shing:

```env
TELEGRAM_SESSION_STRING=1AbCdEfGhIjKlMnOpQrStUvWxYz...
```

Session string juda uzun bo'ladi (~400+ belgi).

### 5.3. Server'ni qayta ishga tushirish

`Ctrl+C` bilan to'xtating va qaytadan:

```bash
npm run dev
```

## Bosqich 6: Guruhlarni qo'shish

### 6.1. Test guruhni yaratish

1. Telegram'da test guruh yarating
2. Guruhga o'z accountingiz bilan qo'shiling (session)
3. Guruhga bir nechta test xabar yuboring

### 6.2. Guruhlarni monitoring qilish

Server ishlayotgan holda, guruhga xabar yuboring:

Terminal'da ko'rinadi:
```
📨 Yangi xabar:
  Guruh: Test Guruh
  Yuboruvchi: John Doe (@johndoe)
  Dispetcher: ❌ YO'Q
  Ishonch: 85%
  Ma'lumot: Toshkentdan Samarqandga yuk bor...
```

## Bosqich 7: Dashboard kirish

### 7.1. Browser'da ochish

URL: http://localhost:3000

### 7.2. Login qilish

- **Username:** `admin`
- **Password:** `admin123`

⚠️ **Birinchi kirish:** Parolni o'zgartiring!

### 7.3. Dashboard sahifalar

- 📊 **Dashboard** - Statistika va so'nggi xabarlar
- 📨 **E'lonlar** - Barcha xabarlar va filtrlash
- 🚫 **Bloklangan** - Dispetcherlar ro'yxati

## Bosqich 8: Test qilish

### 8.1. Test dispetcher xabari

Guruhga yuboring:

```
🇷🇺Москва 🇺🇿Ташкент
Груз: метал
22 тонна
Тент фура керак
998901234567
998901234568
998901234569

СРОЧНО СРОЧНО СРОЧНО
ДИСПЕЧЕР КЕРАКМАС!!!
```

Dashboard'da ko'ring - dispetcher deb belgilanishi kerak (❌ qizil)

### 8.2. Test yuk egasi xabari

```
Toshkentdan Samarqandga yuk bor
Mebel 15 tonna
Tent fura kerak
Faqat haydovchilar aloqa qilsin!
998901234567
```

Dashboard'da ko'ring - approve bo'lishi kerak (✅ yashil)

### 8.3. E'lonni kanalga yuborish

1. Dashboard → E'lonlar
2. Approve qilingan xabarni tanlang
3. "Kanalga yuborish" tugmasini bosing
4. Kanal'da xabar paydo bo'lishi kerak

## Bosqich 9: Bot test qilish

### 9.1. Bot'ga start berish

Telegram'da botingizni oching va `/start` yuboring.

Ko'rinishi:
```
🚛 Logistika E'lonlar Filtri

Assalomu alaykum! ...
```

### 9.2. Obuna test (optional)

`/subscribe` yuboring va to'lov jarayonini test qiling.

## 🎉 Tayyor!

Tizim to'liq ishga tushdi! Endi:

1. ✅ Telegram guruhlardan xabarlar keladi
2. ✅ Dispetcherlar avtomatik filtrlanadi
3. ✅ Dashboard orqali boshqarish
4. ✅ Bot orqali obuna sotish
5. ✅ Kanalga avtomatik yuborish

## 🔧 Keyingi sozlamalar

### Parolni o'zgartirish

Dashboard → Settings → Change Password

yoki PostgreSQL orqali:

```sql
-- Yangi parol hash yaratish
-- Terminal: node backend/generate-password-hash.js new_password

UPDATE users
SET password_hash = 'new_hash_here'
WHERE username = 'admin';
```

### Ko'proq guruhlar qo'shish

Telegram accountingiz bilan guruhlarga qo'shiling - avtomatik track qilinadi.

### Filtr sozlash

`backend/src/services/dispatcher-detector.js` da threshold'larni o'zgartiring:

```javascript
this.thresholds = {
  dispatcherScore: 0.7,  // pastroq = ko'proq dispatch
  ownerScore: 0.5
};
```

### Production deploy

README.md ning "Production Deploy" bo'limiga qarang.

## ❓ Tez-tez so'raladigan savollar

**1. "Session expired" xatolik?**

Session qayta yaratish:
```bash
# .env dan TELEGRAM_SESSION_STRING ni o'chiring
# npm run dev - qaytadan session yarating
```

**2. Xabarlar kelmayapti?**

- Guruhda bot accounti borligini tekshiring
- Guruhda xabar yozish imkoniyati borligini tekshiring
- Terminal log'larni ko'ring

**3. Database xatolik?**

```bash
# PostgreSQL ishga tushganini tekshiring
psql -U postgres -d logistics_dispatch -c "SELECT 1;"
```

**4. Bot javob bermayapti?**

- Bot token to'g'riligini tekshiring
- @BotFather da bot active ekanligini ko'ring

## 📞 Yordam

Muammo bo'lsa:

1. Terminal log'larni tekshiring
2. `.env` fayldagi ma'lumotlarni qayta ko'rib chiqing
3. README.md va SETUP.md ni qayta o'qing
4. GitHub Issues'da so'rang

---

**Omad tilaklar! 🚀**
