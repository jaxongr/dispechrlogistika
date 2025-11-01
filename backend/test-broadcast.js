/**
 * Test broadcast - Database'ga test e'lon qo'shadi va broadcast qiladi
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Message = require('./src/models/Message');

async function testBroadcast() {
  try {
    console.log('📝 Creating test announcement...');

    // Create test message in database
    const testMessage = await Message.create({
      telegram_message_id: Date.now(),
      group_id: 1,
      sender_user_id: 'test_user',
      sender_username: 'test_user',
      sender_full_name: 'Test User',
      message_text: '🔥 TEST E\'LON: Toshkent → Samarqand\n5 tonna olma kerak\nNarxi: 1000$ tonnasi\nTel: +998901234567',
      message_date: new Date().toISOString(),
      contact_phone: '+998901234567',
      route_from: 'Toshkent',
      route_to: 'Samarqand',
      cargo_type: 'Olma',
      weight: '5 tonna',
      price: '1000$ tonna',
      is_dispatcher: false,
      confidence_score: 0.5,
      raw_data: { test: true }
    });

    console.log('✅ Test message created:', testMessage.id);

    // Broadcast via WebSocket
    const websocketServer = require('./src/services/websocket-server');

    if (websocketServer && websocketServer.broadcastNewAnnouncement) {
      websocketServer.broadcastNewAnnouncement({
        id: testMessage.id,
        text: testMessage.message_text,
        phone: testMessage.contact_phone,
        posted_at: testMessage.message_date,
        group_name: 'Test Guruh',
        route: `${testMessage.route_from} → ${testMessage.route_to}`,
        cargo_type: testMessage.cargo_type,
        weight: testMessage.weight,
        price: testMessage.price
      });

      console.log('📡 Test announcement broadcasted!');
      console.log('📱 Check Mini Web App - should appear immediately!');
    } else {
      console.log('⚠️ WebSocket server not initialized');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testBroadcast();
