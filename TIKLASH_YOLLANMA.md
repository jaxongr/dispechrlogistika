# 🔄 TIKLASH YO'LLANMASI (RESTORE INSTRUCTIONS)
**Sanasi:** 2025-10-24
**Commit:** 8273275 (Complete dispatcher filtering system - full backup checkpoint)

---

## 📦 BACKUP JOYLASHUVI

### Lokal (kompyuteringizda):
1. **ZIP backup:** `C:\Users\Pro\Desktop\dispatchr-backup-2025-10-24.zip`
2. **Git bundle:** `C:\Users\Pro\Desktop\dispatchr-git-backup-2025-10-24.bundle`

### Server (5.189.141.151):
1. **ZIP backup:** `/root/backups/dispatchr-backup-2025-10-24.zip`
2. **Git bundle:** `/root/backups/dispatchr-git-backup-2025-10-24.bundle`

---

## 🚨 LOYIHANI TIKLASH BUYRUQLARI

### VARIANT 1: Git orqali tiklash (ENG OSON)

Agar loyiha buzilsa, shu commit'ga qaytish uchun:

```bash
cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika"
git reset --hard 8273275
```

**OGOHLATIRISH:** Bu commit'dan keyin qilgan barcha o'zgarishlaringiz o'chadi!

Agar faqat ma'lum fayllarni tiklash kerak bo'lsa:
```bash
cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika"
git checkout 8273275 -- backend/src/services/message-filter.js
git checkout 8273275 -- backend/src/services/telegram-bot.js
```

---

### VARIANT 2: ZIP backup'dan to'liq tiklash

Agar git ishlamasa yoki butun loyihani tiklash kerak bo'lsa:

```powershell
# 1. Eski loyihani o'chirish (yoki nusxa olish)
cd C:\Users\Pro\Desktop
Move-Item "Dispechrlar uchun logistika" "Dispechrlar uchun logistika.OLD"

# 2. Backup'ni ochish
Expand-Archive -Path "dispatchr-backup-2025-10-24.zip" -DestinationPath "."
```

---

### VARIANT 3: Git bundle'dan tiklash

Agar hamma narsa yo'q bo'lib ketsa:

```bash
# 1. Yangi papka yaratish
cd C:\Users\Pro\Desktop
mkdir "Dispechrlar-restored"
cd "Dispechrlar-restored"

# 2. Git bundle'dan clone qilish
git clone ../dispatchr-git-backup-2025-10-24.bundle .

# 3. Kerakli commit'ga o'tish
git checkout 8273275
```

---

## 🖥️ SERVERDA TIKLASH

### Server backup'dan tiklash:

```bash
# SSH orqali serverga kirish
ssh root@5.189.141.151

# 1. Hozirgi loyihadan backup olish
cd /var/www
tar -czf dispatchr-old-$(date +%Y%m%d-%H%M%S).tar.gz dispatchr-logistics/

# 2. Eski loyihani o'chirish
rm -rf dispatchr-logistics/

# 3. Backup'dan tiklash
cd /root/backups
unzip dispatchr-backup-2025-10-24.zip -d /var/www/
mv "/var/www/Dispechrlar uchun logistika" /var/www/dispatchr-logistics

# 4. PM2'ni qayta ishga tushirish
cd /var/www/dispatchr-logistics/backend
npm install
pm2 restart dispatchr-logistics
```

---

## 📋 BU BACKUP'DA MAVJUD FUNKSIYALAR

✅ **10 ta dispetcher detection qoidalari:**
1. Xorijiy yo'nalishlar (166 ta joy: Rossiya, Qozog'iston, Turkiya, va hokazo)
2. Ko'p bo'sh qatorlar (3+ ketma-ket bo'sh qator)
3. Emoji spam (3+ emoji)
4. Uzun xabarlar (250+ belgi)
5. Shubhali profil (uzun username, noodatiy belgilar)
6. Ko'p guruhlar (50+ guruh)
7. Spam (10+ xabar/5min)
8. Dublikat xabarlar (10 daqiqa telefon, 20 daqiqa xabar)
9. Dispetcher kalit so'zlar (username/bio'da)
10. Telefon raqam yo'q (reject)

✅ **Bloklash tizimi:**
- User ID bo'yicha bloklash
- Telefon raqam bo'yicha bloklash
- Retroaktiv telefon bloklash (user'ning barcha xabarlaridagi telefonlar)
- Guruh a'zolari "Bu dispetcher ekan" tugmasi orqali bloklash

✅ **Frontend:**
- Telefon formatlash (+998 XX XXX XX XX)
- Bloklangan userlar sahifasi (guruh count bilan)
- Clickable sender profil linklari
- Xabar manbasi linklari ("Manba: Bu yerda")
- User ID hashtaglari (#ID123456)

✅ **Database:**
- blocked_users jadvali
- blocked_phones jadvali
- messages jadvali (group_message_id bilan)
- telegram_groups jadvali

---

## 🔍 BACKUP TEKSHIRISH

Backup to'g'ri yaratilganligini tekshirish:

```bash
# ZIP backup hajmi
dir "C:\Users\Pro\Desktop\dispatchr-backup-2025-10-24.zip"

# Git bundle tekshirish
cd "C:\Users\Pro\Desktop"
git bundle verify dispatchr-git-backup-2025-10-24.bundle

# Server backup tekshirish
ssh root@5.189.141.151 "ls -lh /root/backups/"
```

---

## 💡 MASLAHATLAR

1. **Tez-tez commit qiling!** Har katta o'zgarishdan keyin git commit qiling
2. **Serverga yuklashdan oldin test qiling** - lokal muhitda test qilmasdan serverga yubormang
3. **Backup'lar soni ko'p bo'lsin** - bir nechta joyda saqlang (lokal, server, cloud)
4. **Commit hash'ni yozib qo'ying** - muhim commit'larning hash'larini alohida yozib qo'ying

---

## ⚠️ MUHIM ESLATMALAR

- Barcha backup'lar **2025-10-24** sanasidagi holatni saqlaydi
- Git commit hash: **8273275**
- Bu commit'dan keyin qilgan o'zgarishlar backup'da YO'Q!
- PM2 restart qilishni unutmang serverda tiklashdan keyin
- `.env` faylini alohida saqlang - u backup'da YO'Q!

---

## 📞 QISQA BUYRUQLAR (COPY-PASTE)

**Lokal git tiklash:**
```bash
cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika" && git reset --hard 8273275
```

**Server tiklash (to'liq):**
```bash
ssh root@5.189.141.151 "cd /var/www && tar -czf dispatchr-old-\$(date +%Y%m%d).tar.gz dispatchr-logistics/ && rm -rf dispatchr-logistics/ && cd /root/backups && unzip -q dispatchr-backup-2025-10-24.zip -d /var/www/ && mv '/var/www/Dispechrlar uchun logistika' /var/www/dispatchr-logistics && cd /var/www/dispatchr-logistics/backend && pm2 restart dispatchr-logistics"
```

**Faqat message-filter.js tiklash:**
```bash
cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika" && git checkout 8273275 -- backend/src/services/message-filter.js
```

---

✅ **Backup muvaffaqiyatli yaratildi!**
📅 **Sana:** 2025-10-24
🔒 **Commit:** 8273275
📦 **Hajm:** ~20MB (ZIP), ~5MB (Git bundle)
