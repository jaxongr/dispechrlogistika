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
        document.getElementById('approvedMessages').textContent = stats.approved_messages || 0;
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

    } catch (error) {
        console.error('Statistika yuklashda xatolik:', error);
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
        checkSystemHealth();
    }, 30000);

    // Refresh recent messages less frequently (every 1 minute)
    setInterval(() => {
        loadRecentMessages();
    }, 60000);
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

// Initialize
async function initialize() {
    await loadStatistics();
    await loadRecentMessages();
    await checkSystemHealth();
    await loadDailyArchive();
    startAutoRefresh();
}

// Start
initialize();
