# 🚛 Logistika Dispetchr Filter Tizimi

Telegram guruhlaridagi logistika e'lonlarini avtomatik filtrlash va dispetcherlarni aniqlash uchun professional platforma.

## 📋 Loyiha haqida

Bu tizim 100+ logistika guruhlaridan e'lonlarni to'playdi, dispetcherlarni AI va rule-based algoritm bilan filtrlab, faqat asl yuk egalarining e'lonlarini pulli kanal orqali sotadi.

### ✨ Asosiy imkoniyatlar

- ✅ **Telegram Session** - 100+ guruhlarni real-time monitoring
- ✅ **AI Detection** - Dispetcherlarni 90%+ aniqlik bilan aniqlash
- ✅ **Auto Filter** - Avtomatik filtrlash va kategoriyalash
- ✅ **Dashboard** - Zamonaviy web boshqaruv paneli
- ✅ **Rol Sistema** - Admin, moderator, viewer rollari
- ✅ **To'lov Sistema** - Telegram Stars/Bot Payment integratsiyasi
- ✅ **Pulli Kanal** - Filtrlangan e'lonlar uchun obuna tizimi

## 🏗️ Arxitektura

```
logistics-dispatch/
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── config/         # Database va konfiguratsiya
│   │   ├── controllers/    # API controllerlar
│   │   ├── models/         # Database modellar
│   │   ├── routes/         # API routes
│   │   ├── services/       # Telegram services
│   │   ├── middlewares/    # Auth va boshqa middleware
│   │   └── utils/          # Helper funksiyalar
│   └── package.json
├── frontend/               # HTML/CSS/JS frontend
│   └── public/
│       ├── css/
│       ├── js/
│       ├── index.html      # Login sahifa
│       └── dashboard.html  # Dashboard
├── database/               # SQL schema
│   └── schema.sql
└── README.md
```

## 🛠️ Texnologiyalar

**Backend:**
- Node.js + Express
- PostgreSQL
- GramJS (Telegram MTProto)
- Telegraf (Telegram Bot)
- JWT Authentication

**Frontend:**
- HTML5 + CSS3
- Bootstrap 5
- Vanilla JavaScript
- REST API

