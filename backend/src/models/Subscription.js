const { query } = require('../config/database');

class Subscription {
  static async create({ telegram_user_id, username, full_name, subscription_type, amount, currency = 'UZS' }) {
    // Calculate end date based on subscription type
    let duration = '1 day';
    if (subscription_type === 'weekly') duration = '7 days';
    if (subscription_type === 'monthly') duration = '30 days';

    const result = await query(
      `INSERT INTO subscriptions (
        telegram_user_id, username, full_name, subscription_type,
        is_active, start_date, end_date, amount, currency
      )
      VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '${duration}', $5, $6)
      RETURNING *`,
      [telegram_user_id, username, full_name, subscription_type, amount, currency]
    );
    return result.rows[0];
  }

  static async findByTelegramId(telegram_user_id) {
    const result = await query(
      `SELECT * FROM subscriptions
       WHERE telegram_user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [telegram_user_id]
    );
    return result.rows[0];
  }

  static async findActiveByTelegramId(telegram_user_id) {
    const result = await query(
      `SELECT * FROM subscriptions
       WHERE telegram_user_id = $1
       AND is_active = true
       AND end_date > CURRENT_TIMESTAMP
       ORDER BY created_at DESC
       LIMIT 1`,
      [telegram_user_id]
    );
    return result.rows[0];
  }

  static async isActive(telegram_user_id) {
    const result = await query(
      `SELECT COUNT(*) FROM subscriptions
       WHERE telegram_user_id = $1
       AND is_active = true
       AND end_date > CURRENT_TIMESTAMP`,
      [telegram_user_id]
    );
    return parseInt(result.rows[0].count) > 0;
  }

  static async findAll(filters = {}) {
    let sql = 'SELECT * FROM subscriptions WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.is_active !== undefined) {
      sql += ` AND is_active = $${paramCount++}`;
      params.push(filters.is_active);
    }

    if (filters.subscription_type) {
      sql += ` AND subscription_type = $${paramCount++}`;
      params.push(filters.subscription_type);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ` LIMIT $${paramCount++}`;
      params.push(filters.limit);
    }

    const result = await query(sql, params);
    return result.rows;
  }

  static async deactivate(id) {
    const result = await query(
      `UPDATE subscriptions
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  static async extend(id, days) {
    const result = await query(
      `UPDATE subscriptions
       SET end_date = end_date + INTERVAL '${days} days',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  static async checkAndDeactivateExpired() {
    await query(
      `UPDATE subscriptions
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE is_active = true AND end_date < CURRENT_TIMESTAMP`
    );
  }

  static async getStatistics() {
    const result = await query(`
      SELECT
        COUNT(*) as total_subscriptions,
        COUNT(*) FILTER (WHERE is_active = true AND end_date > CURRENT_TIMESTAMP) as active_subscriptions,
        COUNT(*) FILTER (WHERE subscription_type = 'daily') as daily_count,
        COUNT(*) FILTER (WHERE subscription_type = 'weekly') as weekly_count,
        COUNT(*) FILTER (WHERE subscription_type = 'monthly') as monthly_count,
        SUM(amount) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as revenue_30days
      FROM subscriptions
    `);
    return result.rows[0];
  }
}

module.exports = Subscription;
