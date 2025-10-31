/**
 * Orders Management
 * Bot orqali yaratilgan buyurtmalarni boshqarish
 */

// Load orders on page load
document.addEventListener('DOMContentLoaded', () => {
  loadOrders();
  loadStatistics();
  loadDailyArchive();

  // Auto-refresh every 30 seconds
  setInterval(() => {
    loadOrders();
    loadStatistics();
    loadDailyArchive();
  }, 30000);
});

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', () => {
  AuthAPI.logout();
});

/**
 * Load orders from API
 */
async function loadOrders() {
  const container = document.getElementById('ordersContainer');

  try {
    const response = await apiRequest('/api/bot-orders');

    if (!response.success) {
      throw new Error(response.error || 'Xatolik yuz berdi');
    }

    const orders = response.orders || [];

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle"></i> Hozircha buyurtmalar yo'q
        </div>
      `;
      return;
    }

    // Render orders table
    let html = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Vaqt</th>
              <th>Yo'nalish</th>
              <th>Yuk</th>
              <th>Narx</th>
              <th>Buyurtmachi</th>
              <th>Telefon</th>
              <th>Status</th>
              <th>Qabul qilgan</th>
            </tr>
          </thead>
          <tbody>
    `;

    orders.forEach(order => {
      const createdAt = formatDate(order.created_at);
      const status = getStatusBadge(order.status);
      const takenBy = order.taken_by_user_id
        ? `<span class="badge bg-success">${order.taken_by_user_id}</span>`
        : '-';

      html += `
        <tr>
          <td class="text-nowrap">${createdAt}</td>
          <td><strong>${escapeHtml(order.route)}</strong></td>
          <td>${escapeHtml(order.cargo_info)}</td>
          <td>${escapeHtml(order.price)}</td>
          <td>
            <div>${escapeHtml(order.creator_full_name || '-')}</div>
            <small class="text-muted">@${escapeHtml(order.creator_username || '-')}</small>
          </td>
          <td>
            <a href="tel:${order.creator_phone}">${order.creator_phone}</a>
          </td>
          <td>${status}</td>
          <td>${takenBy}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;

  } catch (error) {
    console.error('Load orders error:', error);
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle"></i> Xatolik: ${error.message}
      </div>
    `;
  }
}

/**
 * Load statistics
 */
async function loadStatistics() {
  try {
    const response = await apiRequest('/api/bot-orders/statistics');

    if (response.success && response.statistics) {
      const stats = response.statistics;

      document.getElementById('totalOrders').textContent = stats.total || 0;
      document.getElementById('takenOrders').textContent = stats.taken || 0;
      document.getElementById('pendingOrders').textContent = stats.pending || 0;
      document.getElementById('groupOrders').textContent = stats.posted_to_group || 0;
    }

  } catch (error) {
    console.error('Load statistics error:', error);
  }
}

/**
 * Get status badge HTML
 */
function getStatusBadge(status) {
  const statusMap = {
    'pending': '<span class="badge bg-warning">Kutilmoqda</span>',
    'taken': '<span class="badge bg-success">Qabul qilindi</span>',
    'posted_to_group': '<span class="badge bg-info">Guruhga chiqdi</span>'
  };

  return statusMap[status] || '<span class="badge bg-secondary">Noma\'lum</span>';
}

/**
 * Format date
 */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  // Less than 1 minute ago
  if (diff < 60) {
    return 'Hozirgina';
  }

  // Less than 1 hour ago
  if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return `${minutes} daqiqa oldin`;
  }

  // Less than 1 day ago
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} soat oldin`;
  }

  // Format as date
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Load daily archive
 */
async function loadDailyArchive() {
  try {
    const response = await apiRequest('/api/bot-orders/daily-stats?limit=30');

    if (!response.success) {
      throw new Error(response.error || 'Xatolik yuz berdi');
    }

    const stats = response.statistics || [];
    const container = document.getElementById('dailyArchiveContainer');

    if (stats.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-archive" style="font-size: 3rem;"></i>
          <p class="mt-2">Hali kunlik arxiv yo'q</p>
          <small>Har kecha 00:00 da avtomatik saqlanadi</small>
        </div>
      `;
      return;
    }

    let html = '<div class="table-responsive"><table class="table table-striped table-hover">';
    html += `
      <thead>
        <tr>
          <th>📅 Sana</th>
          <th>📦 Jami buyurtma</th>
          <th>✅ Qabul qilindi</th>
          <th>📤 Guruhga chiqdi</th>
          <th>⏳ Kutilmoqda</th>
        </tr>
      </thead>
      <tbody>
    `;

    stats.forEach(stat => {
      const date = new Date(stat.date).toLocaleDateString('uz-UZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      html += `
        <tr>
          <td><strong>${date}</strong></td>
          <td><span class="badge bg-primary">${stat.total_orders || 0}</span></td>
          <td><span class="badge bg-success">${stat.taken_orders || 0}</span></td>
          <td><span class="badge bg-info">${stat.posted_to_group || 0}</span></td>
          <td><span class="badge bg-warning">${stat.pending_orders || 0}</span></td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;

  } catch (error) {
    console.error('Load daily archive error:', error);
    const container = document.getElementById('dailyArchiveContainer');
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle"></i> Xatolik: ${error.message}
      </div>
    `;
  }
}
