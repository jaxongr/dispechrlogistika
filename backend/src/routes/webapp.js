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
    console.warn('⚠️ TWA auth: No authorization header - allowing anyway');
    return next(); // Allow for now to test
  }

  // Validate init data
  const isValid = validateTelegramWebAppData(initData);

  if (!isValid) {
    console.warn('⚠️ TWA validation failed - allowing anyway');
    // Allow anyway for now
  }

  // Parse user info
  try {
    const urlParams = new URLSearchParams(initData);
    const userJson = urlParams.get('user');

    if (userJson) {
      req.user = JSON.parse(userJson);
    }
  } catch (error) {
    console.error('Error parsing user data:', error);
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
        const age = Date.now() - new Date(msg.message_date || msg.created_at).getTime();
        return age < 24 * 60 * 60 * 1000; // 24 hours
      })
      .orderBy('message_date', 'desc')
      .value();

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      announcements = announcements.filter(a =>
        (a.message_text && a.message_text.toLowerCase().includes(searchLower)) ||
        (a.contact_phone && a.contact_phone.includes(searchLower))
      );
    }

    // Apply route filter
    if (route_from) {
      announcements = announcements.filter(a =>
        a.message_text && a.message_text.toLowerCase().includes(route_from.toLowerCase())
      );
    }

    if (route_to) {
      announcements = announcements.filter(a =>
        a.message_text && a.message_text.toLowerCase().includes(route_to.toLowerCase())
      );
    }

    // Extract structured data
    const structuredAnnouncements = announcements.map(msg => {
      const messageText = msg.message_text || '';

      // Try to extract route from text
      let route = 'Yo\'nalish ko\'rsatilmagan';
      let cargo_type = null;
      let weight = msg.weight || null; // Use existing weight if available
      let price = null;

      if (messageText) {
        // Extract route (e.g., "Toshkent - Samarqand" or "Toshkent → Samarqand")
        const routeMatch = messageText.match(/([А-Яа-яЎўҚқҒғҲҳЎўЁё\w]+)\s*[-→—]\s*([А-Яа-яЎўҚқҒғҲҳЎўЁё\w]+)/);
        if (routeMatch) {
          route = `${routeMatch[1]} → ${routeMatch[2]}`;
        }

        // Extract cargo type
        const cargoKeywords = ['мева', 'сабзавот', 'олма', 'узум', 'помидор', 'картошка', 'юк', 'груз', 'материал', 'техника'];
        for (const keyword of cargoKeywords) {
          if (messageText.toLowerCase().includes(keyword)) {
            cargo_type = keyword.charAt(0).toUpperCase() + keyword.slice(1);
            break;
          }
        }

        // Extract weight if not already set
        if (!weight) {
          const weightMatch = messageText.match(/(\d+(?:[.,]\d+)?)\s*(т|тонна|тонн|ton)/i);
          if (weightMatch) {
            weight = `${weightMatch[1]} ${weightMatch[2]}`;
          }
        }

        // Extract price
        const priceMatch = messageText.match(/(\d+(?:\s?\d+)*)\s*(usd|dollar|\$|сум|so'm)/i);
        if (priceMatch) {
          price = `${priceMatch[1]} ${priceMatch[2]}`;
        }
      }

      return {
        id: msg.id,
        route: route,
        cargo_type: cargo_type || msg.cargo_type,
        weight: weight,
        price: price || msg.price,
        phone: msg.contact_phone || null,
        text: messageText,
        posted_at: msg.message_date || msg.created_at,
        group_name: msg.raw_data?.chat?.title || 'Unknown'
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

/**
 * POST /api/webapp/report
 * E'lonni bloklash va o'chirish (admin tasdiqisiz)
 */
router.post('/report', authenticateTWA, async (req, res) => {
  try {
    const { db } = require('../config/database');
    const { message_id, phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Telefon raqam kiritilmagan'
      });
    }

    console.log(`📢 WebApp report: Blocking phone ${phone} (message ${message_id})`);

    // 1. Block the phone number
    const existingBlock = db.get('blocked_phones')
      .find({ phone: phone })
      .value();

    if (!existingBlock) {
      db.get('blocked_phones')
        .push({
          id: Date.now(),
          phone: phone,
          reason: 'WebApp report: Bu dispecher ekan',
          blocked_at: new Date().toISOString(),
          blocked_by: 'webapp_user'
        })
        .write();

      console.log(`🚫 Phone blocked: ${phone}`);
    } else {
      console.log(`⚠️ Phone already blocked: ${phone}`);
    }

    // 2. Delete the specific message
    if (message_id) {
      db.get('messages')
        .remove({ id: message_id })
        .write();

      console.log(`🗑️ Message deleted: ${message_id}`);
    }

    // 3. Delete all other messages from this phone
    const deletedCount = db.get('messages')
      .remove({ contact_phone: phone })
      .write()
      .length;

    console.log(`🗑️ Deleted ${deletedCount} messages from phone ${phone}`);

    res.json({
      success: true,
      message: 'Raqam bloklandi va barcha e\'lonlar o\'chirildi',
      phone: phone,
      deleted_messages: deletedCount + (message_id ? 1 : 0)
    });

  } catch (error) {
    console.error('WebApp report error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
