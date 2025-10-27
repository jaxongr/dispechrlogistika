const Broadcast = require('../models/Broadcast');
const BroadcastAnnouncement = require('../models/BroadcastAnnouncement');
const TelegramGroup = require('../models/TelegramGroup');
const telegramBot = require('./telegram-bot');

/**
 * Broadcast Service
 * Ommaviy xabar yuborish - Rate limiting bilan
 *
 * Rate Limits:
 * - 4 soniya har bir guruh orasida
 * - 20 ta guruhga yuborib → 30 soniya dam
 * - Tsikl tugagach → 5 daqiqa dam
 */
class BroadcastService {
  constructor() {
    this.isRunning = false;
    this.currentBroadcastId = null;
    this.stopRequested = false;
  }

  /**
   * Broadcast boshlash
   */
  async start(broadcastId) {
    if (this.isRunning) {
      throw new Error('Broadcast allaqachon ishlamoqda');
    }

    const broadcast = Broadcast.findById(broadcastId);
    if (!broadcast) {
      throw new Error('Broadcast topilmadi');
    }

    if (broadcast.status !== 'pending' && broadcast.status !== 'paused') {
      throw new Error(`Broadcast ${broadcast.status} holatda`);
    }

    this.isRunning = true;
    this.currentBroadcastId = broadcastId;
    this.stopRequested = false;

    // Status ni running qilish
    Broadcast.updateStatus(broadcastId, 'running', {
      started_at: new Date().toISOString()
    });

    console.log(`📢 Broadcast ${broadcastId} boshlandi`);

    // Background'da ishga tushirish
    this._processBroadcast(broadcastId).catch(err => {
      console.error('Broadcast error:', err);
      Broadcast.updateStatus(broadcastId, 'failed');
      this.isRunning = false;
    });

    return { message: 'Broadcast boshlandi' };
  }

  /**
   * Broadcast pauza qilish
   */
  pause(broadcastId) {
    if (this.currentBroadcastId !== broadcastId) {
      throw new Error('Bu broadcast ishlamayapti');
    }

    this.stopRequested = true;
    Broadcast.updateStatus(broadcastId, 'paused');
    console.log(`⏸️ Broadcast ${broadcastId} pauza qilindi`);

    return { message: 'Broadcast pauza qilindi' };
  }

  /**
   * Broadcast to'xtatish
   */
  stop(broadcastId) {
    if (this.currentBroadcastId !== broadcastId) {
      throw new Error('Bu broadcast ishlamayapti');
    }

    this.stopRequested = true;
    Broadcast.updateStatus(broadcastId, 'completed', {
      completed_at: new Date().toISOString()
    });
    console.log(`⏹️ Broadcast ${broadcastId} to'xtatildi`);

    return { message: 'Broadcast to'xtatildi' };
  }

  /**
   * Broadcast qayta ishlash (asosiy logika)
   */
  async _processBroadcast(broadcastId) {
    const broadcast = Broadcast.findById(broadcastId);
    if (!broadcast) {
      throw new Error('Broadcast topilmadi');
    }

    const {
      target_groups,
      interval_seconds,
      batch_size,
      batch_pause_seconds,
      cycle_pause_minutes
    } = broadcast;

    // Xabar kombinatsiyasini olish
    const messageText = BroadcastAnnouncement.generateCombinedMessage();
    if (!messageText) {
      throw new Error('Faol e\'lon topilmadi');
    }

    let sentCount = broadcast.sent_count || 0;
    let failedCount = broadcast.failed_count || 0;
    let batchCount = 0;

    console.log(`📢 Jami ${target_groups.length} ta guruhga yuboriladi`);

    // Har bir guruhga yuborish
    for (let i = sentCount; i < target_groups.length; i++) {
      // Pauza tekshirish
      if (this.stopRequested) {
        console.log('⏸️ Broadcast pauza qilindi');
        this.isRunning = false;
        return;
      }

      const groupId = target_groups[i];

      try {
        // Guruh ma'lumotlarini olish
        const group = TelegramGroup.findById(groupId);
        if (!group) {
          console.log(`⚠️ Guruh topilmadi: ${groupId}`);
          failedCount++;
          continue;
        }

        // Guruhga xabar yuborish
        console.log(`📤 Yuborilmoqda: ${group.group_name} (${i + 1}/${target_groups.length})`);

        await telegramBot.sendBroadcastMessage(group.telegram_group_id, messageText);

        sentCount++;
        batchCount++;

        // Progress yangilash
        Broadcast.updateProgress(broadcastId, sentCount, failedCount, groupId);

        // Batch limit - 20 ta yuborib 30 soniya dam
        if (batchCount >= batch_size) {
          console.log(`⏸️ Batch tugadi (${batchCount} ta), ${batch_pause_seconds}s dam olinmoqda...`);
          await this._sleep(batch_pause_seconds * 1000);
          batchCount = 0;
        } else {
          // Har bir xabar orasida 4 soniya dam
          await this._sleep(interval_seconds * 1000);
        }

      } catch (error) {
        console.error(`❌ Xatolik: ${groupId}`, error.message);
        failedCount++;
        Broadcast.addError(broadcastId, {
          group_id: groupId,
          message: error.message
        });
      }
    }

    // Tsikl tugadi - 5 daqiqa dam olib yana davom etish
    console.log(`✅ Broadcast tugadi! Sent: ${sentCount}, Failed: ${failedCount}`);
    console.log(`⏸️ ${cycle_pause_minutes} daqiqa dam olinmoqda...`);

    await this._sleep(cycle_pause_minutes * 60 * 1000);

    // Yana davom etish yoki tugatish
    if (sentCount >= target_groups.length) {
      Broadcast.updateStatus(broadcastId, 'completed', {
        completed_at: new Date().toISOString()
      });
      console.log(`✅ Broadcast ${broadcastId} tugadi`);
      this.isRunning = false;
    } else {
      // Yana qayta boshlash (paused bo'lmasa)
      const currentBroadcast = Broadcast.findById(broadcastId);
      if (currentBroadcast.status === 'running') {
        console.log(`🔄 Broadcast yana davom etmoqda...`);
        await this._processBroadcast(broadcastId);
      } else {
        this.isRunning = false;
      }
    }
  }

  /**
   * Sleep helper
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Broadcast statistikasini olish
   */
  getStatus(broadcastId) {
    const broadcast = Broadcast.findById(broadcastId);
    if (!broadcast) {
      return null;
    }

    return {
      id: broadcast.id,
      status: broadcast.status,
      total: broadcast.total_groups,
      sent: broadcast.sent_count,
      failed: broadcast.failed_count,
      progress: Math.round((broadcast.sent_count / broadcast.total_groups) * 100),
      started_at: broadcast.started_at,
      completed_at: broadcast.completed_at
    };
  }
}

module.exports = new BroadcastService();
