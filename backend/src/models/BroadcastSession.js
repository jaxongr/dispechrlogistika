/**
 * Broadcast Session Model
 * Ko'p broadcast sessionlarni boshqarish uchun
 */

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const dbPath = path.join(__dirname, '../../db.json');
const adapter = new FileSync(dbPath);
const db = low(adapter);

// Initialize broadcast_sessions table
db.defaults({ broadcast_sessions: [] }).write();

class BroadcastSession {
  /**
   * Create new broadcast session
   */
  static create(data) {
    const session = {
      id: Date.now().toString(),
      name: data.name,
      phone_number: data.phone_number,
      session_string: data.session_string,
      is_active: true,
      is_connected: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_used_at: null,
      stats: {
        total_groups: 0,
        total_sent: 0,
        total_failed: 0,
        last_broadcast_at: null
      }
    };

    db.get('broadcast_sessions').push(session).write();
    return session;
  }

  /**
   * Get all sessions
   */
  static getAll() {
    return db.get('broadcast_sessions').value() || [];
  }

  /**
   * Get active sessions only
   */
  static getActive() {
    return db.get('broadcast_sessions')
      .filter({ is_active: true })
      .value() || [];
  }

  /**
   * Get session by ID
   */
  static findById(id) {
    return db.get('broadcast_sessions')
      .find({ id })
      .value();
  }

  /**
   * Update session
   */
  static update(id, updates) {
    return db.get('broadcast_sessions')
      .find({ id })
      .assign({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .write();
  }

  /**
   * Update connection status
   */
  static updateConnectionStatus(id, isConnected) {
    return db.get('broadcast_sessions')
      .find({ id })
      .assign({
        is_connected: isConnected,
        updated_at: new Date().toISOString()
      })
      .write();
  }

  /**
   * Update stats
   */
  static updateStats(id, stats) {
    const session = this.findById(id);
    if (!session) return null;

    const newStats = {
      ...session.stats,
      ...stats,
      last_broadcast_at: new Date().toISOString()
    };

    return db.get('broadcast_sessions')
      .find({ id })
      .assign({
        stats: newStats,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .write();
  }

  /**
   * Delete session
   */
  static delete(id) {
    return db.get('broadcast_sessions')
      .remove({ id })
      .write();
  }

  /**
   * Toggle active status
   */
  static toggleActive(id) {
    const session = this.findById(id);
    if (!session) return null;

    return db.get('broadcast_sessions')
      .find({ id })
      .assign({
        is_active: !session.is_active,
        updated_at: new Date().toISOString()
      })
      .write();
  }

  /**
   * Update session name
   */
  static updateName(id, name) {
    return db.get('broadcast_sessions')
      .find({ id })
      .assign({
        name,
        updated_at: new Date().toISOString()
      })
      .write();
  }

  /**
   * Get least recently used active session
   */
  static getLeastRecentlyUsed() {
    const sessions = this.getActive();
    if (sessions.length === 0) return null;

    // Sort by last_used_at (null first, then oldest first)
    return sessions.sort((a, b) => {
      if (!a.last_used_at && !b.last_used_at) return 0;
      if (!a.last_used_at) return -1;
      if (!b.last_used_at) return 1;
      return new Date(a.last_used_at) - new Date(b.last_used_at);
    })[0];
  }

  /**
   * Get session count
   */
  static count() {
    return db.get('broadcast_sessions').value()?.length || 0;
  }

  /**
   * Get active session count
   */
  static countActive() {
    return db.get('broadcast_sessions')
      .filter({ is_active: true })
      .value()?.length || 0;
  }
}

module.exports = BroadcastSession;
