# 🔄 BACKUP & RESTORE GUIDE

**Backup yaratilgan sana:** 2025-10-25
**Stable Version:** v1.0-stable
**Git Commit:** 93f17b5

---

## 📦 HOZIRGI LOYIHA HOLATI

✅ **Ishlayotgan funksiyalar:**
- E'lonlarni avtomatik filter qilish
- Dispatcher auto-detection
- Auto-reply (Telegram Session orqali)
- SemySMS integratsiya
- Bloklash tizimi
- Dashboard
- Statistika

✅ **Auto-Reply Settings:**
- Minutlik limit: 5 ta (1-10 sozlanadi)
- Soatlik limit: 100 ta (1-200 sozlanadi)
- Delay: 13-17 soniya (flood control)
- Background ishlash (e'lonlarni bloklamaydi)

---

## 🚨 RESTORE QILISH (Hozirgi holatga qaytarish)

### **Variant 1: Git Tag orqali (TAVSIYA ETILADI)**

```bash
# 1. Hozirgi holatga qaytarish
git fetch --all --tags
git checkout v1.0-stable

# 2. Serverga deploy qilish
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git fetch --all --tags && git checkout v1.0-stable && pm2 restart dispatchr-logistics"
```

### **Variant 2: Commit Hash orqali**

```bash
# 1. Hozirgi commit'ga qaytarish
git reset --hard 93f17b5

# 2. Serverga deploy qilish
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git fetch origin && git reset --hard 93f17b5 && pm2 restart dispatchr-logistics"
```

---

## 📋 CLAUDE CODE BUYRUQLARI

### **To'liq restore uchun:**

```
Loyihani v1.0-stable tag'iga qaytaring. Qadamlar:
1. git fetch --all --tags
2. git checkout v1.0-stable
3. ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git fetch --all --tags && git checkout v1.0-stable && pm2 restart dispatchr-logistics"
```

### **Faqat server restore:**

```
Serverdagi loyihani stable holatga qaytaring:
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git fetch --all --tags && git checkout v1.0-stable && pm2 restart dispatchr-logistics"
```

---

## 🗂️ DATABASE BACKUP

```bash
# Server backup yaratish
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && cp database/db.json database/db.backup.\$(date +%Y%m%d_%H%M%S).json"

# Database restore
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && cp database/db.backup.YYYYMMDD_HHMMSS.json database/db.json && pm2 restart dispatchr-logistics"
```

---

## ⚠️ EMERGENCY RESTORE

Agar hamma narsa buzilsa:

```bash
# Local restore
git fetch --all --tags
git checkout v1.0-stable

# Server restore
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && git fetch --all --tags && git checkout v1.0-stable && pm2 restart dispatchr-logistics"
```

---

**MUHIM:** Bu v1.0-stable - to'liq ishlayotgan versiya!
