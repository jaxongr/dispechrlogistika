/**
 * Dashboard Page Logic
 */

// Check authentication
if (!requireAuth()) {
    throw new Error('Not authenticated');
}

// Display user info
const user = JSON.parse(localStorage.getItem('user'));
if (user) {
    document.getElementById('username').textContent = user.username;
}

// Logout handler
document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('Rostdan ham chiqmoqchimisiz?')) {
        AuthAPI.logout();
    }
});

// Load statistics
async function loadStatistics() {
    try {
        const data = await MessagesAPI.getStatistics();
        const stats = data.statistics;

        // Mavjud kartalar
        document.getElementById('totalMessages').textContent = stats.total_messages || 0;
        document.getElementById('sentLastHour').textContent = stats.sent_last_hour || 0;
        document.getElementById('dispatcherMessages').textContent = stats.blocked_users || 0;
        document.getElementById('sentMessages').textContent = stats.sent_messages || 0;

        // Yangi statistikalar (bugungi)
        document.getElementById('sentToGroup').textContent = stats.sent_today || 0;
        document.getElementById('blockedPhones').textContent = stats.blocked_phones || 0;
        document.getElementById('autoBlocked').textContent = stats.auto_blocked_users || 0;

        // Today and week stats (agar mavjud bo'lsa)
        if (document.getElementById('todayCount')) {
            const todayCount = stats.messages_today || 0;
            const weekCount = stats.messages_week || 0;
            const totalCount = stats.total_messages || 1;

            document.getElementById('todayCount').textContent = todayCount;
            document.getElementById('weekCount').textContent = weekCount;

            const todayPercent = (todayCount / totalCount * 100).toFixed(0);
            const weekPercent = (weekCount / totalCount * 100).toFixed(0);

            document.getElementById('todayProgress').style.width = todayPercent + '%';
            document.getElementById('weekProgress').style.width = weekPercent + '%';
        }

        // Load bot statistics
        await loadBotStatistics();

        // Load driver statistics
        await loadDriverStatistics();

    } catch (error) {
        console.error('Statistika yuklashda xatolik:', error);
    }
}

// Load bot user statistics
async function loadBotStatistics() {
    try {
        const response = await fetch('/api/statistics/bot-stats', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        });

        if (!response.ok) {
            throw new Error('Bot statistika yuklashda xatolik');
        }

        const data = await response.json();

        // Bot users (REGISTERED users - who shared phone)
        document.getElementById('botUsers').textContent = data.bot_users.registered || 0;
        document.getElementById('botUsersToday').textContent = data.bot_users.registered_today || 0;

        // Olindi users
        document.getElementById('olindiUsers').textContent = data.olindi_users.total || 0;
        document.getElementById('olindiUsersToday').textContent = data.olindi_users.today || 0;

    } catch (error) {
        console.error('Bot statistika yuklashda xatolik:', error);
        // Set defaults on error
        document.getElementById('botUsers').textContent = '0';
        document.getElementById('botUsersToday').textContent = '0';
        document.getElementById('olindiUsers').textContent = '0';
        document.getElementById('olindiUsersToday').textContent = '0';
    }
}

