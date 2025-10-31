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
    this.broadcastSpeed = 'safe'; // safe, fast, turbo
    this.broadcastLoopEnabled = false; // Tsiklik rejim
    this.broadcastMessage = null; // Loop uchun xabar
    this.broadcastAllGroups = []; // Barcha guruhlar ro'yxati (loop uchun)
    this.restrictedGroups = new Map(); // chatId -> {until: timestamp, reason: string}
    this.broadcastProgress = {
      total: 0,
      sent: 0,
      failed: 0,
      restricted: 0,
      currentMessage: null,
      loopCount: 0 // Necha marta loop qilindi
    };

    // Session creation state (persistent across requests)
    this.sessionCreationState = {
      client: null,
      phoneNumber: null,
      phoneCodeHash: null,
      createdAt: null,
      timeout: 5 * 60 * 1000 // 5 minutes timeout
    };

    // Scheduled broadcasts
    this.scheduledBroadcasts = [];
    this.scheduledBroadcastsEnabled = true;

    // Private message auto-reply
    this.privateMessageAutoReply = {
      enabled: false,
      template: `Assalomu alaykum! 👋

🚛 Siz bizning DISPETCHERLAR uchun mo'ljallangan guruhimizga xabar yubordingiz!

📢 Bizning asosiy guruhimiz: @yoldauz

✅ Bu guruh O'ZBEKISTON va XALQARO LOGISTIKA bo'yicha eng yaxshi va ishonchli platformalardan biri!

🌟 Nima uchun bizning guruhga qo'shilishingiz kerak:
   • 100+ faol guruhlardan e'lonlar
   • AI filtrlangan SIFATLI yuklar
   • Dispetcher spamidan tozalangan
   • Tez javob va professional yondashuv

👥 Guruhga qo'shiling: @yoldauz

📞 Savol-javob uchun: @admin_username

Muvaffaqiyatli yuklaringiz bo'lsin! 🚀`,
      repliedUsers: new Set() // Track who we replied to (session only)
    };

    // Process reply queue every 1 second (juda tez!)
    setInterval(() => this.processQueue(), 1000);

    // Process broadcast queue every 1 second (faster for mass sending)
    setInterval(() => this.processBroadcastQueue(), 1000);

    // Check restricted groups every minute
    setInterval(() => this.checkRestrictedGroups(), 60000);

    // Cleanup expired session creation state every minute
    setInterval(() => this.cleanupExpiredSessionState(), 60000);

    // Check scheduled broadcasts every minute
    setInterval(() => this.checkScheduledBroadcasts(), 60000);

    // Listen for private messages
    this.setupPrivateMessageListener();
  }

  /**
   * Alohida sessionni boshlash
   */
  async connect() {
    try {
      const apiId = parseInt(process.env.TELEGRAM_API_ID);
      const apiHash = process.env.TELEGRAM_API_HASH;

      // ALOHIDA SESSION STRING - .env da AUTOREPLY_SESSION_STRING
      const sessionString = (process.env.AUTOREPLY_SESSION_STRING || '').trim();

      if (!apiId || !apiHash) {
        console.log('❌ Auto-reply: API credentials topilmadi');
        this.isConnected = false;
        return false;
      }

      if (!sessionString || sessionString.length < 10) {
        console.log('⚠️  Auto-reply session topilmadi (AUTOREPLY_SESSION_STRING)');
        console.log(`   Session string length: ${sessionString.length}`);
        console.log('   Auto-reply o\'chirilgan - faqat monitoring ishlaydi');
        this.isConnected = false;
        return false;
      }

      console.log(`✅ Auto-reply session string topildi (length: ${sessionString.length})`);
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
      this.sessionStartTime = new Date().toLocaleString('uz-UZ');
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
      const batch = this.replyQueue.splice(0, 10); // Process 10 at a time (600/min - maksimal tez!)

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
          await this.sleep(3000); // 3 second delay between replies (SAFE)
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

          // PEER_ID_INVALID - user not accessible
          if (error.message.includes('PEER_ID_INVALID')) {
            console.log(`⚠️  Peer ID invalid: ${reply.username} - SKIP`);
            continue; // Skip - session can't access this user
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
      restrictedGroupsCount: this.restrictedGroups.size,
      // Additional info for UI
      phoneNumber: this.isConnected ? (this.client?.session?.phoneNumber || 'N/A') : null,
      sessionStart: this.sessionStartTime || null,
      autoReplyEnabled: this.privateMessageAutoReply.enabled,
      queueSize: this.replyQueue.length,
      recentErrors: 0 // TODO: Track errors
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

    // Set broadcast speed and loop mode
    this.broadcastSpeed = options.speed || 'safe';
    this.broadcastLoopEnabled = options.loop === true;
    this.broadcastMessage = message; // Save for loop

    console.log('\n📢 ========================================');
    console.log('   MASS MESSAGING STARTED');
    console.log(`   Speed: ${this.broadcastSpeed.toUpperCase()}`);
    console.log(`   Loop Mode: ${this.broadcastLoopEnabled ? '🔁 YOQILGAN' : '❌ O\'CHIRILGAN'}`);
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

      // Save all groups for loop mode
      this.broadcastAllGroups = availableGroups;

      // Initialize progress
      this.broadcastProgress = {
        total: availableGroups.length,
        sent: 0,
        failed: 0,
        restricted: 0,
        currentMessage: message,
        startedAt: new Date().toISOString(),
        loopCount: 0
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
      // If queue is empty but broadcast was in progress
      if (this.broadcastInProgress && this.broadcastQueue.length === 0) {

        // Check if loop mode is enabled
        if (this.broadcastLoopEnabled && this.broadcastAllGroups.length > 0) {
          // LOOP MODE: Restart broadcast with same groups
          this.broadcastProgress.loopCount++;

          console.log('\n🔁 ========================================');
          console.log('   LOOP MODE: RESTARTING BROADCAST');
          console.log(`   Loop Count: ${this.broadcastProgress.loopCount}`);
          console.log('   ⏸️  5 DAQIQA DAM OLINMOQDA...');
          console.log('========================================\n');

          // 5 DAQIQA DAM OLISH - Telegram limitlarini oldini olish uchun
          await this.sleep(300000); // 5 daqiqa = 300,000ms

          console.log('✅ Dam olish tugadi, qayta boshlanyapti...\n');

          // Filter out restricted groups
          const availableGroups = this.broadcastAllGroups.filter(g => {
            const restriction = this.restrictedGroups.get(g.chatId);
            const isRestricted = restriction && restriction.until > Date.now();
            if (isRestricted) {
              console.log(`⏭️  Skipping restricted group: ${g.name}`);
            }
            return !isRestricted;
          });

          console.log(`✅ Available: ${availableGroups.length}/${this.broadcastAllGroups.length} groups`);

          // Refill queue
          this.broadcastQueue = availableGroups.map(g => ({
            chatId: g.chatId,
            groupName: g.name,
            message: this.broadcastMessage,
            retries: 0
          }));

          // Reset sent counter (keep loopCount)
          this.broadcastProgress.sent = 0;
          this.broadcastProgress.failed = 0;
          this.broadcastProgress.total = availableGroups.length;

          return; // Continue processing
        }

        // NO LOOP: Mark as complete
        this.broadcastInProgress = false;
        console.log('\n✅ ========================================');
        console.log('   BROADCAST COMPLETED');
        console.log('========================================');
        console.log(`   Total: ${this.broadcastProgress.total}`);
        console.log(`   Sent: ${this.broadcastProgress.sent}`);
        console.log(`   Failed: ${this.broadcastProgress.failed}`);
        console.log(`   Restricted: ${this.broadcastProgress.restricted}`);
        console.log(`   Loop Count: ${this.broadcastProgress.loopCount}`);
        console.log('========================================\n');
      }
      return;
    }

    try {
      // YANGI TEZLIKLAR - Telegram limitlari asosida
      // safe: 20 guruh/min (3s delay) = 10 daqiqa (200 guruh)
      // fast: 30 guruh/min (2s delay) = 6.6 daqiqa (200 guruh)
      // turbo: 40 guruh/min (1.5s delay) = 5 daqiqa (200 guruh) - XAVFLI!

      // FAQAT 1 xabar bir vaqtda (batch = 1)
      const batch = this.broadcastQueue.splice(0, 1);

      for (const item of batch) {
        try {
          await this.sendBroadcastMessage(item);
          this.broadcastProgress.sent++;

          // Log progress every 10 messages
          if (this.broadcastProgress.sent % 10 === 0) {
            console.log(`📊 Progress: ${this.broadcastProgress.sent}/${this.broadcastProgress.total} sent`);
          }

          // YANGILANGAN TEZLIKLAR - 3 soniya barcha rejimlar uchun
          // safe: 20 guruh/min (3s delay) = 10 daqiqa (200 guruh)
          // fast: 20 guruh/min (3s delay) = 10 daqiqa (200 guruh)
          // turbo: 20 guruh/min (3s delay) = 10 daqiqa (200 guruh)
          const delayMs = 3000; // 3 soniya - barcha rejimlar uchun bir xil

          await this.sleep(delayMs);

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
    const wasLoopMode = this.broadcastLoopEnabled;

    // Clear queue and stop broadcast
    this.broadcastQueue = [];
    this.broadcastInProgress = false;

    // Disable loop mode
    this.broadcastLoopEnabled = false;
    this.broadcastMessage = null;
    this.broadcastAllGroups = [];

    console.log(`🛑 Broadcast stopped. ${remaining} messages cancelled.`);
    if (wasLoopMode) {
      console.log('🔁 Loop mode disabled');
    }

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
      const rootEnvPath = path.join(__dirname, '../../../.env'); // Root .env
      const backendEnvPath = path.join(__dirname, '../../.env'); // Backend .env

      // Helper function to update .env file
      const updateEnvFile = (envPath) => {
        if (!fs.existsSync(envPath)) {
          console.log(`⚠️  ${envPath} topilmadi, yaratilmoqda...`);
          fs.writeFileSync(envPath, '', 'utf8');
        }

        // Read current .env
        let envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        let found = false;
        let newLines = [];

        // Process each line
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Check if this line contains AUTOREPLY_SESSION_STRING (commented or not)
          if (line.includes('AUTOREPLY_SESSION_STRING=')) {
            if (!found) {
              // Replace first occurrence
              newLines.push(`AUTOREPLY_SESSION_STRING=${sessionString}`);
              found = true;
              console.log(`   Mavjud session qatori almashtirildi (line ${i + 1})`);
            }
            // Skip duplicate lines
          } else {
            newLines.push(line);
          }
        }

        // If not found, add new
        if (!found) {
          newLines.push('');
          newLines.push('# Auto-Reply Session (Dashboard\'dan qo\'shildi - ' + new Date().toLocaleString('uz-UZ') + ')');
          newLines.push(`AUTOREPLY_SESSION_STRING=${sessionString}`);
          console.log(`   Yangi session qatori qo'shildi`);
        }

        // Write back
        const newContent = newLines.join('\n');
        fs.writeFileSync(envPath, newContent, 'utf8');
        console.log(`✅ Session ${envPath} ga saqlandi (${sessionString.length} belgi)`);
      };

      // Update both .env files
      updateEnvFile(rootEnvPath);
      updateEnvFile(backendEnvPath);

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

  /**
   * ============================================
   * SCHEDULED BROADCAST METHODS
   * ============================================
   */

  /**
   * Add scheduled broadcast
   * @param {object} schedule - {message, cronExpression, enabled}
   * @returns {object} - Created schedule with ID
   */
  addScheduledBroadcast(schedule) {
    const newSchedule = {
      id: Date.now().toString(),
      message: schedule.message,
      cronExpression: schedule.cronExpression,
      enabled: schedule.enabled !== false,
      lastRun: null,
      nextRun: this.calculateNextRun(schedule.cronExpression),
      createdAt: Date.now()
    };

    this.scheduledBroadcasts.push(newSchedule);
    console.log(`📅 Scheduled broadcast added: ${newSchedule.id} - Next run: ${new Date(newSchedule.nextRun)}`);

    return newSchedule;
  }

  /**
   * Calculate next run time based on cron expression
   * Simple implementation: supports "every X minutes/hours"
   */
  calculateNextRun(cronExpression) {
    const now = Date.now();

    // Parse simple cron: "*/5 * * * *" (every 5 minutes)
    // Or custom format: "every:5:minutes", "every:1:hours"
    if (cronExpression.startsWith('every:')) {
      const parts = cronExpression.split(':');
      const interval = parseInt(parts[1]);
      const unit = parts[2]; // 'minutes' or 'hours'

      if (unit === 'minutes') {
        return now + (interval * 60 * 1000);
      } else if (unit === 'hours') {
        return now + (interval * 60 * 60 * 1000);
      }
    }

    // Default: 1 hour
    return now + (60 * 60 * 1000);
  }

  /**
   * Check and run scheduled broadcasts (runs every minute)
   */
  async checkScheduledBroadcasts() {
    if (!this.scheduledBroadcastsEnabled || !this.isConnected) {
      return;
    }

    const now = Date.now();

    for (const schedule of this.scheduledBroadcasts) {
      if (!schedule.enabled) {
        continue;
      }

      // Check if it's time to run
      if (schedule.nextRun && now >= schedule.nextRun) {
        console.log(`🕐 Running scheduled broadcast: ${schedule.id}`);

        try {
          // Start broadcast
          await this.startBroadcast(schedule.message, { speed: 'safe' });

          // Update last run and calculate next run
          schedule.lastRun = now;
          schedule.nextRun = this.calculateNextRun(schedule.cronExpression);

          console.log(`✅ Scheduled broadcast sent. Next run: ${new Date(schedule.nextRun)}`);
        } catch (error) {
          console.error(`❌ Scheduled broadcast error:`, error.message);
        }
      }
    }
  }

  /**
   * Get all scheduled broadcasts
   */
  getScheduledBroadcasts() {
    return this.scheduledBroadcasts.map(s => ({
      ...s,
      nextRunFormatted: s.nextRun ? new Date(s.nextRun).toISOString() : null
    }));
  }

  /**
   * Update scheduled broadcast
   */
  updateScheduledBroadcast(id, updates) {
    const schedule = this.scheduledBroadcasts.find(s => s.id === id);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    if (updates.message) schedule.message = updates.message;
    if (updates.cronExpression) {
      schedule.cronExpression = updates.cronExpression;
      schedule.nextRun = this.calculateNextRun(updates.cronExpression);
    }
    if (updates.enabled !== undefined) schedule.enabled = updates.enabled;

    return schedule;
  }

  /**
   * Delete scheduled broadcast
   */
  deleteScheduledBroadcast(id) {
    const index = this.scheduledBroadcasts.findIndex(s => s.id === id);
    if (index === -1) {
      throw new Error('Schedule not found');
    }

    this.scheduledBroadcasts.splice(index, 1);
    return { success: true, message: 'Schedule deleted' };
  }

  /**
   * ============================================
   * PRIVATE MESSAGE AUTO-REPLY METHODS
   * ============================================
   */

  /**
   * Setup private message listener
   */
  async setupPrivateMessageListener() {
    // Wait for client to connect
    setTimeout(async () => {
      if (!this.client || !this.isConnected) {
        return;
      }

      try {
        const { Api } = require('telegram');

        // Listen for new messages
        this.client.addEventHandler(async (event) => {
          try {
            const message = event.message;
            if (!message || !message.message) {
              return;
            }

            // Check if it's a private message (not from group/channel)
            const isPrivate = message.isPrivate;
            if (!isPrivate) {
              return;
            }

            // Check if auto-reply is enabled
            if (!this.privateMessageAutoReply.enabled) {
              return;
            }

            // Get sender ID
            const senderId = message.senderId?.toString();
            if (!senderId) {
              return;
            }

            // Check if we already replied to this user (in this session)
            if (this.privateMessageAutoReply.repliedUsers.has(senderId)) {
              console.log(`⏭️  Already replied to ${senderId} - skipping`);
              return;
            }

            // Get sender info
            const sender = await message.getSender();
            const senderName = sender?.firstName || sender?.username || 'User';

            console.log(`💬 Private message from ${senderName} (${senderId})`);

            // Send auto-reply
            await this.client.sendMessage(senderId, {
              message: this.privateMessageAutoReply.template
            });

            // Mark as replied
            this.privateMessageAutoReply.repliedUsers.add(senderId);

            console.log(`✅ Private auto-reply sent to ${senderName}`);

          } catch (error) {
            console.error('❌ Private message handler error:', error.message);
          }
        }, new Api.events.NewMessage({}));

        console.log('✅ Private message listener activated');

      } catch (error) {
        console.error('❌ Failed to setup private message listener:', error.message);
      }
    }, 5000); // Wait 5 seconds for client to be ready
  }

  /**
   * Update private message auto-reply settings
   */
  updatePrivateMessageAutoReply(settings) {
    if (settings.enabled !== undefined) {
      this.privateMessageAutoReply.enabled = settings.enabled;
    }

    if (settings.template) {
      this.privateMessageAutoReply.template = settings.template;
    }

    return {
      success: true,
      settings: {
        enabled: this.privateMessageAutoReply.enabled,
        template: this.privateMessageAutoReply.template,
        repliedCount: this.privateMessageAutoReply.repliedUsers.size
      }
    };
  }

  /**
   * Get private message auto-reply settings
   */
  getPrivateMessageAutoReply() {
    return {
      enabled: this.privateMessageAutoReply.enabled,
      template: this.privateMessageAutoReply.template,
      repliedCount: this.privateMessageAutoReply.repliedUsers.size
    };
  }

  /**
   * Clear replied users list (reset)
   */
  clearRepliedUsers() {
    this.privateMessageAutoReply.repliedUsers.clear();
    return { success: true, message: 'Replied users list cleared' };
  }
}

// Singleton instance
const autoReplySession = new AutoReplySessionService();

module.exports = autoReplySession;
