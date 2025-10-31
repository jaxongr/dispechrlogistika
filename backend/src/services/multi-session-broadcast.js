/**
 * Multi-Session Broadcast Service
 * Ko'p sessionlarni boshqarish va navbat bilan broadcast yuborish
 */

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const BroadcastSession = require('../models/BroadcastSession');

class MultiSessionBroadcastService {
  constructor() {
    // Session clients cache
    this.clients = new Map(); // sessionId -> { client, isConnected, groups }

    // Broadcast state
    this.broadcastInProgress = false;
    this.broadcastQueue = [];
    this.currentSessionIndex = 0;
    this.broadcastProgress = {
      total: 0,
      sent: 0,
      failed: 0,
      skipped: 0, // FloodWait and restricted groups
      currentSession: null,
      startedAt: null,
      loopCount: 0
    };

    // Settings
    this.broadcastLoopEnabled = false;
    this.broadcastMessage = null;
    this.intervalMs = 8000; // 8 soniya (FLOOD_WAIT dan qochish uchun)
    this.cyclePauseMs = 5 * 60 * 1000; // 5 daqiqa

    // Restricted groups tracking
    this.restrictedGroups = new Map(); // chatId -> {until: timestamp}

    // Track sent groups (to avoid sending to same group twice across different sessions)
    this.sentGroups = new Set(); // chatId

    // Process broadcast queue
    setInterval(() => this.processBroadcastQueue(), 1000);

    // Check restricted groups
    setInterval(() => this.checkRestrictedGroups(), 60000);

    // Auto-connect all active sessions on startup
    setTimeout(() => this.connectAllSessions(), 3000);
  }

  /**
   * Connect all active sessions
   */
  async connectAllSessions() {
    try {
      const sessions = BroadcastSession.getActive();
      console.log(`\n🔄 Connecting ${sessions.length} active sessions...`);

      for (const session of sessions) {
        try {
          await this.connectSession(session.id);
        } catch (error) {
          console.error(`❌ Failed to connect session ${session.name}:`, error.message);
        }
      }

      console.log(`✅ Connected ${this.clients.size} sessions\n`);
    } catch (error) {
      console.error('❌ Auto-connect error:', error);
    }
  }

  /**
   * Connect single session
   */
  async connectSession(sessionId) {
    try {
      const session = BroadcastSession.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      if (!session.is_active) {
        throw new Error('Session is not active');
      }

      // Check if already connected
      if (this.clients.has(sessionId)) {
        const cached = this.clients.get(sessionId);
        if (cached.isConnected) {
          console.log(`⏭️  Session ${session.name} already connected`);
          return cached;
        }
      }

      const apiId = parseInt(process.env.TELEGRAM_API_ID);
      const apiHash = process.env.TELEGRAM_API_HASH;

      if (!apiId || !apiHash) {
        throw new Error('TELEGRAM_API_ID or TELEGRAM_API_HASH not set');
      }

      console.log(`🔄 Connecting session: ${session.name}...`);

      const stringSession = new StringSession(session.session_string);
      const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
      });

      await client.connect();

      if (!client.connected) {
        throw new Error('Failed to connect');
      }

      // Get account info
      const me = await client.getMe();
      console.log(`✅ Session connected: ${session.name} (${me.firstName} ${me.phone})`);

      // Get groups from this session
      console.log(`📥 Loading groups from ${session.name}...`);
      const dialogs = await client.getDialogs({ limit: 500 });

      console.log(`   Total dialogs: ${dialogs.length}`);

      const groups = dialogs
        .filter(d => {
          const isValid = d.isGroup || d.isChannel;
          if (!isValid) {
            console.log(`   ⏭️ Skipping: ${d.title} (not group/channel)`);
          }
          return isValid;
        })
        .map(d => ({
          chatId: d.id?.toString(),
          name: d.title,
          username: d.entity?.username || ''
        }))
        .filter(g => g.chatId);

      console.log(`   ✅ Found ${groups.length} groups/channels in ${session.name}`);