// Load recent messages
async function loadRecentMessages() {
    try {
        const data = await MessagesAPI.getAll({
            limit: 10,
            offset: 0
        });

        const container = document.getElementById('recentMessagesContainer');

        if (data.messages.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                    <p class="mt-2">Hali e'lonlar yo'q</p>
                </div>
            `;
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-hover">';
        html += `
            <thead>
                <tr>
                    <th>Sana</th>
                    <th>Guruh</th>
                    <th>Yuboruvchi</th>
                    <th>Xabar</th>
                    <th>Status</th>
                    <th>Ishonch</th>
                </tr>
            </thead>
            <tbody>
        `;

        data.messages.forEach(msg => {
            const statusBadge = msg.is_dispatcher
                ? '<span class="badge bg-danger">Dispetcher</span>'
                : msg.is_approved
                ? '<span class="badge bg-success">Approve</span>'
                : '<span class="badge bg-warning">Kutilmoqda</span>';

            const confidence = msg.confidence_score
                ? `<span class="badge bg-info">${(msg.confidence_score * 100).toFixed(0)}%</span>`
                : '-';

            const userGroupCount = msg.user_group_count || '-';

            html += `
                <tr>
                    <td><small>${formatDate(msg.message_date)}</small></td>
                    <td><small>${msg.group_name || 'N/A'}</small></td>
                    <td>
                        <small>${msg.sender_full_name || msg.sender_username || 'N/A'}</small><br>
                        <span class="badge bg-secondary" style="font-size: 0.65rem;">
                            <i class="bi bi-people"></i> ${userGroupCount} guruh
                        </span>
                    </td>
                    <td><small>${truncate(msg.message_text, 80)}</small></td>
                    <td>${statusBadge}</td>
                    <td>${confidence}</td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('Xabarlarni yuklashda xatolik:', error);
        const container = document.getElementById('recentMessagesContainer');
        container.innerHTML = `
            <div class="alert alert-danger">
                Xabarlarni yuklashda xatolik yuz berdi
            </div>
        `;
    }
}

// Check system health
async function checkSystemHealth() {
    try {
        const health = await HealthAPI.check();

        const sessionStatus = document.getElementById('sessionStatus');
        const botStatus = document.getElementById('botStatus');

        if (sessionStatus && health.services.telegram_session) {
            sessionStatus.className = 'badge bg-success';
            sessionStatus.textContent = 'Ulanган';
        } else if (sessionStatus) {
            sessionStatus.className = 'badge bg-danger';
            sessionStatus.textContent = 'Uzilgan';
        }

        if (botStatus && health.services.telegram_bot) {
            botStatus.className = 'badge bg-success';
            botStatus.textContent = 'Ishlamoqda';
        } else if (botStatus) {
            botStatus.className = 'badge bg-danger';
            botStatus.textContent = 'To\'xtatilgan';
        }

    } catch (error) {
        console.error('Health check xatolik:', error);
    }
}

// Auto refresh
function startAutoRefresh() {
    // Refresh every 30 seconds for statistics
    setInterval(() => {
        loadStatistics();
        loadBotOrderStatistics();
        loadRegisteredUsers();
        checkSystemHealth();
    }, 30000);

    // Refresh recent messages less frequently (every 1 minute)
    setInterval(() => {
        loadRecentMessages();
    }, 60000);
}

// Load driver statistics
async function loadDriverStatistics() {
    try {
        const response = await fetch('/api/drivers/statistics', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        });

        if (!response.ok) {
            throw new Error('Haydovchi statistika yuklashda xatolik');
        }

        const data = await response.json();
        const stats = data.data;

        // Update driver statistics
        document.getElementById('blacklistCount').textContent = stats.black_list.total || 0;
        document.getElementById('totalDebt').textContent = (stats.black_list.total_debt || 0).toLocaleString();
        document.getElementById('whitelistCount').textContent = stats.white_list.total || 0;

        const recentTotal = (stats.black_list.recent_30days || 0) + (stats.white_list.recent_30days || 0);
        document.getElementById('recentDrivers').textContent = recentTotal;

    } catch (error) {
        console.error('Haydovchi statistika yuklashda xatolik:', error);
        // Set defaults on error
        document.getElementById('blacklistCount').textContent = '0';
        document.getElementById('totalDebt').textContent = '0';
        document.getElementById('whitelistCount').textContent = '0';
        document.getElementById('recentDrivers').textContent = '0';
    }
}

