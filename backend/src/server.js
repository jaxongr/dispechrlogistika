/**
 * Logistics Dispatch Filter System
 * Main Server Entry Point
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Services
const telegramSession = require('./services/telegram-session');
const telegramBot = require('./services/telegram-bot');

// Routes
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      formAction: ["'self'"],
    },
  },
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
});
app.use('/api/', limiter);

// Static files (frontend)
const frontendPath = path.join(__dirname, '../../frontend/public');
app.use(express.static(frontendPath));
console.log('📁 Frontend path:', frontendPath);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      telegram_session: telegramSession.isConnected,
      telegram_bot: telegramBot.isRunning
    }
  });
});

// Frontend routes
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route topilmadi' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server xatolik:', err);
  res.status(500).json({ error: 'Server xatolik' });
});

// Start server
async function startServer() {
  try {
    console.log('\n🚀 ========================================');
    console.log('   LOGISTIKA DISPETCHR FILTER SYSTEM');
    console.log('========================================\n');

    // Start Express server
    app.listen(PORT, () => {
      console.log(`✅ HTTP Server ishga tushdi: http://localhost:${PORT}`);
    });

    // Start Telegram Bot
    console.log('\n🤖 Telegram bot ishga tushmoqda...');
    await telegramBot.start();

    // Start Telegram Session (guruhlardan o'qish)
    console.log('\n📱 Telegram session ishga tushmoqda...');
    console.log('⚠️  Agar birinchi marta ishga tushirayotgan bo\'lsangiz,');
    console.log('   telefon raqam va kodingizni kiritishingiz kerak.\n');

    // Faqat session string bo'lsa, ulanadi
    if (process.env.TELEGRAM_SESSION_STRING) {
      await telegramSession.connect();
    } else {
      console.log('⚠️  TELEGRAM_SESSION_STRING topilmadi.');
      console.log('   Telegram session\'ni ishga tushirish uchun:');
      console.log('   npm run connect-telegram\n');
    }

    console.log('\n✅ Barcha xizmatlar ishga tushdi!');
    console.log('📊 Dashboard: http://localhost:' + PORT);
    console.log('🔌 API: http://localhost:' + PORT + '/api');
    console.log('\n========================================\n');

  } catch (error) {
    console.error('❌ Server ishga tushirishda xatolik:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Server to\'xtatilmoqda...');

  try {
    await telegramSession.disconnect();
    telegramBot.stop();
    console.log('✅ Barcha xizmatlar to\'xtatildi');
    process.exit(0);
  } catch (error) {
    console.error('❌ To\'xtatishda xatolik:', error);
    process.exit(1);
  }
});

// Start the server
startServer();
