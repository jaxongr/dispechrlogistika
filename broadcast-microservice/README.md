# 📢 Broadcast Microservice

Multi-user Telegram Broadcast System - Har bir user o'z accountidan guruhlariga xabar yuboradi.

## 🚀 Xususiyatlar

- ✅ **Multi-user** - 1000+ user bir vaqtda ishlatishi mumkin
- ✅ **Xavfsiz Rate Limiting** - Account freeze bo'lmaydi
- ✅ **Alohida mikroservis** - Asosiy loyihaga ta'sir qilmaydi
- ✅ **Auto Session Management** - Har bir user o'z sessionini yaratadi
- ✅ **Broadcast Statistics** - Real-time progress tracking

## 📦 O'rnatish

```bash
cd broadcast-microservice
npm install
```

## ⚙️ Konfiguratsiya

`.env` faylni to'ldiring:

```env
BOT_TOKEN=your_bot_token
PORT=3001
```

## 🎯 Ishga tushirish

### Local (Development)
```bash
npm start
```

### Production (PM2)
```bash
pm2 start src/index.js --name broadcast-bot
pm2 save
```

## 📱 Bot Buyruqlari

### Userlar uchun (Juda oson!):
1. `/start` - Botni boshlash
2. `/connect` → `/create_session` - Account ulash
3. Telefon raqamni yuboring: `+998901234567`
4. SMS kodni yuboring: `12345`
5. `/groups` - Guruhlaringizni ko'ring
6. `/broadcast` - Xabar yuboring!

### Boshqa buyruqlar:
- `/mystats` - Statistika
- `/help` - Yordam
- `/cancel` - Bekor qilish

⚠️ **API ID/Hash kerak emas!** Faqat telefon raqam va SMS kod!

## 🔒 Xavfsizlik

### Rate Limiting (default):
- **4 soniya** - har bir guruh orasida
- **20 ta guruh** → 30 soniya dam
- **Tsikl tugadi** → 5 daqiqa dam

Bu Telegram limitlaridan **10x sekinroq** - account freeze xavfi YO'Q!

## 🏗️ Arxitektura

```
broadcast-microservice/
├── src/
│   ├── bot/           # Telegram bot
│   ├── services/      # Broadcast engine
│   ├── models/        # Database models
│   └── config/        # Configuration
├── data/              # Database (broadcast_db.json)
├── sessions/          # User telegram sessions
└── .env               # Environment variables
```

## ⚠️ Muhim

- **Asosiy loyihaga tegmaydi** - Alohida database va port
- **User sessionlari xavfsiz** - Encrypted storage
- **Har bir user o'z accountidan** - Bot emas!

## 📊 Monitoring

```bash
# Logs
pm2 logs broadcast-bot

# Status
pm2 status

# Restart
pm2 restart broadcast-bot
```

## 🆘 Yordam

Muammo bo'lsa:
1. `.env` faylni tekshiring
2. `npm install` qayta ishga tushiring
3. `pm2 logs broadcast-bot` ni tekshiring

---

**Version**: 1.0.0
**Author**: Dispatchr Logistics Team
**License**: Private
