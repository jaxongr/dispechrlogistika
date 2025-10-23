/**
 * Blocked Users Page Logic
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

// Load blocked users (we need to add this API endpoint)
async function loadBlockedUsers() {
    try {
        // For now, show empty state since we need to create the API endpoint
        const container = document.getElementById('blockedUsersContainer');

        // Mock data for demonstration
        const blockedUsers = [];

        if (blockedUsers.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-shield-check" style="font-size: 3rem;"></i>
                    <p class="mt-2">Hozircha bloklangan foydalanuvchilar yo'q</p>
                    <small>Dispetcherlar e'lonlar sahifasidan bloklanadi</small>
                </div>
            `;
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-hover">';
        html += `
            <thead>
                <tr>
                    <th>Telegram ID</th>
                    <th>Username</th>
                    <th>To'liq ism</th>
                    <th>Sabab</th>
                    <th>Bloklangan sana</th>
                    <th>Bloklangan xabarlar</th>
                    <th>Amallar</th>
                </tr>
            </thead>
            <tbody>
        `;

        blockedUsers.forEach(user => {
            html += `
                <tr>
                    <td><code>${user.telegram_user_id}</code></td>
                    <td>@${user.username || 'N/A'}</td>
                    <td>${user.full_name || 'N/A'}</td>
                    <td><small>${user.reason || '-'}</small></td>
                    <td><small>${formatDate(user.blocked_at)}</small></td>
                    <td><span class="badge bg-danger">${user.blocked_message_count || 0}</span></td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="unblockUser(${user.id})">
                            <i class="bi bi-unlock"></i> Blokdan chiqarish
                        </button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('Bloklangan foydalanuvchilarni yuklashda xatolik:', error);
        const container = document.getElementById('blockedUsersContainer');
        container.innerHTML = `
            <div class="alert alert-danger">
                Ma'lumotlarni yuklashda xatolik yuz berdi
            </div>
        `;
    }
}

// Unblock user
async function unblockUser(id) {
    if (!confirm('Bu foydalanuvchini blokdan chiqarishni xohlaysizmi?')) {
        return;
    }

    try {
        // Add API call here when endpoint is created
        alert('Foydalanuvchi blokdan chiqarildi!');
        loadBlockedUsers();
    } catch (error) {
        console.error('Foydalanuvchini blokdan chiqarishda xatolik:', error);
        alert('Xatolik yuz berdi');
    }
}

// Initialize
loadBlockedUsers();
