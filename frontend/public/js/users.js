/**
 * Users Page Logic - Foydalanuvchilar sahifasi
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
        const response = await fetch('/api/statistics/bot-stats', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        });

        if (!response.ok) {
            throw new Error('Statistika yuklashda xatolik');
        }

        const data = await response.json();
        console.log('📊 Bot stats:', data);

        // Statistics
        document.getElementById('totalBotUsers').textContent = data.bot_users.total || 0;
        document.getElementById('registeredUsers').textContent = data.bot_users.registered || 0;
        document.getElementById('registeredToday').textContent = data.bot_users.registered_today || 0;
        document.getElementById('olindiUsers').textContent = data.olindi_users.total || 0;

    } catch (error) {
        console.error('Statistika yuklashda xatolik:', error);
        showAlert('danger', 'Statistika yuklashda xatolik: ' + error.message);
    }
}

// Load users list
async function loadUsers() {
    try {
        const response = await fetch('/api/users/registered', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        });

        if (!response.ok) {
            throw new Error('Foydalanuvchilar yuklashda xatolik');
        }

        const data = await response.json();
        console.log('👥 Registered users:', data);

        displayUsers(data.users || []);

    } catch (error) {
        console.error('Foydalanuvchilar yuklashda xatolik:', error);
        document.getElementById('usersContainer').innerHTML = `
            <div class="alert alert-danger">
                Foydalanuvchilarni yuklashda xatolik: ${error.message}
            </div>
        `;
    }
}

// Display users
function displayUsers(users) {
    const container = document.getElementById('usersContainer');

    if (users.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                <p class="mt-2">Hali ro'yxatdan o'tgan foydalanuvchi yo'q</p>
            </div>
        `;
        return;
    }

    let html = '<div class="table-responsive"><table class="table table-hover">';
    html += `
        <thead>
            <tr>
                <th>#</th>
                <th>Ism</th>
                <th>Username</th>
                <th>Telefon</th>
                <th>Ro'yxatdan o'tgan sana</th>
                <th>Telegram ID</th>
            </tr>
        </thead>
        <tbody>
    `;

    users.forEach((u, index) => {
        const name = u.first_name || u.last_name || 'Noma\'lum';
        const username = u.username ? '@' + u.username : '-';
        const phone = u.phone || '-';
        const date = u.registered_at
            ? new Date(u.registered_at).toLocaleString('uz-UZ', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : '-';

        html += `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${escapeHtml(name)}</strong></td>
                <td><small class="text-muted">${escapeHtml(username)}</small></td>
                <td><span class="badge bg-success">${escapeHtml(phone)}</span></td>
                <td><small>${date}</small></td>
                <td><code>${u.telegram_user_id}</code></td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Show alert
function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.container-fluid').prepend(alertDiv);
    setTimeout(() => alertDiv.remove(), 5000);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Send reminder to unregistered users
async function sendReminderToUnregistered() {
    const btn = document.getElementById('sendReminderBtn');

    if (!confirm('Telefon bermagan barcha userlarga eslatma xabar yuborilsinmi?\n\nBu jarayon bir necha daqiqa davom etishi mumkin.')) {
        return;
    }

    try {
        // Disable button
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Yuborilmoqda...';

        const response = await fetch('/api/users/send-reminder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || data.message || 'Xabar yuborishda xatolik');
        }

        // Show success message with details
        const message = `✅ Eslatma yuborildi!\n\n` +
            `📤 Yuborildi: ${data.sent} ta\n` +
            `❌ Xatolik: ${data.failed} ta\n` +
            `📊 Jami: ${data.total} ta user`;

        showAlert('success', message.replace(/\n/g, '<br>'));

        console.log('📊 Reminder results:', data);

    } catch (error) {
        console.error('Send reminder error:', error);
        showAlert('danger', '❌ Xatolik: ' + error.message);
    } finally {
        // Re-enable button
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-bell"></i> Telefon bermaganlarga eslatma yuborish';
    }
}

// Initialize
async function initialize() {
    await loadStatistics();
    await loadUsers();
}

// Start
initialize();
