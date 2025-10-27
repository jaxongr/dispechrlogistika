# 📦 DATABASE BACKUP TIZIMI

Database har soat avtomatik saqlanadi va git'ga commit qilinadi.

## 🎯 XUSUSIYATLAR

✅ **Har soat avtomatik backup** - Database har soat saqlanadi
✅ **Git'ga avtomatik commit** - Backup'lar version control'da
✅ **72 soatlik tarix** - Oxirgi 3 kunlik backup'lar saqlanadi
✅ **Database statistikasi** - Blocked users, messages, groups
✅ **Log fayli** - Barcha backup jarayonlari yoziladi

## 📁 BACKUP JOYLASHUVI

```
database/
├── db.json                    # Asosiy database (runtime)
├── backup.log                 # Backup loglar
└── backups/
    ├── db_backup_20251027_200202.json
    ├── db_backup_20251027_210000.json
    └── ...                    # Oxirgi 72 soatlik backup'lar
```

## 🚀 QANDAY ISHLAYDI

### 1. Avtomatik Backup (Har soat)

Cron job har soat **:00** da backup yaratadi:

```bash
# Crontab
0 * * * * /var/www/dispatchr-logistics/backend/scripts/auto-backup-db.sh
```

### 2. Backup Jarayoni

1. Database'ni `/database/backups/` papkaga copy qiladi
2. Database statistikasini chiqaradi
3. Backup'ni git'ga commit qiladi
4. Remote'ga push qilishga harakat qiladi (optional)
5. 72 soatdan eski backup'larni o'chiradi

## 🔧 MANUAL BACKUP

Agar hoziroq backup yaratish kerak bo'lsa:

```bash
# Localda (Windows)
bash backend/scripts/auto-backup-db.sh

# Serverda (Linux)
ssh root@5.189.141.151 "cd /var/www/dispatchr-logistics && bash backend/scripts/auto-backup-db.sh"
```

## 🔄 DATABASE RESTORE

### Oxirgi backup'dan restore:

```bash
# 1. Oxirgi backup'ni toping
cd database/backups/
ls -lt db_backup_*.json | head -1

# 2. Database'ni to'xtating
pm2 stop dispatchr-logistics

# 3. Backup'dan restore qiling
cp db_backup_20251027_200202.json ../db.json

# 4. Serverni qayta ishga tushiring
pm2 start dispatchr-logistics

# 5. Tekshiring
pm2 logs dispatchr-logistics --lines 50
```

### Muayyan vaqtdan restore:

```bash
# Backup faylni tanlang (sanaga qarab)
ls -l database/backups/

# Tanlangan backup'dan restore
cp database/backups/db_backup_YYYYMMDD_HHMMSS.json database/db.json
pm2 restart dispatchr-logistics
```

### Git tarixidan restore:

```bash
# 1. Backup'larni git'da ko'ring
git log --oneline --all -- database/backups/

# 2. Kerakli commit'ni toping
git show COMMIT_HASH:database/backups/db_backup_20251027_200202.json > /tmp/restore.json

# 3. Restore qiling
pm2 stop dispatchr-logistics
cp /tmp/restore.json database/db.json
pm2 start dispatchr-logistics
```

## 📊 BACKUP STATISTIKA

Har bir backup paytida statistika chiqadi:

```bash
# Log faylni ko'rish
tail -20 database/backup.log

# Oxirgi backup statistikasi
[2025-10-27 20:02:02] 📊 Database stats: Blocked: 3331, Messages: 3160, Groups: 204
```

## ⚠️ MUHIM ESLATMALAR

1. **Database git'da YO'Q** - `database/db.json` faqat runtime'da mavjud
2. **Backup'lar git'da BOR** - `database/backups/` papka git'da
3. **72 soatlik tarix** - Eski backup'lar avtomatik o'chiriladi
4. **Cron job avtomatik** - Qo'shimcha sozlash kerak emas

## 🐛 TROUBLESHOOTING

### Backup ishlamayapti?

```bash
# 1. Cron job tekshirish
crontab -l | grep auto-backup

# 2. Log faylni tekshirish
tail -50 /var/www/dispatchr-logistics/database/backup.log

# 3. Scriptni manual test qilish
bash /var/www/dispatchr-logistics/backend/scripts/auto-backup-db.sh

# 4. Script ruxsatini tekshirish
ls -l /var/www/dispatchr-logistics/backend/scripts/auto-backup-db.sh
# -rwxr-xr-x bo'lishi kerak
```

### Backup fayllari yo'q?

```bash
# Backup papkani yaratish
mkdir -p /var/www/dispatchr-logistics/database/backups

# Manual backup yaratish
bash /var/www/dispatchr-logistics/backend/scripts/auto-backup-db.sh
```

### Git commit xatosi?

```bash
# Git config tekshirish
cd /var/www/dispatchr-logistics
git config user.name
git config user.email

# Agar bo'sh bo'lsa, sozlang
git config user.name "Server Backup"
git config user.email "backup@server.local"
```

## 📝 YOZUVLAR

### Backup yaratilganda:

```
[2025-10-27 20:02:02] 📦 Creating backup: db_backup_20251027_200202.json
[2025-10-27 20:02:02] ✅ Backup created successfully
[2025-10-27 20:02:02] 📊 Database stats: Blocked: 3331, Messages: 3160, Groups: 204
[2025-10-27 20:02:02] 📝 Committing backup to git...
[2025-10-27 20:02:03] ✅ Backup committed to git
[2025-10-27 20:02:03] ⚠️  Could not push to remote (this is OK)
[2025-10-27 20:02:03] 🧹 Cleaning up old backups...
[2025-10-27 20:02:03] 📁 Backup files remaining: 72
[2025-10-27 20:02:03] ✅ Backup process completed!
```

## 🔐 XAVFSIZLIK

- ✅ Backup'lar faqat serverda (local git)
- ✅ Remote'ga push optional (parolsiz ishlamaydi)
- ✅ 72 soatlik tarix - disk to'lmaydi
- ✅ Log fayl bilan monitoring

---

**Endi sizning database'ingiz xavfsiz!** 🎉

Qachondur muammo bo'lsa, oxirgi 3 kun ichidagi istalgan vaqtga qaytishingiz mumkin!
