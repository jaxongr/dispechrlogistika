/**
 * WebSocket Server - Real-time yangilanishlar
 * Yangi xabar kelganda barcha WebApp clientlarga yuboradi
 */

const WebSocket = require('ws');

class WebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Set();
  }

  /**
   * WebSocket serverni ishga tushirish
   */
  initialize(server) {
    this.wss = new WebSocket.Server({
      server,
      path: '/ws'
    });

    this.wss.on('connection', (ws, req) => {
      console.log('📡 WebSocket client connected');
      this.clients.add(ws);

      // Heartbeat - connection alive ekanligini tekshirish
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Client disconnect
      ws.on('close', () => {
        console.log('📡 WebSocket client disconnected');
        this.clients.delete(ws);
      });

      // Error handling
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'WebSocket connected'
      }));
    });

    // Heartbeat interval - har 30 sekundda alive tekshirish
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    console.log('✅ WebSocket server initialized on /ws');
  }

  /**
   * Yangi e'lon haqida barcha clientlarga xabar yuborish
   */
  broadcastNewAnnouncement(announcement) {
    const message = JSON.stringify({
      type: 'new_announcement',
      data: announcement
    });

    let sentCount = 0;
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sentCount++;
      }
    });

    console.log(`📡 Broadcast sent to ${sentCount} clients`);
  }

  /**
   * E'lon o'chirilgani haqida xabar yuborish
   */
  broadcastAnnouncementDeleted(messageId) {
    const message = JSON.stringify({
      type: 'announcement_deleted',
      data: { message_id: messageId }
    });

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Aktiv clientlar soni
   */
  getActiveClientsCount() {
    return this.clients.size;
  }
}

// Singleton instance
const websocketServer = new WebSocketServer();

module.exports = websocketServer;
