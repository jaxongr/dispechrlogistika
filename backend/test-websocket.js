/**
 * WebSocket Test Script
 * Test e'lonni barcha clientlarga yuboradi
 */

const WebSocket = require('ws');

// Connect to WebSocket server
const ws = new WebSocket('ws://localhost:3001/ws');

ws.on('open', () => {
  console.log('📡 Connected to WebSocket server');

  // Send test announcement
  const testAnnouncement = {
    type: 'new_announcement',
    data: {
      id: Date.now(),
      text: '🔥 TEST E\'LON: Toshkent → Samarqand\n5 tonna olma kerak\n+998901234567',
      phone: '+998901234567',
      posted_at: new Date().toISOString(),
      group_name: 'Test Guruh',
      route: 'Toshkent → Samarqand',
      cargo_type: 'Olma',
      weight: '5 tonna',
      price: null
    }
  };

  console.log('📤 Sending test announcement...');
  ws.send(JSON.stringify(testAnnouncement));

  console.log('✅ Test announcement sent!');
  console.log('📱 Check Mini Web App - should appear in 1-2 seconds!');

  // Close connection
  setTimeout(() => {
    ws.close();
    console.log('👋 Connection closed');
    process.exit(0);
  }, 1000);
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
  process.exit(1);
});
