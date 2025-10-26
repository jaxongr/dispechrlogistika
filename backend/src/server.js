/**
 * Logistics Dispatch Filter System
 * Main Server Entry Point
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Load environment variables from root .env file
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Services
const telegramSession = require('./services/telegram-session');
const telegramBot = require('./services/telegram-bot');
const autoReplySession = require('./services/autoReplySession');
const { startDailyStatisticsScheduler } = require('./services/daily-statistics-scheduler');

// Routes
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const blockedUsersRoutes = require('./routes/blocked-users');
const dispatcherReportsRoutes = require('./routes/dispatcher-reports');
const smsRoutes = require('./routes/sms');
const autoReplyRoutes = require('./routes/autoReply');
// const dailyStatisticsRoutes = require('./routes/daily-statistics'); // Vaqtincha o'chirildi - middleware muammosi

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"], // CRITICAL: Allow inline onclick handlers
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      formAction: ["'self'"],
      upgradeInsecureRequests: null,
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
app.use('/api/blocked-users', blockedUsersRoutes);
app.use('/api/dispatcher-reports', dispatcherReportsRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/auto-reply', autoReplyRoutes);
// app.use('/api/daily-statistics', dailyStatisticsRoutes); // Vaqtincha o'chirildi

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

// 404 handler - only for API routes
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Route topilmadi' });
  } else {
    // For HTML pages, return 404 page or redirect to login
    res.status(404).sendFile(path.join(frontendPath, 'index.html'));
  }
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

    // Start Telegram Bot (non-blocking)
    console.log('\n🤖 Telegram bot ishga tushmoqda...');
    telegramBot.start().catch(err => {
      console.error('❌ Telegram bot start error:', err.message);
    });

    // Start Telegram Session (guruhlardan o'qish) (non-blocking)
    console.log('\n📱 Telegram session ishga tushmoqda...');

    // Faqat session string bo'lsa, ulanadi
    if (process.env.TELEGRAM_SESSION_STRING) {
      telegramSession.connect().catch(err => {
        console.error('❌ Telegram session error:', err.message);
      });
    } else {
      console.log('⚠️  TELEGRAM_SESSION_STRING topilmadi.');
      console.log('   Telegram session\'ni ishga tushirish uchun:');
      console.log('   npm run create-session\n');
    }

    // Start Auto-Reply Session (ALOHIDA SESSION - ixtiyoriy)
    console.log('\n💬 Auto-reply session ishga tushmoqda...');
    autoReplySession.connect().catch(err => {
      // Bu xato critical emas - auto-reply shunchaki o'chiriladi
      console.log('   Auto-reply o\'chirilgan - faqat monitoring ishlaydi');
    });

    // Start Daily Statistics Scheduler
    console.log('\n📅 Kunlik statistika scheduler ishga tushmoqda...');
    startDailyStatisticsScheduler();

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
    await autoReplySession.disconnect();
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