      // Cache client and groups
      const clientData = {
        client,
        isConnected: true,
        groups,
        sessionId: session.id,
        sessionName: session.name
      };

      this.clients.set(sessionId, clientData);

      // Update session status
      BroadcastSession.updateConnectionStatus(sessionId, true);
      BroadcastSession.updateStats(sessionId, {
        total_groups: groups.length
      });

      return clientData;

    } catch (error) {
      console.error(`❌ Session connect error (${sessionId}):`, error.message);

      // Update session status
      BroadcastSession.updateConnectionStatus(sessionId, false);

      throw error;
    }
  }

  /**
   * Disconnect session
   */
  async disconnectSession(sessionId) {
    try {
      const clientData = this.clients.get(sessionId);
      if (!clientData) {
        return;
      }

      if (clientData.client && clientData.isConnected) {
        await clientData.client.disconnect();
      }

      this.clients.delete(sessionId);

      // Update session status
      BroadcastSession.updateConnectionStatus(sessionId, false);

      console.log(`🔌 Session disconnected: ${clientData.sessionName}`);
    } catch (error) {
      console.error(`❌ Disconnect error:`, error.message);
    }
  }

  /**
   * Start broadcast to all sessions
   */
  async startBroadcast(message, options = {}) {
    if (this.broadcastInProgress) {
      throw new Error('Broadcast already in progress');
    }

    if (!message || message.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }

    this.broadcastLoopEnabled = options.loop === true;
    this.broadcastMessage = message;

    console.log('\n📢 ========================================');
    console.log('   MULTI-SESSION BROADCAST STARTED');
    console.log(`   Loop Mode: ${this.broadcastLoopEnabled ? '🔁 YOQILGAN' : '❌ O\'CHIRILGAN'}`);
    console.log('========================================\n');

    // Get all connected sessions
    const connectedSessions = Array.from(this.clients.values())
      .filter(c => c.isConnected);

    if (connectedSessions.length === 0) {
      throw new Error('No connected sessions available');
    }

    console.log(`✅ Using ${connectedSessions.length} sessions for broadcast`);

    // Build queue: session-by-session (birinchi session barcha guruhlari, keyin ikkinchisi...)
    this.broadcastQueue = [];
    this.sentGroups.clear(); // Clear sent groups tracking
    let totalGroups = 0;
    let skippedDuplicates = 0;
    let totalRestricted = 0;

    for (const sessionData of connectedSessions) {
      // Filter out restricted groups
      const availableGroups = sessionData.groups.filter(g => {
        const restriction = this.restrictedGroups.get(g.chatId);
        if (restriction && restriction.until > Date.now()) {
          totalRestricted++;
          return false;
        }
        return true;
      });

      console.log(`   ${sessionData.sessionName}: ${availableGroups.length} available, ${sessionData.groups.length - availableGroups.length} restricted`);

      for (const group of availableGroups) {
        // Skip if already added from another session
        if (this.sentGroups.has(group.chatId)) {
          skippedDuplicates++;
          continue;
        }

        this.sentGroups.add(group.chatId);
        this.broadcastQueue.push({
          sessionId: sessionData.sessionId,
          sessionName: sessionData.sessionName,
          chatId: group.chatId,
          groupName: group.name,
          message: message
        });
        totalGroups++;
      }
    }

    console.log(`\n📊 Total unique groups to send: ${totalGroups}`);
    if (skippedDuplicates > 0) {
      console.log(`⏭️  Skipped ${skippedDuplicates} duplicate groups (exist in multiple sessions)`);
    }
    if (totalRestricted > 0) {
      console.log(`🚫 Skipped ${totalRestricted} restricted groups (FloodWait)`);
    }

    // Check if no groups available
    if (totalGroups === 0) {
      console.log('\n⚠️  WARNING: No groups available to send! All groups are restricted or duplicate.');
      console.log('💡 Wait for restrictions to clear, or try again later.\n');
    }

    // Initialize progress
    this.broadcastProgress = {
      total: totalGroups,
      sent: 0,
      failed: 0,
      skipped: 0,
      currentSession: null,
      startedAt: new Date().toISOString(),
      loopCount: 0
    };

    this.broadcastInProgress = true;

    return {
      success: true,
      total: totalGroups,
      sessions: connectedSessions.length,
      message: message
    };
  }

  /**
   * Process broadcast queue
   */
  async processBroadcastQueue() {
    if (!this.broadcastInProgress || this.broadcastQueue.length === 0) {
      // Check if cycle complete and loop enabled
      if (this.broadcastInProgress && this.broadcastQueue.length === 0 && this.broadcastLoopEnabled) {
        await this.handleBroadcastCycleComplete();
      } else if (this.broadcastInProgress && this.broadcastQueue.length === 0) {
        // No loop - mark complete
        this.broadcastInProgress = false;
        console.log('\n✅ ========================================');
        console.log('   BROADCAST COMPLETED');
        console.log(`   Total: ${this.broadcastProgress.total}`);
        console.log(`   ✅ Sent: ${this.broadcastProgress.sent}`);
        console.log(`   ⏭️  Skipped: ${this.broadcastProgress.skipped} (FloodWait/Restricted)`);
        console.log(`   ❌ Failed: ${this.broadcastProgress.failed}`);
        console.log('========================================\n');
      }
      return;
    }

    try {
      // Process one message at a time
      const item = this.broadcastQueue.shift();
      this.broadcastProgress.currentSession = item.sessionName;

      const clientData = this.clients.get(item.sessionId);
      if (!clientData || !clientData.isConnected) {
        console.log(`⚠️  Session ${item.sessionName} not connected - SKIP`);
        this.broadcastProgress.failed++;
        return;
      }

      try {
        // Send message
        await clientData.client.sendMessage(item.chatId, {
          message: item.message
        });

        this.broadcastProgress.sent++;

        // Update session stats
        const session = BroadcastSession.findById(item.sessionId);
        if (session) {
          BroadcastSession.updateStats(item.sessionId, {
            total_sent: (session.stats.total_sent || 0) + 1
          });
        }

        // Log progress every 10 messages
        if (this.broadcastProgress.sent % 10 === 0) {
          console.log(`📊 Progress: ${this.broadcastProgress.sent}/${this.broadcastProgress.total} sent (${item.sessionName})`);
        }

        // Wait 3 seconds before next message
        await this.sleep(this.intervalMs);

      } catch (error) {
        // Handle FloodWait - add to restricted groups
        if (error.message.includes('FLOOD_WAIT') || error.message.includes('A wait of')) {
          const match = error.message.match(/(\d+)/);
          const waitSeconds = match ? parseInt(match[1]) : 300;
          console.log(`⏳ FloodWait ${waitSeconds}s for ${item.groupName} - SKIP`);

          this.restrictedGroups.set(item.chatId, {
            until: Date.now() + (waitSeconds * 1000)
          });

          this.broadcastProgress.skipped++; // Don't count as failed
        } else if (error.message.includes('CHAT_WRITE_FORBIDDEN') ||
                   error.message.includes('CHAT_RESTRICTED') ||
                   error.message.includes('USER_BANNED_IN_CHANNEL')) {
          console.log(`🚫 Restricted: ${item.groupName} - SKIP`);
          this.broadcastProgress.skipped++; // Don't count as failed
        } else {
          console.log(`❌ Error (${item.sessionName} -> ${item.groupName}): ${error.message}`);
          this.broadcastProgress.failed++; // Real error
        }

        // Update session stats
        const session = BroadcastSession.findById(item.sessionId);
        if (session) {
          BroadcastSession.updateStats(item.sessionId, {
            total_failed: (session.stats.total_failed || 0) + 1
          });
        }

        // Wait a bit before next message even on error
        await this.sleep(1000); // 1 second wait on error
      }

    } catch (error) {
      console.error('❌ Queue processing error:', error.message);
    }
  }

  /**
   * Handle broadcast cycle complete (for loop mode)
   */
  async handleBroadcastCycleComplete() {
    this.broadcastProgress.loopCount++;

    console.log('\n🔁 ========================================');
    console.log('   LOOP MODE: CYCLE COMPLETE');
    console.log(`   Loop Count: ${this.broadcastProgress.loopCount}`);
    console.log(`   ✅ Sent: ${this.broadcastProgress.sent}`);
    console.log(`   ⏭️  Skipped: ${this.broadcastProgress.skipped}`);
    console.log(`   ❌ Failed: ${this.broadcastProgress.failed}`);
    console.log('   ⏸️  5 DAQIQA DAM OLINMOQDA...');
    console.log('========================================\n');

    // 5 minute pause
    await this.sleep(this.cyclePauseMs);

    console.log('✅ Dam olish tugadi, qayta boshlanyapti...\n');

    // Rebuild queue from all connected sessions
    const connectedSessions = Array.from(this.clients.values())
      .filter(c => c.isConnected);

    this.broadcastQueue = [];
    this.sentGroups.clear(); // Clear sent groups for new cycle
    let totalGroups = 0;
    let skippedDuplicates = 0;

    for (const sessionData of connectedSessions) {
      const availableGroups = sessionData.groups.filter(g => {
        const restriction = this.restrictedGroups.get(g.chatId);
        return !restriction || restriction.until <= Date.now();
      });

      for (const group of availableGroups) {
        // Skip if already added from another session
        if (this.sentGroups.has(group.chatId)) {
          skippedDuplicates++;
          continue;
        }

        this.sentGroups.add(group.chatId);
        this.broadcastQueue.push({
          sessionId: sessionData.sessionId,
          sessionName: sessionData.sessionName,
          chatId: group.chatId,
          groupName: group.name,
          message: this.broadcastMessage
        });
        totalGroups++;
      }
    }

    console.log(`🔄 Rebuilt queue: ${totalGroups} unique groups`);
    if (skippedDuplicates > 0) {
      console.log(`⏭️  Skipped ${skippedDuplicates} duplicate groups`);
    }

    // Reset progress
    this.broadcastProgress.sent = 0;
    this.broadcastProgress.failed = 0;
    this.broadcastProgress.skipped = 0;
    this.broadcastProgress.total = totalGroups;

    console.log(`🔄 Broadcast restarted: ${totalGroups} groups\n`);
  }

  /**
   * Stop broadcast
   */
  stopBroadcast() {
    if (!this.broadcastInProgress) {
      return { success: false, message: 'No broadcast in progress' };
    }

    const remaining = this.broadcastQueue.length;

    this.broadcastQueue = [];
    this.sentGroups.clear(); // Clear sent groups tracking
    this.broadcastInProgress = false;
    this.broadcastLoopEnabled = false;
    this.broadcastMessage = null;

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
      remaining: this.broadcastQueue.length
    };
  }

  /**
   * Get all sessions status
   */
  getAllSessionsStatus() {
    const dbSessions = BroadcastSession.getAll();

    return dbSessions.map(session => {
      const clientData = this.clients.get(session.id);

      return {
        ...session,
        is_connected: clientData?.isConnected || false,
        groups_count: clientData?.groups?.length || session.stats.total_groups || 0
      };
    });
  }

  /**
   * Check restricted groups
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
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Disconnect all sessions
   */
  async disconnectAll() {
    console.log('🔌 Disconnecting all sessions...');

    for (const [sessionId, clientData] of this.clients.entries()) {
      try {
        await this.disconnectSession(sessionId);
      } catch (error) {
        console.error(`Error disconnecting ${sessionId}:`, error.message);
      }
    }

    this.clients.clear();
    console.log('✅ All sessions disconnected');
  }
}

// Singleton
const multiSessionBroadcast = new MultiSessionBroadcastService();

module.exports = multiSessionBroadcast;
