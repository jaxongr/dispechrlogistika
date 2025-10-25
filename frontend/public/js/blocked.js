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

// Load blocked users
async function loadBlockedUsers() {
    try {
        const container = document.getElementById('blockedUsersContainer');

        // Fetch blocked users from API
        const response = await fetch('/api/blocked-users', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch blocked users');
        }

        const data = await response.json();
        const blockedUsers = data.blocked_users || [];

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

        let html = '<div class="table-responsive"><table class="table table-hover table-striped">';
        html += `
            <thead class="table-dark">
                <tr>
                    <th>Telegram ID</th>
                    <th>Username</th>
                    <th>To'liq ism</th>
                    <th>🚫 Bloklash sababi</th>
                    <th>Guruhlar</th>
                    <th>📅 Qachon bloklangan</th>
                    <th>Bloklangan xabarlar</th>
                    <th>Amallar</th>
                </tr>
            </thead>
            <tbody>
        `;

        blockedUsers.forEach(user => {
            // Format reason with color
            let reasonBadge = '';
            const reason = user.reason || 'Noma\'lum sabab';

            if (reason.includes('15+ guruhda') || reason.includes('50+ guruhda')) {
                reasonBadge = `<span class="badge bg-danger">${reason}</span>`;
            } else if (reason.includes('200+ belgi') || reason.includes('spam')) {
                reasonBadge = `<span class="badge bg-warning text-dark">${reason}</span>`;
            } else if (reason.includes('AI')) {
                reasonBadge = `<span class="badge bg-info">${reason}</span>`;
            } else if (reason.includes('admin') || reason.includes('manual')) {
                reasonBadge = `<span class="badge bg-secondary">${reason}</span>`;
            } else {
                reasonBadge = `<span class="badge bg-primary">${reason}</span>`;
            }

            html += `
                <tr>
                    <td><code>${user.telegram_user_id}</code></td>
                    <td>@${user.username || 'N/A'}</td>
                    <td>${user.full_name || 'N/A'}</td>
                    <td>${reasonBadge}</td>
                    <td>
                        <span class="badge bg-primary">
                            <i class="bi bi-people"></i> ${user.group_count || 0} ta
                        </span>
                    </td>
                    <td>
                        <i class="bi bi-calendar-x text-danger"></i>
                        <strong>${formatDate(user.blocked_at)}</strong>
                    </td>
                    <td><span class="badge bg-danger">${user.blocked_message_count || 0}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger" onclick="unblockUser('${user.telegram_user_id}')">
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
async function unblockUser(telegram_user_id) {
    if (!confirm('Bu foydalanuvchini blokdan chiqarishni xohlaysizmi?')) {
        return;
    }

    try {
        const response = await fetch(`/api/blocked-users/${telegram_user_id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to unblock user');
        }

        alert('Foydalanuvchi blokdan chiqarildi!');
        loadBlockedUsers();
    } catch (error) {
        console.error('Foydalanuvchini blokdan chiqarishda xatolik:', error);
        alert('Xatolik yuz berdi');
    }
}

// Export phone numbers to TXT file
async function exportToTxt() {
    try {
        const response = await fetch('/api/messages/blocked-users', {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch blocked users');
        }

        const data = await response.json();

        if (!data.blockedUsers || data.blockedUsers.length === 0) {
            alert('Bloklangan foydalanuvchilar yo\'q!');
            return;
        }

        // Extract phone numbers from usernames and full names
        let phoneNumbers = [];

        data.blockedUsers.forEach(user => {
            // Try to extract from username
            const usernameMatch = user.username?.match(/\+?\d{7,15}/);
            if (usernameMatch) {
                phoneNumbers.push(usernameMatch[0]);
            }

            // Try to extract from full_name
            const nameMatch = user.full_name?.match(/\+?\d{7,15}/);
            if (nameMatch && !phoneNumbers.includes(nameMatch[0])) {
                phoneNumbers.push(nameMatch[0]);
            }

            // Add telegram_user_id as fallback
            if (!usernameMatch && !nameMatch) {
                phoneNumbers.push(`ID: ${user.telegram_user_id}`);
            }
        });

        // Create text content
        const textContent = phoneNumbers.join('\n');

        // Create and download file
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bloklangan_tel_raqamlar_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`✅ ${phoneNumbers.length} ta telefon raqam yuklandi!`);
    } catch (error) {
        console.error('Export xatolik:', error);
        alert('Xatolik yuz berdi!');
    }
}

// Initialize
loadBlockedUsers();
