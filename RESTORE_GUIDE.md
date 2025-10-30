# 🔄 TIKLASH BO'YICHA QO'LLANMA (RESTORE GUIDE)

**Sana:** 30 Oktyabr 2025
**Versiya:** v2.3-stable
**Status:** ✅ Production Ready

---

## 📋 MUNDARIJA

1. [Hozirgi Stable Versiya](#hozirgi-stable-versiya)
2. [Koddan Tiklash](#koddan-tiklash)
3. [Database Tiklash](#database-tiklash)
4. [To'liq Tiklash](#toliq-tiklash)

---

## 🎯 HOZIRGI STABLE VERSIYA

### **v2.3-stable** (30 Oktyabr 2025)

**Commit:** `f0b39f9`

**Yangi Funksiyalar:**
- ✅ **Avtomatik Reklama Scheduler** (har X ta e'londan keyin)
- ✅ Dashboard'da reklama sozlash UI
- ✅ Reklama preview va test yuborish
- ✅ Counter reset funksiyasi
- ✅ Reklama format: @Yukchiborbot boshida va oxirida
- ✅ Telefon bermagan userlarga eslatma yuborish
- ✅ Dashboard'da ro'yxatdan o'tganlar ro'yxati

**Oldingi Funksiyalar (v2.2):**
- ✅ Telefon raqam bilan ro'yxatdan o'tish
- ✅ Foydalanuvchilar statistikasi (`/users` komanda)
- ✅ **Foydalanuvchilar sahifasi** (`users.html`)
- ✅ Haydovchilar tizimi (qora/oq ro'yxat)
- ✅ Qarz miqdori (qora ro'yxat - 3 bosqichli)
- ✅ Navigatsiya tugmalari (orqaga/bosh menyu hamma joyda)
- ✅ Reply keyboard (klavyatura tugmalari)
- ✅ Statistika va hisobotlar
- ✅ Xavfsizlik (admin panel)
- ✅ Avtomatik backup (har soat + kunlik)

**API Endpoints:**
- `GET /api/statistics/bot-stats` - Bot statistikasi
- `GET /api/users/registered` - Ro'yxatdan o'tgan userlar
- `GET /api/users/all` - Barcha userlar
- `POST /api/users/send-reminder` - Telefon bermagan userlarga eslatma
- `GET /api/ad-scheduler/settings` - Reklama sozlamalari
- `POST /api/ad-scheduler/update` - Reklama sozlamalarni yangilash
- `POST /api/ad-scheduler/send-now` - Test reklama yuborish
- `POST /api/ad-scheduler/reset-counter` - Counter reset
- `GET /api/ad-scheduler/stats` - Reklama statistikasi

**Database:**
- Asosiy: 15 MB
- Backup: 15 MB (manual v2.3 - 20251030_154955)
- Foydalanuvchilar: 87 ta (42 ro'yxatdan o'tgan)

---

## 💻 KODDAN TIKLASH

### 1️⃣ Stable Versiyaga Qaytish

Agar kod buzilgan bo'lsa, oxirgi stable versiyaga qaytish:

```bash
# Local kompyuterda
cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika"

# Hozirgi o'zgarishlarni saqlash (agar kerak bo'lsa)
git stash

# Stable versiyaga qaytish
git checkout v2.3-stable

# Yoki commit hash orqali
git checkout f0b39f9

# Serverga yuklash
git push origin main --force
```

### 2️⃣ Serverda Yangilash

```bash
# Serverga kirish
ssh root@5.189.141.151

# Loyiha papkasiga o'tish
cd /var/www/dispatchr-logistics

# Stable versiyaga o'tish
git fetch --all
git checkout v2.3-stable

# Yoki
git reset --hard f0b39f9

# Dependency larni yangilash
cd backend
npm install

# Bot restart
pm2 restart dispatchr-logistics
```

---

## 💾 DATABASE TIKLASH

### 1️⃣ Oxirgi Backupni Topish

```bash
# Serverga kirish
ssh root@5.189.141.151

# Barcha backuplarni ko'rish
ls -lth /var/www/dispatchr-logistics/backups/daily/ | head -10

# Eng oxirgi backup
ls -lt /var/www/dispatchr-logistics/backups/daily/ | head -2
```

### 2️⃣ Database Tiklash

```bash
# Avval joriy database ni saqlash (ehtiyot uchun)
cp /var/www/dispatchr-logistics/database/db.json /var/www/dispatchr-logistics/database/db_before_restore_$(date +%Y%m%d_%H%M%S).json

# Backup dan tiklash (oxirgi kunlik)
cp /var/www/dispatchr-logistics/backups/daily/db_backup_2025-10-28_02-00-02.json /var/www/dispatchr-logistics/database/db.json

# Yoki ma'lum bir sana
cp /var/www/dispatchr-logistics/backups/daily/db_backup_2025-10-27_02-00-01.json /var/www/dispatchr-logistics/database/db.json

# Bot restart
pm2 restart dispatchr-logistics

# Tekshirish
pm2 logs dispatchr-logistics --lines 20
```

### 3️⃣ Backup Joylari

**Kunlik backup (Avtomatik):**
```
📂 Joylashuv: /var/www/dispatchr-logistics/backups/daily/
⏰ Vaqt: Har kecha 02:00 da
📊 Saqlanish: 7-10 kun
🗑️ Auto-delete: 10 kundan eski

Hozirgi backuplar:
- db_backup_2025-10-30_02-00-01.json (13 MB)
- db_backup_2025-10-29_02-00-01.json (11 MB)
- db_backup_2025-10-28_02-00-02.json (6.4 MB)
- db_backup_2025-10-27_02-00-01.json (9.4 MB)
- db_backup_2025-10-26_02-00-01.json (7.4 MB)
- db_backup_2025-10-25_02-00-01.json (58 KB)
- db_backup_2025-10-24_02-00-01.json (782 KB)
```

**Manual backup:**
```
📂 Joylashuv: /var/www/dispatchr-logistics/database/backups/
💾 Saqlanish: Doimiy (o'chirilmaydi)

Hozirgi backuplar:
- db.backup.manual_v2.3_20251030_154955.json (15 MB) ← OXIRGI
```

**⚠️ ESLATMA:**
- Avtomatik backup 10 kundan keyin o'chiriladi
- Agar uzoq muddatli backup kerak bo'lsa, manual backup yarating
- Manual backuplar hech qachon o'chirilmaydi

---

## 🔄 TO'LIQ TIKLASH

Agar hamma narsa buzilgan bo'lsa, to'liq tiklash:

### 1️⃣ Kod + Database Tiklash

```bash
# Serverga kirish
ssh root@5.189.141.151

# Bot to'xtatish
pm2 stop dispatchr-logistics

# Kod tiklash
cd /var/www/dispatchr-logistics
git fetch --all
git checkout v2.3-stable
git reset --hard f0b39f9

# Database tiklash (oxirgi backup)
cp /var/www/dispatchr-logistics/database/backups/db.backup.manual_v2.3_20251030_154955.json /var/www/dispatchr-logistics/database/db.json

# Dependency lar
cd backend
npm install

# Bot restart
pm2 restart dispatchr-logistics

# Monitoring
pm2 logs dispatchr-logistics
```

### 2️⃣ .env Faylni Tekshirish

```bash
cat /var/www/dispatchr-logistics/backend/.env | grep -E "BOT_TOKEN|ADMIN_IDS|GROUP_ID"
```

Kerakli o'zgaruvchilar:
- `TELEGRAM_BOT_TOKEN`
- `TARGET_GROUP_ID`
- `ADMIN_IDS=5772668259`

---

## 📊 VERSIYA TARIXI

| Versiya | Sana | Commit | Tavsif |
|---------|------|--------|--------|
| **v2.3-stable** | 30 Okt 2025 | `f0b39f9` | Reklama scheduler + eslatma + dashboard ro'yxati |
| v2.2-stable | 28 Okt 2025 | `762cba0` | Foydalanuvchilar sahifasi + qarz miqdori + orqaga tugmalari |
| v2.1-stable | 28 Okt 2025 | `0ec60fb` | Telefon ro'yxatdan o'tish + foydalanuvchilar statistikasi |
| v2.0-stable | 28 Okt 2025 | - | Haydovchilar tizimi to'liq |
| v1.4 | - | - | Haydovchilar sistemasi oldin |
| v1.3 | - | - | 6986 userlar backup |
| v1.2 | - | - | Broadcast bot |
| v1.1 | - | - | Asosiy funksiyalar |

---

## 🎬 SENARYOLAR (Real Misollar)

### Senariya 1: Kod Buzildi, Database Saqlansin

**Vaziyat:** 20 Noyabr 2025 da kod xato kiritdingiz va bot ishlamay qoldi. Database'da 20,000 bloklangan, 500+ ro'yxatdan o'tgan bor.

**Yechim:**
```bash
# 1. Kod tiklash (database o'zgarmaydi)
ssh root@5.189.141.151
cd /var/www/dispatchr-logistics
git checkout v2.3-stable
pm2 restart dispatchr-logistics
```

**Natija:**
- ✅ Kod: 30 Okt 2025 holatiga qaytdi (v2.3-stable)
- ✅ Database: 20 Noyabr holatida qoldi (20k bloklangan, 500+ user)
- ✅ Bot ishlaydi, hamma ma'lumotlar saqlanadi!

---

### Senariya 2: Database Buzildi, Bir Necha Kun Orqaga Qaytish

**Vaziyat:** 25 Noyabr da database'ga xato kiritdingiz. 22 Noyabr holatiga qaytmoqchisiz (oxirgi 7 kun ichida).

**Yechim:**
```bash
# 1. Mavjud backuplarni ko'rish
ssh root@5.189.141.151
ls -lth /var/www/dispatchr-logistics/backups/daily/ | head -10

# 2. 22 Noyabr backupni tiklash
cd /var/www/dispatchr-logistics
cp backups/daily/db_backup_2025-11-22_02-00-01.json database/db.json
pm2 restart dispatchr-logistics
```

**Natija:**
- ✅ Kod: O'zgarmaydi (hozirgi holat)
- ✅ Database: 22 Noyabr 02:00 holatiga qaytdi
- ⚠️ 22-25 Noyabr orasidagi ma'lumotlar yo'qoldi

---

### Senariya 3: Kod va Database Ikkalasi Ham Buzildi

**Vaziyat:** 15 Noyabr da hamma narsa buzildi. Kod ham, database ham tiklash kerak.

**Yechim:**
```bash
ssh root@5.189.141.151
cd /var/www/dispatchr-logistics

# 1. Kod tiklash
git checkout v2.3-stable
git reset --hard f0b39f9

# 2. Database tiklash (oxirgi 7 kun ichida)
ls -lth backups/daily/ | head -7
cp backups/daily/db_backup_2025-11-14_02-00-01.json database/db.json

# 3. Restart
pm2 restart dispatchr-logistics
```

**Natija:**
- ✅ Kod: 30 Okt 2025 holatiga qaytdi
- ✅ Database: 14 Noyabr 02:00 holatiga qaytdi
- ⚠️ 14 Noyabrdan keyingi database o'zgarishlari yo'qoldi

---

### Senariya 4: 10 Kundan Ortiq Database Tiklash (MUMKIN EMAS)

**Vaziyat:** 1 Dekabr da 10 Noyabr holatiga qaytmoqchisiz (10+ kun orqaga).

**Muammo:**
- ❌ Avtomatik backup faqat 7-10 kun saqlanadi
- ❌ 10 Noyabr backup o'chirilgan

**Yechim:**
- Agar manual backup qilgan bo'lsangiz, uni tiklang
- Aks holda, database'ni tiklash mumkin emas

**Xulosa:**
- ⚠️ **Har oyda bir marta manual backup qiling!**
- ⚠️ Manual backup'lar hech qachon o'chirilmaydi

---

## 🆘 MUAMMOLAR VA YECHIMLAR

### Problem: Bot ishlamayapti

**Yechim:**
```bash
pm2 restart dispatchr-logistics
pm2 logs dispatchr-logistics --lines 50
```

### Problem: Database yo'q

**Yechim:**
```bash
cp /var/www/dispatchr-logistics/backups/daily/db_backup_*.json /var/www/dispatchr-logistics/database/db.json
pm2 restart dispatchr-logistics
```

### Problem: Kod buzilgan

**Yechim:**
```bash
cd /var/www/dispatchr-logistics
git checkout v2.3-stable
git reset --hard f0b39f9
pm2 restart dispatchr-logistics
```

---

## 📞 QO'SHIMCHA YORDAM

Agar yuqoridagi usullar ishlamasa:

1. PM2 holatini tekshiring: `pm2 status`
2. Loglarni ko'ring: `pm2 logs dispatchr-logistics`
3. Server xotirasi: `free -h`
4. Disk xotirasi: `df -h`

---

## ✅ TEKSHIRISH

Tiklashdan keyin tekshirish:

```bash
# Bot ishlayaptimi?
pm2 status

# Database hajmi
ls -lh /var/www/dispatchr-logistics/database/db.json

# Bot logda xato yo'qmi?
pm2 logs dispatchr-logistics --lines 20 --nostream

# Telegram'da /start yuboring
# Javob qaytishi kerak
```

---

## 🎯 MUHIM KO'RSATMALAR

### Kod Buzilganda:
```bash
# 1. Stable versiyaga qaytish
git checkout v2.3-stable

# 2. Serverga deploy
ssh root@5.189.141.151
cd /var/www/dispatchr-logistics
git pull origin main
pm2 restart dispatchr-logistics
```

### Database Buzilganda:
```bash
# 1. Oxirgi backupni tiklash
ssh root@5.189.141.151
cd /var/www/dispatchr-logistics
cp database/backups/db.backup.manual_v2.3_20251030_154955.json database/db.json
pm2 restart dispatchr-logistics
```

### ⚠️ MUHIM ESLATMA:

#### **Kod Buzilganda:**
- ✅ Git tag orqali hozirgi holatga qaytaradi: `v2.3-stable`
- ✅ Kod: 30 Okt 2025 holatiga qaytadi (reklama scheduler bilan)
- ✅ Database: **O'ZGARMAYDI** (oxirgi holat saqlanadi)

#### **Database Buzilganda:**
- ✅ Avtomatik kunlik backup'dan tiklash mumkin
- ⚠️ **Cheklash:** Faqat oxirgi 7-10 kunlik backuplar mavjud
- ✅ Har kecha 02:00 da avtomatik backup olinadi

#### **Misol:**
Agar **20 Noyabr 2025** da kod buzilsa:
1. **Kod** → 30 Okt 2025 holatiga qaytadi (v2.3-stable)
2. **Database** → 20 Noyabr holatida qoladi (11900+ bloklangan, 500+ ro'yxatdan o'tgan)
3. **Natija:** Kod eski, lekin database oxirgi holat ✅

Agar **database** ham tiklash kerak bo'lsa:
- Faqat oxirgi 7-10 kunlik backup mavjud
- Masalan: 13-20 Noyabr oralig'idagi backupni tiklash mumkin

---

---

## 🔥 ENG MUHIM QOIDALAR

1. **✅ Kod tiklash = Database saqlanadi**
   - Kod buzilganda: `git checkout v2.3-stable`
   - Database o'zgarmaydi (oxirgi holat)

2. **⚠️ Database tiklash = Ma'lumot yo'qoladi**
   - Faqat oxirgi 7-10 kunlik backup mavjud
   - Tiklasangiz, oxirgi o'zgarishlar yo'qoladi

3. **💾 Har oyda manual backup qiling!**
   ```bash
   ssh root@5.189.141.151
   cd /var/www/dispatchr-logistics
   timestamp=$(date +%Y%m%d_%H%M%S)
   cp database/db.json database/backups/db.backup.manual_v2.X_${timestamp}.json
   ```

4. **📊 Database o'sishini kuzating**
   - Hozir: 15 MB (87 users)
   - 20k bloklangan, 500+ user = ~50-100 MB (taxminiy)
   - Katta database = katta backup

---

**📝 Eslatma:** Bu hujjatni saqlab qo'ying! Muammo bo'lganda kerak bo'ladi.

**📅 Oxirgi yangilanish:** 30 Oktyabr 2025
**👤 Muallif:** AI Assistant
**🤖 Bot:** @Yukchiborbot

**🔗 GitHub:** https://github.com/jaxongr/dispechrlogistika
**🏷️ Tag:** v2.3-stable
