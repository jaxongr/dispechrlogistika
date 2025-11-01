/**
 * Database Auto-Backup Service
 * Har 6 soatda avtomatik backup oladi
 * Oxirgi 7 kunlik backup'larni saqlaydi
 */

const fs = require('fs');
const path = require('path');
const { db } = require('../config/database');

class DatabaseBackupService {
  constructor() {
    this.backupDir = path.join(__dirname, '../../../database/backups');
    this.dbPath = path.join(__dirname, '../../../database/db.json');
    this.backupInterval = 6 * 60 * 60 * 1000; // 6 soat (millisecondlarda)
    this.maxBackupAge = 7 * 24 * 60 * 60 * 1000; // 7 kun
    this.timer = null;
  }

  /**
   * Backup servisini ishga tushirish
   */
  start() {
    console.log('🔄 Database backup service ishga tushirilmoqda...');

    // Backup direktoriyasi mavjudligini tekshirish
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log('📁 Backup direktoriyasi yaratildi:', this.backupDir);
    }

    // Darhol bitta backup olish
    this.createBackup();

    // Har 6 soatda backup olish
    this.timer = setInterval(() => {
      this.createBackup();
    }, this.backupInterval);

    // Har kuni eski backup'larni tozalash (soat 03:00 da)
    this.scheduleCleanup();

    console.log('✅ Database backup service ishga tushdi!');
    console.log(`⏰ Backup interval: ${this.backupInterval / 1000 / 60 / 60} soat`);
    console.log(`🗑️ Eski backup'lar: ${this.maxBackupAge / 1000 / 60 / 60 / 24} kundan keyin o'chiriladi`);
  }

  /**
   * Backup yaratish
   */
  createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
      const backupFileName = `db_backup_${timestamp}.json`;
      const backupPath = path.join(this.backupDir, backupFileName);

      // Database'ni o'qish
      const dbData = fs.readFileSync(this.dbPath, 'utf8');
      const parsedData = JSON.parse(dbData);

      // Metadata qo'shish
      const backupData = {
        backup_timestamp: new Date().toISOString(),
        backup_version: '1.0',
        data_size_bytes: Buffer.byteLength(dbData, 'utf8'),
        tables: {
          messages: parsedData.messages?.length || 0,
          bot_users: parsedData.bot_users?.length || 0,
          blocked_users: parsedData.blocked_users?.length || 0,
          telegram_groups: parsedData.telegram_groups?.length || 0,
          bot_orders: parsedData.bot_orders?.length || 0,
          drivers: parsedData.drivers?.length || 0
        },
        ...parsedData
      };

      // Backup faylini yozish
      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

      const fileSize = fs.statSync(backupPath).size;
      const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

      console.log('✅ Database backup yaratildi!');
      console.log(`📁 Fayl: ${backupFileName}`);
      console.log(`💾 Hajm: ${fileSizeMB} MB`);
      console.log(`📊 Xabarlar: ${backupData.tables.messages}, Userlar: ${backupData.tables.bot_users}`);

      return {
        success: true,
        path: backupPath,
        size: fileSize,
        timestamp
      };
    } catch (error) {
      console.error('❌ Backup yaratishda xatolik:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Eski backup'larni tozalash
   */
  cleanOldBackups() {
    try {
      const files = fs.readdirSync(this.backupDir);
      const now = Date.now();
      let deletedCount = 0;

      files.forEach(file => {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > this.maxBackupAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`🗑️ Eski backup o'chirildi: ${file}`);
        }
      });

      console.log(`✅ Tozalash tugadi. ${deletedCount} ta eski backup o'chirildi.`);
      return { deletedCount };
    } catch (error) {
      console.error('❌ Backup tozalashda xatolik:', error.message);
      return { deletedCount: 0, error: error.message };
    }
  }

  /**
   * Tozalashni rejalashtirish (har kuni soat 03:00 da)
   */
  scheduleCleanup() {
    const now = new Date();
    const night = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      3, // Soat 03:00
      0,
      0
    );
    const msUntilNight = night.getTime() - now.getTime();

    setTimeout(() => {
      this.cleanOldBackups();
      // Keyingi kuni uchun yana rejalashtirish
      setInterval(() => {
        this.cleanOldBackups();
      }, 24 * 60 * 60 * 1000); // Har 24 soat
    }, msUntilNight);

    console.log(`🕒 Tozalash ${new Date(night).toLocaleString('uz-UZ')} da rejalashtirildi`);
  }

  /**
   * Manual backup yaratish (API yoki admin uchun)
   */
  createManualBackup(reason = 'manual') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    const backupFileName = `db_backup_${reason}_${timestamp}.json`;
    const backupPath = path.join(this.backupDir, backupFileName);

    try {
      const dbData = fs.readFileSync(this.dbPath, 'utf8');
      const parsedData = JSON.parse(dbData);

      const backupData = {
        backup_timestamp: new Date().toISOString(),
        backup_reason: reason,
        backup_type: 'manual',
        ...parsedData
      };

      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

      const fileSize = fs.statSync(backupPath).size;
      const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

      console.log(`✅ Manual backup yaratildi: ${backupFileName} (${fileSizeMB} MB)`);

      return {
        success: true,
        path: backupPath,
        fileName: backupFileName,
        size: fileSize
      };
    } catch (error) {
      console.error('❌ Manual backup xatolik:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Backup'dan tiklash
   */
  restoreFromBackup(backupFileName) {
    try {
      const backupPath = path.join(this.backupDir, backupFileName);

      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup fayli topilmadi: ${backupFileName}`);
      }

      // Joriy database'dan backup olish (xavfsizlik uchun)
      const emergencyBackup = this.createManualBackup('before_restore');
      console.log('⚠️ Tiklashdan oldin emergency backup yaratildi');

      // Backup faylini o'qish
      const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

      // Metadata'ni olib tashlash
      delete backupData.backup_timestamp;
      delete backupData.backup_version;
      delete backupData.backup_reason;
      delete backupData.backup_type;
      delete backupData.data_size_bytes;
      delete backupData.tables;

      // Database'ni yozish
      fs.writeFileSync(this.dbPath, JSON.stringify(backupData, null, 2));

      console.log(`✅ Database ${backupFileName} dan tiklandi!`);

      return {
        success: true,
        restoredFrom: backupFileName,
        emergencyBackup: emergencyBackup.fileName
      };
    } catch (error) {
      console.error('❌ Database tiklashda xatolik:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Backup statistikasini olish
   */
  getBackupStats() {
    try {
      const files = fs.readdirSync(this.backupDir);
      const backups = files.map(file => {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          fileName: file,
          size: stats.size,
          sizeMB: (stats.size / 1024 / 1024).toFixed(2),
          created: stats.mtime,
          age: Math.floor((Date.now() - stats.mtimeMs) / 1000 / 60 / 60) // soatlarda
        };
      }).sort((a, b) => b.created - a.created);

      const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

      return {
        totalBackups: backups.length,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        backups,
        backupDir: this.backupDir
      };
    } catch (error) {
      console.error('❌ Backup statistika xatolik:', error.message);
      return {
        totalBackups: 0,
        error: error.message
      };
    }
  }

  /**
   * Servisni to'xtatish
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('🛑 Database backup service to\'xtatildi');
    }
  }
}

// Export single instance
module.exports = new DatabaseBackupService();
