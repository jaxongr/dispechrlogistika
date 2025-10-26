/**
 * Auto-Reply Session Service
 *
 * ALOHIDA SESSIONDA ISHLAYDI - asosiy monitoring sessionga zarar bermaydi
 *
 * Ishlash prinsipi:
 * 1. Asosiy session (Abduxoliq) xabarlarni tinglab, dispatcherlarni aniqlaydi
 * 2. Dispatcher topilsa, ID va guruh ma'lumotlarini queuega qo'shadi
 * 3. Bu service ALOHIDA SESSION orqali javob yuboradi
 * 4. Agar bu session ban bo'lsa, asosiy sessionga ta'sir qilmaydi
 */

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');

class AutoReplySessionService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.replyQueue = [];
    this.processing = false;
    this.sessionString = '';

    // Mass messaging state
    this.broadcastQueue = [];
    this.broadcastInProgress = false;
    this.restrictedGroups = new Map(); // chatId -> {until: timestamp, reason: string}
    this.broadcastProgress = {
      total: 0,
      sent: 0,
      failed: 0,
      restricted: 0,
      currentMessage: null
    };

    // Process reply queue every 5 seconds
    setInterval(() => this.processQueue(), 5000);

    // Process broadcast queue every 1 second (faster for mass sending)
    setInterval(() => this.processBroadcastQueue(), 1000);

    // Check restricted groups every minute
    setInterval(() => this.checkRestrictedGroups(), 60000);
  }

  /**
   * Alohida sessionni boshlash
   */
  async connect() {
    try {
      const apiId = parseInt(process.env.TELEGRAM_API_ID);
      const apiHash = process.env.TELEGRAM_API_HASH;

      // ALOHIDA SESSION STRING - .env da AUTOREPLY_SESSION_STRING
      const sessionString = process.env.AUTOREPLY_SESSION_STRING || '';

      if (!apiId || !apiHash) {
        console.log('❌ Auto-reply: API credentials topilmadi');
        this.isConnected = false;
        return false;
      }

      if (!sessionString) {
        console.log('⚠️  Auto-reply session topilmadi (AUTOREPLY_SESSION_STRING)');
        console.log('   Auto-reply o\'chirilgan - faqat monitoring ishlaydi');
        this.isConnected = false;
        return false;
      }

      const stringSession = new StringSession(sessionString);

      this.client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
      });

      console.log('🔄 Auto-reply session ulanyapti...');
      await this.client.connect();

      if (!this.client.connected) {
        throw new Error('Auto-reply session ulanmadi');
      }

      const me = await this.client.getMe();
      console.log('✅ AUTO-REPLY SESSION ULANDI!');
      console.log(`   👤 Account: ${me.firstName} ${me.phone}`);
      console.log('   ⚠️  Bu alohida session - asosiy sessionga ta\'sir qilmaydi');

      this.isConnected = true;
      return true;

    } catch (error) {
      console.error('❌ Auto-reply session xatolik:', error.message);
      console.log('   Auto-reply o\'chirilgan - faqat monitoring ishlaydi');
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Auto-reply queuega qo'shish
   * Asosiy sessiondan chaqiriladi
   */
  addToQueue(replyData) {
    if (!this.isConnected) {
      // Session yo'q - skip
      return false;
    }

    this.replyQueue.push({
      ...replyData,
      addedAt: Date.now()
    });

    // Queue size limit
    if (this.replyQueue.length > 100) {
      this.replyQueue.shift(); // Remove oldest
    }

    return true;
  }

  /**
   * Queue ni process qilish
   */
  async processQueue() {
    if (!this.isConnected || this.processing || this.replyQueue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      const batch = this.replyQueue.splice(0, 10); // Process 10 at a time

      for (const reply of batch) {
        try {
          await this.sendReply(reply);
          await this.sleep(2000); // 2 second delay between replies
        } catch (error) {
          console.error(`❌ Auto-reply error for ${reply.username}:`, error.message);

          // If USER_BANNED, this session is banned, but main session is safe
          if (error.message.includes('USER_BANNED')) {
            console.log(`⚠️  Auto-reply session banned in ${reply.groupName}`);
            console.log('   Asosiy session xavfsiz - monitoring davom etmoqda');
          }
        }
      }

    } catch (error) {
      console.error('❌ Auto-reply queue processing error:', error.message);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Javob yuborish
   */
  async sendReply(replyData) {
    if (!this.client || !this.isConnected) {
      return;
    }

    const { userId, username, chatId, groupName, messageId } = replyData;

    // Build reply message
    const targetChannel = process.env.TARGET_CHANNEL_ID || '-1002496159921';
    const message = `Assalomu alaykum!\n\n` +
      `Siz yozgan xabaringiz dispecherlar uchun guruhimizga ko'chirildi:\n` +
      `https://t.me/c/${targetChannel.replace('-100', '')}/\n\n` +
      `✅ Tez orada sizga javob berishadi!`;

    try {
      // Send reply via auto-reply session
      await this.client.sendMessage(chatId, {
        message: message,
        replyTo: messageId
      });

      console.log(`✅ Auto-reply sent to ${username} in ${groupName}`);
      return true;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Disconnect
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('🔌 Auto-reply session to\'xtatildi');
    }
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      queueLength: this.replyQueue.length,
      processing: this.processing,
      broadcastInProgress: this.broadcastInProgress,
      broadcastQueueLength: this.broadcastQueue.length,
      broadcastProgress: this.broadcastProgress,
      restrictedGroupsCount: this.restrictedGroups.size
    };
  }

  /**
   * ============================================
   * MASS MESSAGING (BROADCAST) METHODS
   * ============================================
   */

  /**
   * Start mass messaging to all groups in THIS session
   * @param {string} message - Message to broadcast
   * @param {object} options - Broadcast options
   * @returns {object} - Broadcast job info
   */
  async startBroadcast(message, options = {}) {
    if (!this.isConnected) {
      throw new Error('Auto-reply session not connected. Set AUTOREPLY_SESSION_STRING in .env');
    }

    if (this.broadcastInProgress) {
      throw new Error('Broadcast already in progress');
    }

    if (!message || message.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }

    console.log('\n📢 ========================================');
    console.log('   MASS MESSAGING STARTED');
    console.log('========================================\n');

    try {
      // Get all groups from THIS session (not monitoring session!)
      console.log('📥 Getting groups from auto-reply session...');
      const dialogs = await this.client.getDialogs({ limit: 500 });
      const groups = dialogs.filter(d => d.isGroup || d.isChannel);

      console.log(`✅ Found ${groups.length} groups in auto-reply session`);

      // Filter out restricted groups
      const availableGroups = [];
      const currentlyRestricted = [];

      for (const dialog of groups) {
        const chatId = dialog.id?.toString();
        if (!chatId) continue;

        // Check if restricted
        const restriction = this.restrictedGroups.get(chatId);
        if (restriction && restriction.until > Date.now()) {
          currentlyRestricted.push({
            chatId,
            name: dialog.title,
            until: restriction.until
          });
        } else {
          availableGroups.push({
            chatId,
            name: dialog.title,
            username: dialog.entity?.username || ''
          });
        }
      }

      console.log(`✅ Available groups: ${availableGroups.length}`);
      console.log(`⏳ Currently restricted: ${currentlyRestricted.length}`);

      if (availableGroups.length === 0) {
        throw new Error('No available groups to send messages');
      }

      // Initialize progress
      this.broadcastProgress = {
        total: availableGroups.length,
        sent: 0,
        failed: 0,
        restricted: 0,
        currentMessage: message,
        startedAt: new Date().toISOString()
      };

      // Add to broadcast queue
      this.broadcastQueue = availableGroups.map(g => ({
        chatId: g.chatId,
        groupName: g.name,
        message: message,
        retries: 0
      }));

      this.broadcastInProgress = true;

      console.log('\n🚀 Broadcast queued!');
      console.log(`   Total groups: ${availableGroups.length}`);
      console.log(`   Speed: ${options.speed || 'safe'} mode`);
      console.log('========================================\n');

      return {
        success: true,
        total: availableGroups.length,
        restricted: currentlyRestricted.length,
        message: message
      };

    } catch (error) {
      console.error('❌ Broadcast start error:', error.message);
      throw error;
    }
  }

  /**
   * Process broadcast queue
   * Sends messages at controlled rate
   */
  async processBroadcastQueue() {
    if (!this.isConnected || !this.broadcastInProgress || this.broadcastQueue.length === 0) {
      // If queue is empty but broadcast was in progress, mark as complete
      if (this.broadcastInProgress && this.broadcastQueue.length === 0) {
        this.broadcastInProgress = false;
        console.log('\n✅ ========================================');
        console.log('   BROADCAST COMPLETED');
        console.log('========================================');
        console.log(`   Total: ${this.broadcastProgress.total}`);
        console.log(`   Sent: ${this.broadcastProgress.sent}`);
        console.log(`   Failed: ${this.broadcastProgress.failed}`);
        console.log(`   Restricted: ${this.broadcastProgress.restricted}`);
        console.log('========================================\n');
      }
      return;
    }

    try {
      // Process 3 messages per second (safe mode)
      // You can adjust this: 1 = slow, 3 = safe, 5 = aggressive, 10 = turbo (risky)
      const batchSize = 3;
      const batch = this.broadcastQueue.splice(0, batchSize);

      for (const item of batch) {
        try {
          await this.sendBroadcastMessage(item);
          this.broadcastProgress.sent++;

          // Log progress every 10 messages
          if (this.broadcastProgress.sent % 10 === 0) {
            console.log(`📊 Progress: ${this.broadcastProgress.sent}/${this.broadcastProgress.total} sent`);
          }

          // Small delay between messages (333ms for 3/sec)
          await this.sleep(333);

        } catch (error) {
          // Handle FloodWaitError
          if (error.message.includes('FLOOD_WAIT') || error.message.includes('A wait of')) {
            const waitMatch = error.message.match(/(\d+)/);
            const waitSeconds = waitMatch ? parseInt(waitMatch[1]) : 60;

            console.log(`⏳ FloodWait: ${waitSeconds}s for ${item.groupName}`);

            // Mark as restricted
            this.restrictedGroups.set(item.chatId, {
              until: Date.now() + (waitSeconds * 1000),
              reason: 'FLOOD_WAIT'
            });

            this.broadcastProgress.restricted++;

            // Re-add to queue for retry later
            this.broadcastQueue.push({
              ...item,
              retries: item.retries + 1
            });

          } else if (error.message.includes('USER_BANNED')) {
            console.log(`❌ Banned in ${item.groupName}`);
            this.broadcastProgress.failed++;

          } else {
            console.log(`❌ Failed: ${item.groupName} - ${error.message}`);
            this.broadcastProgress.failed++;
          }
        }
      }

    } catch (error) {
      console.error('❌ Broadcast queue processing error:', error.message);
    }
  }

  /**
   * Send single broadcast message
   */
  async sendBroadcastMessage(item) {
    if (!this.client || !this.isConnected) {
      throw new Error('Client not connected');
    }

    const { chatId, groupName, message } = item;

    try {
      await this.client.sendMessage(chatId, {
        message: message
      });

      return true;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Check restricted groups and remove expired restrictions
   */
  checkRestrictedGroups() {
    const now = Date.now();
    let freedCount = 0;

    for (const [chatId, restriction] of this.restrictedGroups.entries()) {
      if (restriction.until <= now) {
        this.restrictedGroups.delete(chatId);
        freedCount++;
      }
    }

    if (freedCount > 0) {
      console.log(`✅ ${freedCount} groups freed from restrictions`);
    }
  }

  /**
   * Stop current broadcast
   */
  stopBroadcast() {
    if (!this.broadcastInProgress) {
      return { success: false, message: 'No broadcast in progress' };
    }

    const remaining = this.broadcastQueue.length;
    this.broadcastQueue = [];
    this.broadcastInProgress = false;

    console.log(`🛑 Broadcast stopped. ${remaining} messages cancelled.`);

    return {
      success: true,
      cancelled: remaining,
      sent: this.broadcastProgress.sent
    };
  }

  /**
   * Get broadcast progress
   */
  getBroadcastProgress() {
    return {
      ...this.broadcastProgress,
      inProgress: this.broadcastInProgress,
      remaining: this.broadcastQueue.length,
      restrictedGroups: Array.from(this.restrictedGroups.entries()).map(([chatId, r]) => ({
        chatId,
        until: new Date(r.until).toISOString(),
        reason: r.reason
      }))
    };
  }

  /**
   * ============================================
   * SESSION CREATION METHODS (Dashboard)
   * ============================================
   */

  /**
   * Create new auto-reply session (Step 1: Send code)
   * @param {string} phoneNumber - Phone number with country code (e.g., +998901234567)
   * @returns {object} - Session creation job info
   */
  async createSessionStep1(phoneNumber) {
    try {
      const apiId = parseInt(process.env.TELEGRAM_API_ID);
      const apiHash = process.env.TELEGRAM_API_HASH;

      if (!apiId || !apiHash) {
        throw new Error('TELEGRAM_API_ID va TELEGRAM_API_HASH .env da topilmadi');
      }

      // Create new session
      const stringSession = new StringSession('');
      const tempClient = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
      });

      console.log(`📱 Auto-reply session yaratish boshlandi: ${phoneNumber}`);

      await tempClient.connect();

      // Send code
      await tempClient.sendCode(
        {
          apiId: apiId,
          apiHash: apiHash,
        },
        phoneNumber
      );

      // Store temp client for step 2
      this.tempSessionClient = tempClient;
      this.tempSessionPhone = phoneNumber;

      console.log(`✅ Kod yuborildi: ${phoneNumber}`);

      return {
        success: true,
        message: 'SMS kod yuborildi',
        phoneNumber: phoneNumber
      };

    } catch (error) {
      console.error('❌ Session yaratish (step 1) xatolik:', error.message);
      throw new Error(`Kod yuborishda xatolik: ${error.message}`);
    }
  }

  /**
   * Create new auto-reply session (Step 2: Verify code and save)
   * @param {string} code - SMS code
   * @param {string} password - 2FA password (optional)
   * @returns {object} - Session string
   */
  async createSessionStep2(code, password = '') {
    try {
      if (!this.tempSessionClient) {
        throw new Error('Session yaratish jarayoni topilmadi. Avval telefon raqamni yuboring.');
      }

      console.log(`🔐 Kod tasdiqlash: ${this.tempSessionPhone}`);

      // Sign in with code
      try {
        await this.tempSessionClient.invoke(
          new (require('telegram/tl').Api.auth.SignIn)({
            phoneNumber: this.tempSessionPhone,
            phoneCodeHash: this.tempSessionClient._phoneCodeHash,
            phoneCode: code,
          })
        );
      } catch (error) {
        // If 2FA enabled, sign in with password
        if (error.message.includes('SESSION_PASSWORD_NEEDED')) {
          if (!password) {
            throw new Error('2FA yoqilgan. Parolni kiriting.');
          }

          await this.tempSessionClient.invoke(
            new (require('telegram/tl').Api.auth.CheckPassword)({
              password: await this.tempSessionClient.computeCheck(password),
            })
          );
        } else {
          throw error;
        }
      }

      // Get session string
      const sessionString = this.tempSessionClient.session.save();

      // Get user info
      const me = await this.tempSessionClient.getMe();
      const userInfo = {
        id: me.id?.toString(),
        firstName: me.firstName || '',
        lastName: me.lastName || '',
        username: me.username || '',
        phone: me.phone || this.tempSessionPhone
      };

      console.log(`✅ Session yaratildi: ${userInfo.firstName} ${userInfo.phone}`);

      // Disconnect temp client
      await this.tempSessionClient.disconnect();
      this.tempSessionClient = null;
      this.tempSessionPhone = null;

      return {
        success: true,
        sessionString: sessionString,
        userInfo: userInfo,
        message: 'Session muvaffaqiyatli yaratildi'
      };

    } catch (error) {
      console.error('❌ Session yaratish (step 2) xatolik:', error.message);

      // Cleanup
      if (this.tempSessionClient) {
        try {
          await this.tempSessionClient.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        this.tempSessionClient = null;
        this.tempSessionPhone = null;
      }

      throw new Error(`Kod tasdiqlashda xatolik: ${error.message}`);
    }
  }

  /**
   * Save session string to .env file
   * @param {string} sessionString - Session string to save
   * @returns {object} - Save result
   */
  async saveSessionToEnv(sessionString) {
    try {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(__dirname, '../../../.env');

      // Read current .env
      let envContent = fs.readFileSync(envPath, 'utf8');

      // Check if AUTOREPLY_SESSION_STRING exists
      if (envContent.includes('AUTOREPLY_SESSION_STRING=')) {
        // Replace existing
        envContent = envContent.replace(
          /AUTOREPLY_SESSION_STRING=.*/,
          `AUTOREPLY_SESSION_STRING=${sessionString}`
        );
      } else {
        // Add new
        envContent += `\n\n# Auto-Reply Session (Dashboard'dan qo'shildi)\nAUTOREPLY_SESSION_STRING=${sessionString}\n`;
      }

      // Write back
      fs.writeFileSync(envPath, envContent, 'utf8');

      console.log('✅ Session .env fayliga saqlandi');

      return {
        success: true,
        message: 'Session .env ga saqlandi. PM2 ni restart qiling.'
      };

    } catch (error) {
      console.error('❌ .env ga saqlashda xatolik:', error.message);
      throw new Error(`.env ga saqlashda xatolik: ${error.message}`);
    }
  }

  /**
   * Cancel session creation
   */
  cancelSessionCreation() {
    if (this.tempSessionClient) {
      try {
        this.tempSessionClient.disconnect();
      } catch (e) {
        // Ignore
      }
      this.tempSessionClient = null;
      this.tempSessionPhone = null;
      console.log('🔌 Session yaratish bekor qilindi');
    }
  }
}

// Singleton instance
const autoReplySession = new AutoReplySessionService();

module.exports = autoReplySession;
