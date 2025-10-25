/**
 * Auto-Reply Settings Page Logic
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

// Load settings and statistics
async function loadSettings() {
    try {
        const response = await apiRequest('/auto-reply/settings');
        const settings = response.settings;

        document.getElementById('autoReplyEnabled').checked = settings.enabled || false;
        document.getElementById('checkTargetGroup').checked = settings.check_target_group !== false;
        document.getElementById('maxRepliesPerMinute').value = settings.max_replies_per_minute || 20;
        document.getElementById('maxRepliesPerHour').value = settings.max_replies_per_hour || 50;
        document.getElementById('cooldownHours').value = settings.cooldown_hours || 1;
        document.getElementById('messageTemplate').value = settings.template || '';

        // Load statistics
        await loadStatistics();

        // Load history
        await loadHistory();

    } catch (error) {
        console.error('Sozlamalarni yuklashda xatolik:', error);
        showAlert('Sozlamalarni yuklashda xatolik', 'danger');
    }
}

// Load statistics
async function loadStatistics() {
    try {
        const response = await apiRequest('/auto-reply/statistics');
        const stats = response.statistics;

        document.getElementById('totalReplies').textContent = stats.total_replies || 0;
        document.getElementById('repliesLastHour').textContent = stats.replies_last_hour || 0;
        document.getElementById('uniqueUsers').textContent = stats.unique_users || 0;
        document.getElementById('uniqueGroups').textContent = stats.unique_groups || 0;

    } catch (error) {
        console.error('Statistika yuklashda xatolik:', error);
    }
}

// Load history
async function loadHistory() {
    try {
        const response = await apiRequest('/auto-reply/history?limit=50');
        const history = response.history;

        const container = document.getElementById('historyContainer');

        if (history.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                    <p class="mt-2">Hali javob yuborilmagan</p>
                </div>
            `;
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-hover">';
        html += `
            <thead>
                <tr>
                    <th>Vaqt</th>
                    <th>User</th>
                    <th>Guruh</th>
                    <th>Message ID</th>
                    <th>Reply ID</th>
                </tr>
            </thead>
            <tbody>
        `;

        history.forEach(item => {
            const date = new Date(item.replied_at).toLocaleString('uz-UZ', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            html += `
                <tr>
                    <td><small>${date}</small></td>
                    <td><strong>${item.username || item.user_id}</strong></td>
                    <td><small>${truncate(item.group_name, 30)}</small></td>
                    <td><small class="text-muted">${item.message_id}</small></td>
                    <td><small class="text-muted">${item.reply_message_id}</small></td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('Tarixni yuklashda xatolik:', error);
        document.getElementById('historyContainer').innerHTML =
            '<div class="alert alert-danger">Tarixni yuklashda xatolik</div>';
    }
}

// Save settings
document.getElementById('saveSettings').addEventListener('click', async () => {
    try {
        const settings = {
            enabled: document.getElementById('autoReplyEnabled').checked,
            template: document.getElementById('messageTemplate').value,
            check_target_group: document.getElementById('checkTargetGroup').checked,
            max_replies_per_minute: parseInt(document.getElementById('maxRepliesPerMinute').value),
            max_replies_per_hour: parseInt(document.getElementById('maxRepliesPerHour').value),
            cooldown_hours: parseFloat(document.getElementById('cooldownHours').value)
        };

        if (settings.enabled && !settings.template) {
            showAlert('Xabar shabloni kiritilmagan!', 'warning');
            return;
        }

        if (settings.max_replies_per_minute < 1 || settings.max_replies_per_minute > 100) {
            showAlert('Minutlik limit 1-100 orasida bo\'lishi kerak!', 'warning');
            return;
        }

        if (settings.max_replies_per_hour < 1 || settings.max_replies_per_hour > 1000) {
            showAlert('Soatlik limit 1-1000 orasida bo\'lishi kerak!', 'warning');
            return;
        }

        if (settings.cooldown_hours < 0.1 || settings.cooldown_hours > 24) {
            showAlert('Cooldown 0.1-24 soat orasida bo\'lishi kerak!', 'warning');
            return;
        }

        const btn = document.getElementById('saveSettings');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saqlanmoqda...';

        await apiRequest('/auto-reply/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });

        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-save"></i> Sozlamalarni Saqlash';

        showAlert('✅ Sozlamalar saqlandi!', 'success');

    } catch (error) {
        console.error('Sozlamalarni saqlashda xatolik:', error);
        showAlert('❌ Sozlamalarni saqlashda xatolik', 'danger');

        const btn = document.getElementById('saveSettings');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-save"></i> Sozlamalarni Saqlash';
    }
});

// Helper function to show alerts
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 4000);
}

// Initialize
loadSettings();

// Auto-refresh statistics every 30 seconds
setInterval(() => {
    loadStatistics();
    loadHistory();
}, 30000);
