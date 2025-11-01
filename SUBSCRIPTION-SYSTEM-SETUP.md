# Obuna va VIP Tizimi - O'rnatish Qo'llanmasi

## Sistema Haqida

Bu obuna va VIP referral tizimi quyidagi asosiy xususiyatlarga ega:

### ✅ Obuna Tizimi
- **Grandfather Status**: 02.11.2025 18:00 gacha ro'yxatdan o'tgan userlar cheksiz bepul obuna oladilar
- **Trial**: Yangi userlar uchun 1 kunlik bepul sinov
- **Haftalik Obuna**: 30,000 so'm (7 kun)
- **Oylik Obuna**: 70,000 so'm (30 kun)

### 🌟 VIP Referral Tizimi
- **Faqat birinchi 100 ta obunachi** VIP statusini oladi
- VIP userlar **cheksiz referral** olib kelishi mumkin
- Har bir referraldan **50% komissiya**
- 101+ obunachi - oddiy foydalanuvchi (referral income yo'q)

### 💳 To'lov Tizimi
- Click.uz integratsiya
- Payme integratsiya
- Balans orqali to'lov (referral tushumlari)

---

## 📦 Yaratilgan Fayllar

### Backend Models
```
backend/src/models/
  ├── Subscription.js       # Obuna tizimi
  ├── Referral.js          # Referral tracking
  ├── VIPUser.js           # VIP a'zolar (100 limit)
  └── User.js              # Updated with VIP methods
```

### Backend Services
```
backend/src/services/
  ├── bot-subscription-handler.js  # Bot obuna va referral handlers
  └── payment-handler.js           # Click/Payme integratsiya
```

### Backend Routes
```
backend/src/routes/
  ├── subscriptions.js     # Obuna boshqaruv API
  └── payment.js           # To'lov API endpoints
```

### Backend Middleware
```
backend/src/middleware/
  └── subscription-check.js  # Obuna tekshirish middleware
```

### Frontend Dashboard
```
frontend/public/
  ├── subscriptions.html   # Obunalar boshqaruv sahifasi
  └── vip.html            # VIP a'zolar sahifasi
```

---

## 🔧 O'rnatish

### 1. Environment Variables (.env fayliga qo'shing)

```env
# Click.uz To'lov Tizimi
CLICK_SERVICE_ID=your_service_id
CLICK_SECRET_KEY=your_secret_key
CLICK_MERCHANT_USER_ID=your_merchant_user_id

# Payme To'lov Tizimi
PAYME_MERCHANT_ID=your_merchant_id
PAYME_SECRET_KEY=your_secret_key

# Application URL
APP_URL=http://localhost:3001
```

### 2. Database Initialization

Database avtomatik yaratiladi (LowDB). Quyidagi tablelar qo'shiladi:

```json
{
  "subscriptions": [],
  "vip_users": [],
  "referrals": [],
  "user_balances": [],
  "telegram_users": [],
  "payments": [],
  "payme_transactions": []
}
```

### 3. Bot Integration

Bot faylida (telegram-bot.js) quyidagi qo'shimchalarni qiling:

```javascript
const subscriptionHandler = require('./bot-subscription-handler');
const { checkSubscription } = require('../middleware/subscription-check');

// Middleware - har bir xabarda obunani tekshirish
bot.use(checkSubscription);

// Commands
bot.command('start', subscriptionHandler.handleStart);
bot.command('trial', subscriptionHandler.handleTrial);
bot.command('subscribe', subscriptionHandler.handleSubscribe);
bot.command('referral', subscriptionHandler.handleReferral);
bot.command('mysubscription', subscriptionHandler.handleMySubscription);
```

---

## 🚀 Ishga Tushirish

### 1. Server'ni ishga tushiring
```bash
cd backend
npm install
npm run dev
```

### 2. Dashboard ochish
```
http://localhost:3001/dashboard.html
```

Yangi menyular:
- **Obunalar** - `/subscriptions.html`
- **VIP A'zolar** - `/vip.html`

---

## 📊 API Endpoints

### Obuna Boshqaruv

```
GET    /api/subscriptions                # Barcha obunalar
GET    /api/subscriptions/statistics     # Statistika
GET    /api/subscriptions/:telegram_id   # User obunasi
POST   /api/subscriptions                # Yangi obuna (admin)
PUT    /api/subscriptions/:id/deactivate # Deaktiv qilish
PUT    /api/subscriptions/:id/extend     # Uzaytirish
POST   /api/subscriptions/check-expired  # Muddati o'tganlarni check (cron)
```

### VIP Boshqaruv

```
GET    /api/subscriptions/vip/list           # VIP ro'yxati
GET    /api/subscriptions/vip/:telegram_id   # VIP ma'lumotlari
POST   /api/subscriptions/vip                # VIP yaratish
DELETE /api/subscriptions/vip/:telegram_id   # VIP olib tashlash
```

### Referral

```
GET    /api/subscriptions/referrals/top           # Top referrerlar
GET    /api/subscriptions/referrals/:telegram_id  # User referrallari
```

### To'lov

```
GET    /api/payment/plans                          # Obuna rejalari
GET    /api/payment/link/click?telegram_user_id=X&plan_type=weekly
GET    /api/payment/link/payme?telegram_user_id=X&plan_type=monthly
POST   /api/payment/click/prepare                  # Click webhook
POST   /api/payment/click/complete                 # Click webhook
POST   /api/payment/payme                          # Payme JSON-RPC
```

---

## 🔄 Workflow

### 1. Yangi User (02.11.2025 18:00 dan keyin)

```
User /start bosadi
  ↓
Sistema user yaratadi
  ↓
Obuna tekshiriladi → Yo'q
  ↓
Trial taklif qilinadi (1 kun bepul)
  ↓
User /trial bosadi
  ↓
1 kunlik trial obuna yaratiladi
  ↓
User bot funksiyalaridan foydalanadi
  ↓
1 kun o'tgach - To'lov taklif qilinadi
  ↓
User /subscribe → Haftalik/Oylik tanlaydi
  ↓
Click/Payme orqali to'lov
  ↓
Subscription yaratiladi
```

### 2. VIP Referral System

```
User obuna sotib oladi
  ↓
Sistema VIP joylarni tekshiradi (1-100)
  ↓
Agar joy bo'sh bo'lsa → VIP yaratiladi
  ↓
User VIP kodi oladi (VIP47)
  ↓
User referral havolasini oladi:
  t.me/botname?start=VIP47
  ↓
Do'sti havoladan kiradi
  ↓
Do'sti obuna sotib oladi
  ↓
VIP user 50% komissiya oladi
  ↓
Balans yangilanadi
```

### 3. Grandfather Users

```
User 02.11.2025 18:00 gacha ro'yxatdan o'tgan
  ↓
Sistema tekshiradi → Grandfather!
  ↓
Cheksiz obuna avtomatik yaratiladi
  ↓
VIP joy bo'sh bo'lsa → VIP ham beriladi
  ↓
User referral orqali pul ishlaydi
```

---

## 🛡️ Security

### Click.uz Signature Verification
```javascript
const signString = `${click_trans_id}${service_id}${CLICK_SECRET_KEY}${merchant_trans_id}${amount}${action}${sign_time}`;
const hash = crypto.createHash('md5').update(signString).digest('hex');
```

### Payme Authentication
JSON-RPC orqali, merchant_id va secret_key bilan.

---

## 📈 Monitoring

### Cron Job - Muddati o'tgan obunalar
```javascript
// Har kuni soat 00:00 da ishga tushirish kerak
fetch('/api/subscriptions/check-expired', { method: 'POST' });
```

### Statistics
- Dashboard: Real-time statistika
- `/api/subscriptions/statistics` - JSON format

---

## 🎯 Testing

### Test Subscription
```bash
curl -X POST http://localhost:3001/api/subscriptions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "telegram_user_id": "123456789",
    "username": "testuser",
    "full_name": "Test User",
    "plan_type": "trial"
  }'
```

### Test VIP Creation
```bash
curl -X POST http://localhost:3001/api/subscriptions/vip \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "telegram_user_id": "123456789",
    "username": "testuser",
    "full_name": "Test User"
  }'
```

### Test Payment Link
```bash
# Click
curl "http://localhost:3001/api/payment/link/click?telegram_user_id=123456789&plan_type=weekly"

# Payme
curl "http://localhost:3001/api/payment/link/payme?telegram_user_id=123456789&plan_type=monthly"
```

---

## 📝 Notes

1. **VIP Limit**: Faqat 100 ta VIP bo'lishi mumkin - buni hech qachon o'zgartirmang!
2. **Grandfather Deadline**: 02.11.2025 18:00 - bu vaqtni o'zgartirish uchun `User.js:231` ni edit qiling
3. **Commission Rate**: 50% - buni o'zgartirish uchun `Referral.js:39` ni edit qiling
4. **Prices**: Narxlarni o'zgartirish uchun `payment-handler.js:18-28` ni edit qiling

---

## 🐛 Troubleshooting

### Obuna yaratilmayapti
- Database permissions tekshiring
- `db.has('subscriptions')` initialized ekanligini check qiling

### VIP yaratilmayapti
- VIP limit (100) to'lganligini tekshiring
- `VIPUser.getRemainingVIPSlots()` ni check qiling

### To'lov ishlamayapti
- Click/Payme credentials to'g'ri ekanligini tekshiring
- Webhook URL'lar to'g'ri sozlanganligini check qiling
- Payment provider dashboard'ida test mode yoqilganligini tekshiring

---

## 📞 Support

Savollar bo'lsa, README ni o'qing yoki admin bilan bog'laning.

**Sistema tayyor! 🚀**