// Load bot order statistics
async function loadBotOrderStatistics() {
    try {
        const response = await fetch('/api/bot-orders/statistics', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        });

        if (!response.ok) {
            throw new Error('Bot buyurtma statistika yuklashda xatolik');
        }

        const data = await response.json();

        if (data.success && data.statistics) {
            const stats = data.statistics;

            // Update bot order statistics
            const pendingElement = document.getElementById('pendingOrders');
            const groupElement = document.getElementById('groupOrders');

            if (pendingElement) {
                pendingElement.textContent = stats.pending || 0;
            }

            if (groupElement) {
                groupElement.textContent = stats.posted_to_group || 0;
            }
        }

    } catch (error) {
        console.error('Bot buyurtma statistika yuklashda xatolik:', error);
        // Set defaults on error
        const pendingElement = document.getElementById('pendingOrders');
        const groupElement = document.getElementById('groupOrders');

        if (pendingElement) {
            pendingElement.textContent = '0';
        }
        if (groupElement) {
            groupElement.textContent = '0';
        }
    }
}

// Load registered users (for dashboard)
async function loadRegisteredUsers() {
    try {
        const response = await fetch('/api/users/registered', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        });

        if (!response.ok) {
            throw new Error('Ro\'yxatdan o\'tganlar yuklashda xatolik');
        }

        const data = await response.json();
        const users = data.users || [];

        // Update badge count
        const badge = document.getElementById('registeredCountBadge');
        if (badge) {
            badge.textContent = users.length + ' ta';
        }

        const container = document.getElementById('registeredUsersContainer');

        if (users.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                    <p class="mt-2">Hali ro'yxatdan o'tgan user yo'q</p>
                </div>
            `;
            return;
        }

        // Show only last 10 users on dashboard
        const recentUsers = users.slice(0, 10);

        let html = '<div class="table-responsive"><table class="table table-hover">';
        html += `
            <thead>
                <tr>
                    <th>#</th>
                    <th>Ism</th>
                    <th>Telefon</th>
                    <th>Ro'yxatdan o'tgan sana</th>
                </tr>
            </thead>
            <tbody>
        `;

        recentUsers.forEach((u, index) => {
            const name = u.first_name || u.last_name || 'Noma\'lum';
            const phone = u.phone || '-';
            const date = u.registered_at
                ? new Date(u.registered_at).toLocaleString('uz-UZ', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : '-';

            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${escapeHtml(name)}</strong></td>
                    <td><span class="badge bg-success">${escapeHtml(phone)}</span></td>
                    <td><small>${date}</small></td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';

        if (users.length > 10) {
            html += `
                <div class="text-center mt-3">
                    <small class="text-muted">Yana ${users.length - 10} ta user...</small>
                </div>
            `;
        }

        container.innerHTML = html;

    } catch (error) {
        console.error('Ro\'yxatdan o\'tganlar yuklashda xatolik:', error);
        const container = document.getElementById('registeredUsersContainer');
        container.innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle"></i> Yuklashda xatolik yuz berdi
            </div>
        `;
    }
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load daily archive
async function loadDailyArchive() {
    try {
        const response = await apiRequest('/daily-statistics?limit=30');
        const stats = response.statistics;

        const container = document.getElementById('dailyArchiveContainer');

        if (!stats || stats.length === 0) {
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
                    <th>📤 Guruhga yuborilgan</th>
                    <th>🚫 Bloklangan userlar</th>
                    <th>🤖 AI bloklagan</th>
                    <th>📊 Jami e'lonlar</th>
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
                    <td><span class="badge bg-success">${stat.sent_to_group || 0}</span></td>
                    <td><span class="badge bg-danger">${stat.blocked_users || 0}</span></td>
                    <td><span class="badge bg-warning">${stat.auto_blocked_users || 0}</span></td>
                    <td>${stat.total_messages || 0}</td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('Kunlik arxiv yuklashda xatolik:', error);
        const container = document.getElementById('dailyArchiveContainer');
        container.innerHTML = `
            <div class="alert alert-danger">
                Arxiv yuklashda xatolik yuz berdi
            </div>
        `;
    }
}

// ========================================
// AD SCHEDULER FUNCTIONS
// ========================================

/**
 * Load ad scheduler settings and statistics
 */
async function loadAdSchedulerSettings() {
    try {
        const response = await apiRequest('/ad-scheduler/settings');
        const settings = response.settings;

        // Update UI
        document.getElementById('adSchedulerEnabled').checked = settings.enabled;
        document.getElementById('adSchedulerStatusText').textContent = settings.enabled ? 'Yoqilgan' : 'O\'chirilgan';
        document.getElementById('adInterval').value = settings.interval;
        document.getElementById('adMessage').value = settings.message || '';

        // Update statistics
        document.getElementById('adMessageCount').textContent = settings.message_count || 0;
        document.getElementById('adNextIn').textContent = settings.next_ad_in || '-';
        document.getElementById('adTotalSent').textContent = settings.total_ads_sent || 0;

        // Last sent time
        if (settings.last_ad_sent_at) {
            const lastSent = new Date(settings.last_ad_sent_at).toLocaleString('uz-UZ');
            document.getElementById('adLastSent').innerHTML = `<small>${lastSent}</small>`;
        } else {
            document.getElementById('adLastSent').innerHTML = '<small>-</small>';
        }

        // Update preview
        updateAdPreview();

    } catch (error) {
        console.error('Ad scheduler settings yuklashda xatolik:', error);
        showAlert('danger', 'Reklama sozlamalarini yuklashda xatolik');
    }
}

/**
 * Toggle ad scheduler on/off
 */
async function toggleAdScheduler() {
    const enabled = document.getElementById('adSchedulerEnabled').checked;

    try {
        const response = await apiRequest('/ad-scheduler/update', {
            method: 'POST',
            body: JSON.stringify({ enabled })
        });

        if (response.success) {
            document.getElementById('adSchedulerStatusText').textContent = enabled ? 'Yoqilgan' : 'O\'chirilgan';
            showAlert('success', enabled ? '✅ Reklama scheduler yoqildi' : '⚠️ Reklama scheduler o\'chirildi');

            // Reload settings to get updated data
            await loadAdSchedulerSettings();
        } else {
            throw new Error(response.error || 'Noma\'lum xatolik');
        }
    } catch (error) {
        console.error('Toggle ad scheduler error:', error);
        showAlert('danger', 'Xatolik: ' + error.message);

        // Revert checkbox
        document.getElementById('adSchedulerEnabled').checked = !enabled;
    }
}

/**
 * Save ad scheduler settings
 */
async function saveAdSettings() {
    const enabled = document.getElementById('adSchedulerEnabled').checked;
    const interval = parseInt(document.getElementById('adInterval').value);
    const message = document.getElementById('adMessage').value.trim();

    // Validation
    if (interval < 1 || interval > 1000) {
        showAlert('danger', 'Interval 1 dan 1000 gacha bo\'lishi kerak');
        return;
    }

    // Removed strict validation - backend will handle it
    // Just warn user if enabled but no message
    if (enabled && message.length === 0) {
        if (!confirm('Reklama xabari bo\'sh. Davom ettirilsinmi?')) {
            return;
        }
    }

    try {
        const response = await apiRequest('/ad-scheduler/update', {
            method: 'POST',
            body: JSON.stringify({ enabled, interval, message })
        });

        if (response.success) {
            showAlert('success', '✅ Sozlamalar saqlandi');
            await loadAdSchedulerSettings();
        } else {
            throw new Error(response.error || 'Noma\'lum xatolik');
        }
    } catch (error) {
        console.error('Save ad settings error:', error);
        showAlert('danger', 'Xatolik: ' + error.message);
    }
}

/**
 * Send ad manually (test)
 */
async function sendAdNow() {
    // First save the message to ensure backend has it
    const message = document.getElementById('adMessage').value.trim();

    if (message.length === 0) {
        showAlert('danger', 'Iltimos reklama xabarini kiriting');
        return;
    }

    // Save settings first
    const interval = parseInt(document.getElementById('adInterval').value);
    const enabled = document.getElementById('adSchedulerEnabled').checked;

    try {
        // Save message to backend first
        await apiRequest('/ad-scheduler/update', {
            method: 'POST',
            body: JSON.stringify({ enabled, interval, message })
        });

        if (!confirm('Reklama xabarini hoziroq guruhga yuborilsinmi?')) {
            return;
        }

        // Now send the ad
        const response = await apiRequest('/ad-scheduler/send-now', {
            method: 'POST'
        });

        if (response.success) {
            showAlert('success', '✅ Reklama yuborildi!');
            await loadAdSchedulerSettings();
        } else {
            throw new Error(response.error || 'Noma\'lum xatolik');
        }
    } catch (error) {
        console.error('Send ad now error:', error);
        showAlert('danger', 'Xatolik: ' + error.message);
    }
}

/**
 * Reset ad counter
 */
async function resetAdCounter() {
    if (!confirm('Reklama counter reset qilinsinmi? (E\'lonlar soni 0 ga qaytadi)')) {
        return;
    }

    try {
        const response = await apiRequest('/ad-scheduler/reset-counter', {
            method: 'POST'
        });

        if (response.success) {
            showAlert('success', '✅ Counter reset qilindi');
            await loadAdSchedulerSettings();
        } else {
            throw new Error(response.error || 'Noma\'lum xatolik');
        }
    } catch (error) {
        console.error('Reset counter error:', error);
        showAlert('danger', 'Xatolik: ' + error.message);
    }
}

/**
 * Update ad message preview
 */
function updateAdPreview() {
    const message = document.getElementById('adMessage').value.trim();
    const preview = document.getElementById('adMessagePreview');

    if (message.length === 0) {
        preview.innerHTML = '<em class="text-muted">Reklama xabarini kiriting...</em>';
        return;
    }

    // Simple HTML rendering (be careful with XSS in production)
    const formattedMessage = `@Yukchiborbot<br><br>${message.replace(/\n/g, '<br>')}<br><br>@Yukchiborbot`;
    preview.innerHTML = formattedMessage;
}

// Add event listener for message textarea to update preview
document.addEventListener('DOMContentLoaded', () => {
    const adMessageTextarea = document.getElementById('adMessage');
    if (adMessageTextarea) {
        adMessageTextarea.addEventListener('input', updateAdPreview);
    }
});

/**
 * Show alert message
 */
function showAlert(type, message) {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '400px';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(alertDiv);

    // Auto remove after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Load bot orders daily archive
async function loadBotOrdersDailyArchive() {
    try {
        const response = await fetch('/api/bot-orders/daily-stats?limit=30', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        });

        if (!response.ok) {
            throw new Error('Bot buyurtma kunlik arxiv yuklashda xatolik');
        }

        const data = await response.json();
        const stats = data.statistics || [];

        const container = document.getElementById('botOrdersDailyArchive');

        if (!container) {
            return; // Container mavjud bo'lmasa, chiqamiz
        }

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
        console.error('Bot buyurtma kunlik arxiv yuklashda xatolik:', error);
        const container = document.getElementById('botOrdersDailyArchive');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-danger">
                    Arxiv yuklashda xatolik yuz berdi
                </div>
            `;
        }
    }
}

// Initialize
async function initialize() {
    await loadStatistics();
    await loadBotOrderStatistics(); // Load bot order statistics
    await loadRegisteredUsers();
    await loadRecentMessages();
    await checkSystemHealth();
    await loadDailyArchive();
    await loadBotOrdersDailyArchive(); // Load bot orders daily archive
    await loadAdSchedulerSettings(); // Load ad scheduler settings
    startAutoRefresh();
}

// Start
initialize();