**Telegram:**
- MTProto API (guruhlardan o'qish)
- Bot API (kanalga yuborish)
- Telegram Stars to'lovlar

## 📦 O'rnatish

### 1. Repository ni klonlash

```bash
cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika"
```

### 2. Dependencies o'rnatish

```bash
cd backend
npm install
```

### 3. PostgreSQL sozlash

PostgreSQL o'rnating va database yarating:

```sql
CREATE DATABASE logistics_dispatch;
```

### 4. Environment o'rnatish

`.env` faylini yarating (`.env.example` dan nusxa ko'chiring):

```bash
cd backend
copy .env.example .env
```

`.env` faylini tahrirlang va quyidagilarni to'ldiring:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=logistics_dispatch
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# JWT
JWT_SECRET=your_random_secret_key_here

# Telegram API (https://my.telegram.org dan oling)
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash

# Telegram Bot (@BotFather dan oling)
TELEGRAM_BOT_TOKEN=your_bot_token

# Target Channel (filtrlangan e'lonlar yuboriladi)
TARGET_CHANNEL_ID=-1001234567890
TARGET_CHANNEL_USERNAME=your_channel
```

### 5. Database yaratish

```bash
npm run init-db
```

Bu buyruq barcha jadvallarni yaratadi va test admin user qo'shadi:
- **Username:** `admin`
- **Parol:** `admin123` ⚠️ *Buni o'zgartiring!*

### 6. Telegram Session sozlash

Birinchi marta Telegram session yaratish uchun:

```bash
npm run dev
```

Terminal sizdan so'raydi:
1. Telefon raqamingiz (+998...)
2. Telegram kod
3. 2FA parol (agar bor bo'lsa)

Session string olinadi va uni `.env` fayliga `TELEGRAM_SESSION_STRING` ga qo'shing.

### 7. Server ishga tushirish

```bash
npm start
```

yoki development mode:

```bash
npm run dev
```

Server ishga tushadi:
- 🌐 **Dashboard:** http://localhost:3000
- 🔌 **API:** http://localhost:3000/api
- 🤖 **Telegram Bot:** Ishga tushadi
- 📱 **Telegram Session:** Guruhlarni tinglay boshlaydi

## 📖 Foydalanish

### Dashboard ga kirish

1. Brauzerda http://localhost:3000 ga o'ting
2. Login qiling:
   - Username: `admin`
   - Parol: `admin123`

### Guruhlarni qo'shish

Telegram guruhlariga qo'shilish 2 yo'l bilan:

**1-usul: Telegram orqali qo'lda**
- Telegram hisobingizdan guruhga qo'shiling
- Guruh avtomatik database'ga qo'shiladi

**2-usul: API orqali** (kelgusida qo'shiladi)

### E'lonlarni ko'rish

Dashboard → E'lonlar sahifasida:
- ✅ **Approve qilingan** - Yuk egalarining e'lonlari
- ❌ **Dispetcherlar** - Bloklangan
- ⏳ **Kutilmoqda** - Tekshirilayotgan

### Dispetcherni bloklash

1. E'lonni oching
2. "Bloklash" tugmasini bosing
3. Sabab kiriting
4. Tasdiqlang

Bloklangan userning barcha keyingi xabarlari avtomatik rad etiladi.

### E'lonni kanalga yuborish

1. E'lonni approve qiling
2. "Kanalga yuborish" tugmasini bosing
3. E'lon pulli kanalga yuboriladi

## 🤖 Telegram Bot Komandalar

Foydalanuvchilar uchun bot komandalar:

- `/start` - Botni ishga tushirish
- `/subscribe` - Obuna sotib olish
- `/status` - Obuna holatini ko'rish

## 🔒 Xavfsizlik

- ✅ JWT authentication
- ✅ Rol-based access control (RBAC)
- ✅ Rate limiting
- ✅ Helmet.js security headers
- ✅ Password hashing (bcrypt)
- ✅ SQL injection himoyasi (parametrized queries)

⚠️ **Muhim:**
- Admin parolini o'zgartiring!
- JWT_SECRET ni qattiq qiling!
- Production'da HTTPS ishlating!

## 📊 Dispetcher Detection Algoritmi

Tizim quyidagi belgilar bo'yicha dispetcherlarni aniqlaydi:

1. **Keywords:**
   - "диспечер керакмас", "логист", "шардмас", va boshqalar

2. **Telefon raqamlar:**
   - Ko'p telefon raqamlar (3+) → dispetcher
   - 1-2 raqam → yuk egasi

3. **Emoji miqdori:**
   - 10+ emoji → dispetcher

4. **"СРОЧНО" takrorlari:**
   - 5+ marta → dispetcher

5. **Ko'p yo'nalishlar:**
   - Bir xabarda 10+ marshurt → dispetcher

6. **Template ishlatish:**
   - Formatlangan xabarlar → dispetcher

**Aniqlik:** 85-95%

## 🚀 Production Deploy

### Heroku

```bash
# Heroku CLI o'rnating
heroku create logistics-dispatch

# PostgreSQL qo'shing
heroku addons:create heroku-postgresql:hobby-dev

# Environment variables
heroku config:set JWT_SECRET=your_secret
heroku config:set TELEGRAM_API_ID=...
# ... boshqa o'zgaruvchilar

# Deploy
git push heroku main
```

### VPS (Ubuntu)

```bash
# Node.js o'rnating
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL o'rnating
sudo apt install postgresql postgresql-contrib

# PM2 o'rnating
sudo npm install -g pm2

# Loyihani clone qiling
git clone <repo_url>
cd logistics-dispatch/backend

# Dependencies
npm install

# .env sozlang
nano .env

# Database init
npm run init-db

# PM2 bilan ishga tushiring
pm2 start src/server.js --name logistics-dispatch
pm2 save
pm2 startup
```

## 🔧 Troubleshooting

### Telegram session xatolik

```
Error: Could not find the input entity for...
```

**Yechim:** Guruhga qo'shilganingizni tekshiring va session qayta yarating.

### Database connection xatolik

```
Error: connect ECONNREFUSED
```

**Yechim:** PostgreSQL ishga tushganini va .env da to'g'ri ma'lumot borligini tekshiring.

### Bot to'lovlar ishlamayapti

**Yechim:** @BotFather da to'lovlarni yoqing va provider token oling.

## 📝 API Documentation

### Authentication

**POST /api/auth/login**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": { ... }
}
```

### Messages

**GET /api/messages?is_dispatcher=false&limit=50**

**POST /api/messages/:id/approve**

**POST /api/messages/:id/send**

**POST /api/messages/:id/block-sender**

## 🤝 Contributing

Pull requestlar qabul qilinadi! Katta o'zgarishlar uchun avval issue oching.

## 📄 License

MIT License

## 👨‍💻 Muallif

Logistika Dispatch Filter System

## 📞 Support

Savollar uchun:
- 📧 Email: support@logistics.uz
- 💬 Telegram: @support

---

**⚠️ Disclaimer:** Bu tizim faqat qonuniy maqsadlarda ishlatilishi kerak. Telegram TOS ni buzmaslik uchun account limitlarini kuzatib boring.
