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

    // Session creation state (persistent across requests)
    this.sessionCreationState = {
      client: null,
      phoneNumber: null,
      phoneCodeHash: null,
      createdAt: null,
      timeout: 5 * 60 * 1000 // 5 minutes timeout
    };

    // Process reply queue every 5 seconds
    setInterval(() => this.processQueue(), 5000);

    // Process broadcast queue every 1 second (faster for mass sending)
    setInterval(() => this.processBroadcastQueue(), 1000);

    // Check restricted groups every minute
    setInterval(() => this.checkRestrictedGroups(), 60000);

    // Cleanup expired session creation state every minute
    setInterval(() => this.cleanupExpiredSessionState(), 60000);
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
          // Check if group is restricted (FloodWait)
          const restriction = this.restrictedGroups.get(reply.chatId);
          if (restriction && Date.now() < restriction.until) {
            const remainingMs = restriction.until - Date.now();
            const remainingMin = Math.ceil(remainingMs / 60000);
            console.log(`⏸️  Auto-reply: ${reply.groupName} cheklangan (${remainingMin} min) - SKIP`);
            continue; // Skip this group
          }

          await this.sendReply(reply);
          await this.sleep(2000); // 2 second delay between replies
        } catch (error) {
          console.error(`❌ Auto-reply error for ${reply.username}:`, error.message);

          // FloodWait - skip this group temporarily
          if (error.message.includes('FLOOD_WAIT')) {
            const match = error.message.match(/A wait of (\d+) seconds/);
            const waitSeconds = match ? parseInt(match[1]) : 300; // Default 5 min
            console.log(`⏳ FloodWait: ${waitSeconds}s for ${reply.groupName} - SKIP qilinyapti`);
            this.restrictedGroups.set(reply.chatId, {
              until: Date.now() + (waitSeconds * 1000),
              reason: 'FLOOD_WAIT'
            });
            continue; // Skip and don't re-add to queue
          }

          // USER_BANNED - skip permanently
          if (error.message.includes('USER_BANNED')) {
            console.log(`❌ Banned in ${reply.groupName} - SKIP`);
            console.log('   Asosiy session xavfsiz - monitoring davom etmoqda');
            continue; // Skip and don't re-add to queue
          }

          // CHAT_WRITE_FORBIDDEN - skip permanently
          if (error.message.includes('CHAT_WRITE_FORBIDDEN') ||
              error.message.includes('CHAT_SEND_PLAIN_FORBIDDEN') ||
              error.message.includes('CHAT_RESTRICTED')) {
            console.log(`🚫 Write forbidden in ${reply.groupName} - SKIP`);
            continue; // Skip and don't re-add to queue
          }

          // Could not find entity - skip permanently
          if (error.message.includes('Could not find the input entity')) {
            console.log(`⚠️  Entity not found: ${reply.username} - SKIP`);
            continue; // Skip and don't re-add to queue
          }

          // Other errors - log and skip
          console.log(`⚠️  Other error in ${reply.groupName} - SKIP`);
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

            console.log(`⏳ FloodWait: ${waitSeconds}s for ${item.groupName} - SKIP qilinyapti`);

            // Mark as restricted (for tracking only)
            this.restrictedGroups.set(item.chatId, {
              until: Date.now() + (waitSeconds * 1000),
              reason: 'FLOOD_WAIT'
            });

            this.broadcastProgress.restricted++;

            // DON'T re-add to queue - just skip it!
            // Commented out to prevent blocking:
            // this.broadcastQueue.push({
            //   ...item,
            //   retries: item.retries + 1
            // });

          } else if (error.message.includes('USER_BANNED')) {
            console.log(`❌ Banned in ${item.groupName} - SKIP`);
            this.broadcastProgress.failed++;

          } else {
            console.log(`❌ Failed: ${item.groupName} - ${error.message} - SKIP`);
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

      // Cleanup old session creation if exists
      if (this.sessionCreationState.client) {
        try {
          await this.sessionCreationState.client.disconnect();
        } catch (e) {
          // Ignore
        }
      }

      // Create new session
      const stringSession = new StringSession('');
      const tempClient = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
      });

      console.log(`📱 Auto-reply session yaratish boshlandi: ${phoneNumber}`);

      await tempClient.connect();

      // Send code
      const result = await tempClient.sendCode(
        {
          apiId: apiId,
          apiHash: apiHash,
        },
        phoneNumber
      );

      // Store state (persistent across requests)
      this.sessionCreationState = {
        client: tempClient,
        phoneNumber: phoneNumber,
        phoneCodeHash: result.phoneCodeHash,
        createdAt: Date.now(),
        timeout: 5 * 60 * 1000 // 5 minutes
      };

      console.log(`✅ Kod yuborildi: ${phoneNumber}`);
      console.log(`   phoneCodeHash: ${result.phoneCodeHash}`);

      return {
        success: true,
        message: 'SMS kod yuborildi',
        phoneNumber: phoneNumber,
        expiresIn: 300 // 5 minutes in seconds
      };

    } catch (error) {
      console.error('❌ Session yaratish (step 1) xatolik:', error.message);
      this.cleanupSessionCreationState();
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
      // Check if session creation state exists
      if (!this.sessionCreationState.client || !this.sessionCreationState.phoneNumber) {
        throw new Error('Session yaratish jarayoni topilmadi. Avval telefon raqamni yuboring.');
      }

      // Check if expired (5 minutes timeout)
      const now = Date.now();
      const elapsed = now - this.sessionCreationState.createdAt;
      if (elapsed > this.sessionCreationState.timeout) {
        this.cleanupSessionCreationState();
        throw new Error('Session yaratish vaqti tugadi (5 daqiqa). Qaytadan boshlang.');
      }

      console.log(`🔐 Kod tasdiqlash: ${this.sessionCreationState.phoneNumber}`);
      console.log(`   phoneCodeHash: ${this.sessionCreationState.phoneCodeHash}`);

      const client = this.sessionCreationState.client;
      const phoneNumber = this.sessionCreationState.phoneNumber;
      const phoneCodeHash = this.sessionCreationState.phoneCodeHash;

      // Sign in with code
      try {
        await client.invoke(
          new (require('telegram/tl').Api.auth.SignIn)({
            phoneNumber: phoneNumber,
            phoneCodeHash: phoneCodeHash,
            phoneCode: code,
          })
        );
      } catch (error) {
        // If 2FA enabled, sign in with password
        if (error.message.includes('SESSION_PASSWORD_NEEDED')) {
          if (!password) {
            throw new Error('2FA yoqilgan. Parolni kiriting.');
          }

          console.log('🔐 2FA parol bilan kirish...');
          await client.invoke(
            new (require('telegram/tl').Api.auth.CheckPassword)({
              password: await client.computeCheck(password),
            })
          );
        } else {
          throw error;
        }
      }

      // Get session string
      const sessionString = client.session.save();

      // Get user info
      const me = await client.getMe();
      const userInfo = {
        id: me.id?.toString(),
        firstName: me.firstName || '',
        lastName: me.lastName || '',
        username: me.username || '',
        phone: me.phone || phoneNumber
      };

      console.log(`✅ Session yaratildi: ${userInfo.firstName} ${userInfo.phone}`);

      // Disconnect and cleanup
      await client.disconnect();
      this.cleanupSessionCreationState();

      return {
        success: true,
        sessionString: sessionString,
        userInfo: userInfo,
        message: 'Session muvaffaqiyatli yaratildi'
      };

    } catch (error) {
      console.error('❌ Session yaratish (step 2) xatolik:', error.message);

      // Cleanup on error
      this.cleanupSessionCreationState();

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
    this.cleanupSessionCreationState();
    console.log('🔌 Session yaratish bekor qilindi');
  }

  /**
   * Cleanup session creation state
   */
  cleanupSessionCreationState() {
    if (this.sessionCreationState.client) {
      try {
        this.sessionCreationState.client.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    }

    this.sessionCreationState = {
      client: null,
      phoneNumber: null,
      phoneCodeHash: null,
      createdAt: null,
      timeout: 5 * 60 * 1000
    };
  }

  /**
   * Cleanup expired session creation state (runs every minute)
   */
  cleanupExpiredSessionState() {
    if (!this.sessionCreationState.createdAt) {
      return;
    }

    const now = Date.now();
    const elapsed = now - this.sessionCreationState.createdAt;

    if (elapsed > this.sessionCreationState.timeout) {
      console.log('🧹 Cleaning up expired session creation state...');
      this.cleanupSessionCreationState();
    }
  }
}

// Singleton instance
const autoReplySession = new AutoReplySessionService();

module.exports = autoReplySession;
