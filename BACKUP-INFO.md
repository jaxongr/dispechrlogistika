# BACKUP YARATILDI: 2025-10-30

## Git Tag: v1.0-stable-2025-10-30

## Bugungi o'zgarishlar:

1. ✅ Yuk qidirish - sahifalash (10 ta e'lon har sahifada)
2. ✅ "Olindi" bosilgan e'lonlar qidiruvda ko'rinmaydi
3. ✅ Telegram xabarga o'tish linki to'g'rilandi (public guruhlar uchun)
4. ✅ Foydalanuvchi statistikasi kengaytirildi (e'lonlar + haydovchilar + qarz)
5. ✅ 180+ shahar va tuman, 10,000+ kalit so'z qo'shildi
6. ✅ Chiroqchi tumani qo'shildi
7. ✅ Auto-reply tarixi olib tashlandi

## Database Backup:
- **Fayl:** `/var/www/dispatchr-logistics/database/db-backup-2025-10-30.json`
- **Hajmi:** 15MB
- **Sana:** 2025-10-30 18:30

---

## QANDAY QAYTIB OLISH KERAK:

### 1. Local'da (kompyuterda):

```bash
cd "C:\Users\Pro\Desktop\Dispechrlar uchun logistika"
git checkout v1.0-stable-2025-10-30
```

### 2. Server'da:

```bash
ssh root@5.189.141.151
cd /var/www/dispatchr-logistics
git fetch --tags
git checkout v1.0-stable-2025-10-30
pm2 restart dispatchr-logistics
```

### 3. Database'ni qaytarish:

```bash
ssh root@5.189.141.151
cd /var/www/dispatchr-logistics
cp database/db-backup-2025-10-30.json database/db.json
pm2 restart dispatchr-logistics
```

---

## Oxirgi 10 ta commit:

1. 22b1e4f - Fix: Add Chiroqchi district and remove short keywords from Chirchiq
2. 3597051 - Feature: Exclude taken cargo from search results
3. 4748ea3 - Fix: Hardcode yoldauz username for YO'LDA target channel
4. 0f3841f - Fix: Use correct Telegram link format for public groups
5. 70e4613 - Feature: Add pagination to cargo search results
6. 455fe74 - Fix: Increase cargo search results limit from 10 to 30
7. 6d7f75f - Fix: Remove auto-reply history feature and enhance user statistics
8. e99afe6 - Fix: Add 'yaypan' keyword variants to Yozyovon district
9. 1cc8cd9 - MASSIVE: Butun O'zbekiston - 180+ shahar va tuman, 10,000+ kalit so'z!
10. b528202 - Improve: Xato yozishga bardoshli kalit so'zlar

---

## Eslatma:

Bu backup'dan keyin har qanday o'zgarishlar qilsangiz va muammo chiqsa, yuqoridagi komandalar bilan aynan shu holatga qaytib kelishingiz mumkin!
