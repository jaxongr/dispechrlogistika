# 🔄 LOYIHANI TO'LIQ TIKLASH YO'LLANMASI

**Muallif:** Claude Code  
**Sana:** 2025-10-24  
**Git Commit:** `git log --oneline -1`

Bu yo'llanma kod buzilganda yoki muammolar bo'lganda **hozirgi ishlaydigan holatga** qaytarish uchun.

---

## 📦 1. TO'LIQ BACKUP (hozirgi holat)

### Server'dagi hozirgi holatni saqlash:

```bash
# Server'ga ulanish
ssh root@5.189.141.151

# Backup yaratish
cd /var/www
tar -czf dispatchr-logistics-backup-$(date +%Y%m%d-%H%M%S).tar.gz dispatchr-logistics/

# Backup'ni local kompyuterga yuklash
exit
scp root@5.189.141.151:/var/www/dispatchr-logistics-backup-*.tar.gz "C:\Users\Pro\Desktop\Backups\"
```

---

## 🔙 2. GIT ORQALI TO'LIQ TIKLASH

### Kompyuterdan serverga to'liq loyihani yuklash:

```bash
# 1. Hozirgi git holatini ko'rish
cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika"
git log --oneline -10

# 2. Server'dagi eski fayllarni o'chirish va yangi yuklash
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && pm2 stop dispatchr-logistics"

# 3. Backend yuklash
scp -r "C:\Users\Pro\Desktop\Dispechrlar uchun logistika\backend" root@5.189.141.151:/var/www/dispatchr-logistics/

# 4. Frontend yuklash
scp -r "C:\Users\Pro\Desktop\Dispechrlar uchun logistika\frontend" root@5.189.141.151:/var/www/dispatchr-logistics/

# 5. Database yuklash
scp -r "C:\Users\Pro\Desktop\Dispechrlar uchun logistika\database" root@5.189.141.151:/var/www/dispatchr-logistics/

# 6. Node modules o'rnatish
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics/backend && npm install"

# 7. PM2 qayta ishga tushirish
ssh root@5.189.141.151 "pm2 restart dispatchr-logistics"

# 8. Loglarni tekshirish
ssh root@5.189.141.151 "pm2 logs dispatchr-logistics --lines 50"
```

---

## ⚡ 3. BIR BUYRUQ BILAN TO'LIQ TIKLASH

```bash
cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika" && ssh root@5.189.141.151 "pm2 stop dispatchr-logistics" && scp -r backend root@5.189.141.151:/var/www/dispatchr-logistics/ && scp -r frontend root@5.189.141.151:/var/www/dispatchr-logistics/ && ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics/backend && npm install" && ssh root@5.189.141.151 "pm2 restart dispatchr-logistics"
```

---

## 🗄️ 4. DATABASE BACKUP VA TIKLASH

```bash
# Backup
scp root@5.189.141.151:/var/www/dispatchr-logistics/database/db.json "C:\Users\Pro\Desktop\Backups\db-backup.json"

# Tiklash
scp "C:\Users\Pro\Desktop\Backups\db-backup.json" root@5.189.141.151:/var/www/dispatchr-logistics/database/db.json
ssh root@5.189.141.151 "pm2 restart dispatchr-logistics"
```

---

## 🚨 5. TIZKOR MUAMMOLARNI HAL QILISH

### PM2 restart:
```bash
ssh root@5.189.141.151 "pm2 restart dispatchr-logistics"
ssh root@5.189.141.151 "pm2 logs dispatchr-logistics --lines 50"
```

### Node modules muammosi:
```bash
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics/backend && rm -rf node_modules && npm install && cd /var/www/dispatchr-logistics && pm2 restart dispatchr-logistics"
```

---

## ✅ 6. TEKSHIRISH

```bash
# Server ishlayaptimi?
curl http://5.189.141.151:3001/api/health

# Dashboard: http://5.189.141.151:3001/dashboard.html

# Logs:
ssh root@5.189.141.151 "pm2 logs dispatchr-logistics --lines 30"
```

---

## 📋 7. MUHIM SOZLAMALAR

**.env fayl:**
- PORT=3001
- TELEGRAM_BOT_TOKEN=...
- TELEGRAM_TARGET_GROUP_ID=-1002496159921
- TELEGRAM_API_ID=...
- TELEGRAM_API_HASH=...
- TELEGRAM_SESSION_STRING=...
- JWT_SECRET=...

---

## 🎯 8. FUNKSIYALAR

✅ Telegram guruhlardan xabarlar o'qish  
✅ AI dispetcher detector  
✅ 15+ guruhda spam bloklash  
✅ 200+ belgi spam bloklash  
✅ Telefon raqam aniqlash  
✅ Dashboard statistika  
✅ Kunlik arxiv (00:00)  
✅ Bloklash sababi ko'rsatish  

---

**Oxirgi yangilanish:** 2025-10-24  
**🤖 Claude Code**
