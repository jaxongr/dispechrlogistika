/**
 * Telegram Mini Web App Routes
 * E'lonlarni web app orqali ko'rsatish
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

/**
 * Telegram Web App Init Data'ni tekshirish
 */
function validateTelegramWebAppData(initData) {
  try {
    const BOT_TOKEN = process.env.BOT_TOKEN;

    // Parse init data
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    // Create data-check-string
    const dataCheckArr = [];
    for (const [key, value] of urlParams.entries()) {
      dataCheckArr.push(`${key}=${value}`);
    }
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    // Calculate secret key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();

    // Calculate hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return calculatedHash === hash;
  } catch (error) {
    console.error('Telegram Web App validation error:', error);
    return false;
  }
}

/**
 * Middleware: Telegram Web App authentication
 */
function authenticateTWA(req, res, next) {
  const initData = req.headers['authorization']?.replace('tma ', '');

  if (!initData) {
    return res.status(401).json({
      success: false,
      error: 'Authorization header missing'
    });
  }

  // Validate init data
  const isValid = validateTelegramWebAppData(initData);

  if (!isValid) {
    // For development - allow without validation
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ TWA validation failed - allowing in dev mode');
    } else {
      return res.status(401).json({
        success: false,
        error: 'Invalid Telegram Web App data'
      });
    }
  }

  // Parse user info
  const urlParams = new URLSearchParams(initData);
  const userJson = urlParams.get('user');

  if (userJson) {
    req.user = JSON.parse(userJson);
  }

  next();
}

/**
 * GET /api/webapp/announcements
 * E'lonlar ro'yxatini olish
 */
router.get('/announcements', authenticateTWA, async (req, res) => {
  try {
    const { db } = require('../config/database');
    const { page = 1, limit = 20, search = '', route_from = '', route_to = '' } = req.query;

    // Get all active announcements from messages
    let announcements = db.get('messages')
      .filter(msg => {
        // Filter by time (last 24 hours)
        const age = Date.now() - new Date(msg.timestamp).getTime();
        return age < 24 * 60 * 60 * 1000; // 24 hours
      })
      .orderBy('timestamp', 'desc')
      .value();

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      announcements = announcements.filter(a =>
        (a.text && a.text.toLowerCase().includes(searchLower)) ||
        (a.phone && a.phone.includes(searchLower))
      );
    }

    // Apply route filter
    if (route_from) {
      announcements = announcements.filter(a =>
        a.text && a.text.toLowerCase().includes(route_from.toLowerCase())
      );
    }

    if (route_to) {
      announcements = announcements.filter(a =>
        a.text && a.text.toLowerCase().includes(route_to.toLowerCase())
      );
    }

    // Extract structured data
    const structuredAnnouncements = announcements.map(msg => {
      // Try to extract route from text
      let route = 'Yo\'nalish ko\'rsatilmagan';
      let cargo_type = null;
      let weight = null;
      let price = null;

      if (msg.text) {
        // Extract route (e.g., "Toshkent - Samarqand" or "Toshkent → Samarqand")
        const routeMatch = msg.text.match(/([А-Яа-яЎўҚқҒғҲҳЎўЁё\w]+)\s*[-→—]\s*([А-Яа-яЎўҚқҒғҲҳЎўЁё\w]+)/);
        if (routeMatch) {
          route = `${routeMatch[1]} → ${routeMatch[2]}`;
        }

        // Extract cargo type
        const cargoKeywords = ['мева', 'сабзавот', 'олма', 'узум', 'помидор', 'картошка', 'юк', 'груз', 'материал', 'техника'];
        for (const keyword of cargoKeywords) {
          if (msg.text.toLowerCase().includes(keyword)) {
            cargo_type = keyword.charAt(0).toUpperCase() + keyword.slice(1);
            break;
          }
        }

        // Extract weight
        const weightMatch = msg.text.match(/(\d+(?:[.,]\d+)?)\s*(т|тонна|тонн|ton)/i);
        if (weightMatch) {
          weight = `${weightMatch[1]} ${weightMatch[2]}`;
        }

        // Extract price
        const priceMatch = msg.text.match(/(\d+(?:\s?\d+)*)\s*(usd|dollar|\$|сум|so'm)/i);
        if (priceMatch) {
          price = `${priceMatch[1]} ${priceMatch[2]}`;
        }
      }

      return {
        id: msg.id,
        route: route,
        cargo_type: cargo_type,
        weight: weight,
        price: price,
        phone: msg.phone || null,
        text: msg.text,
        posted_at: msg.timestamp,
        group_name: msg.group_name || 'Unknown'
      };
    });

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedResults = structuredAnnouncements.slice(startIndex, endIndex);

    res.json({
      success: true,
      announcements: paginatedResults,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: structuredAnnouncements.length,
        has_more: endIndex < structuredAnnouncements.length
      }
    });

  } catch (error) {
    console.error('WebApp announcements error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/webapp/stats
 * Statistika (user uchun)
 */
router.get('/stats', authenticateTWA, async (req, res) => {
  try {
    const { db } = require('../config/database');
    const userId = req.user?.id;

    // Get total announcements (last 24h)
    const totalAnnouncements = db.get('messages')
      .filter(msg => {
        const age = Date.now() - new Date(msg.timestamp).getTime();
        return age < 24 * 60 * 60 * 1000;
      })
      .value()
      .length;

    res.json({
      success: true,
      stats: {
        total_announcements: totalAnnouncements,
        user_id: userId
      }
    });

  } catch (error) {
    console.error('WebApp stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
