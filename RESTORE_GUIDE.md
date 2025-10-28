# 🔄 TIKLASH BO'YICHA QO'LLANMA (RESTORE GUIDE)

**Sana:** 28 Oktyabr 2025
**Versiya:** v2.1-stable
**Status:** ✅ Production Ready

---

## 📋 MUNDARIJA

1. [Hozirgi Stable Versiya](#hozirgi-stable-versiya)
2. [Koddan Tiklash](#koddan-tiklash)
3. [Database Tiklash](#database-tiklash)
4. [To'liq Tiklash](#toliq-tiklash)

---

## 🎯 HOZIRGI STABLE VERSIYA

### **v2.1-stable** (28 Oktyabr 2025)

**Commit:** `0ec60fb`

**Funksiyalar:**
- ✅ Telefon raqam bilan ro'yxatdan o'tish
- ✅ Foydalanuvchilar statistikasi (`/users`)
- ✅ Haydovchilar tizimi (qora/oq ro'yxat)
- ✅ Qarz miqdori (qora ro'yxat)
- ✅ Navigatsiya tugmalari (orqaga/bosh menyu)
- ✅ Reply keyboard (klavyatura tugmalari)
- ✅ Statistika va hisobotlar
- ✅ Xavfsizlik (admin panel)
- ✅ Avtomatik backup (har soat + kunlik)

**Database:**
- Asosiy: 9.7 MB
- Backup: 31 MB (5+ kunlik)

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
git checkout v2.1-stable

# Yoki commit hash orqali
git checkout 0ec60fb

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
git checkout v2.1-stable

# Yoki
git reset --hard 0ec60fb

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

**Har soatlik backup:**
- Jami: 24 ta (oxirgi 24 soat)
- Auto-delete: 24 soatdan eski

**Kunlik backup:**
```
/var/www/dispatchr-logistics/backups/daily/
- db_backup_2025-10-28_02-00-02.json (6.4 MB)
- db_backup_2025-10-27_02-00-01.json (9.4 MB)
- db_backup_2025-10-26_02-00-01.json (7.4 MB)
- db_backup_2025-10-25_02-00-01.json (58 KB)
- db_backup_2025-10-24_02-00-01.json (782 KB)
```

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
git checkout v2.1-stable
git reset --hard 0ec60fb

# Database tiklash
cp /var/www/dispatchr-logistics/backups/daily/db_backup_2025-10-28_02-00-02.json /var/www/dispatchr-logistics/database/db.json

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
| **v2.1-stable** | 28 Okt 2025 | `0ec60fb` | Telefon ro'yxatdan o'tish + foydalanuvchilar statistikasi |
| v2.0-stable | 28 Okt 2025 | - | Haydovchilar tizimi to'liq |
| v1.4 | - | - | Haydovchilar sistemasi oldin |
| v1.3 | - | - | 6986 userlar backup |
| v1.2 | - | - | Broadcast bot |
| v1.1 | - | - | Asosiy funksiyalar |

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
git checkout v2.1-stable
git reset --hard 0ec60fb
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

**📝 Eslatma:** Bu hujjatni saqlab qo'ying! Muammo bo'lganda kerak bo'ladi.

**📅 Oxirgi yangilanish:** 28 Oktyabr 2025
**👤 Muallif:** AI Assistant
**🤖 Bot:** @Yukchiborbot
