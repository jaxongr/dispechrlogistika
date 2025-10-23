/**
 * Groups Page Logic
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

// Load groups (we need to add this API endpoint)
async function loadGroups() {
    try {
        // For now, show empty state since we need to create the API endpoint
        const container = document.getElementById('groupsContainer');

        // Mock data for demonstration
        const groups = [];

        if (groups.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-people" style="font-size: 3rem;"></i>
                    <p class="mt-2">Hozircha kuzatilayotgan guruhlar yo'q</p>
                    <small>Guruhlar Telegram session orqali avtomatik qo'shiladi</small>
                </div>
            `;

            // Update statistics
            document.getElementById('totalGroups').textContent = '0';
            document.getElementById('activeGroups').textContent = '0';
            document.getElementById('totalGroupMessages').textContent = '0';
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-hover">';
        html += `
            <thead>
                <tr>
                    <th>Guruh nomi</th>
                    <th>Username</th>
                    <th>Telegram ID</th>
                    <th>Status</th>
                    <th>Jami xabarlar</th>
                    <th>Oxirgi xabar</th>
                    <th>Qo'shilgan sana</th>
                    <th>Amallar</th>
                </tr>
            </thead>
            <tbody>
        `;

        groups.forEach(group => {
            html += `
                <tr>
                    <td><strong>${group.group_name}</strong></td>
                    <td>${group.group_username ? `@${group.group_username}` : '-'}</td>
                    <td><code>${group.group_id}</code></td>
                    <td>
                        ${group.is_active
                            ? '<span class="badge bg-success">Faol</span>'
                            : '<span class="badge bg-secondary">Nofaol</span>'}
                    </td>
                    <td><span class="badge bg-info">${group.total_messages || 0}</span></td>
                    <td><small>${group.last_message_at ? formatDate(group.last_message_at) : '-'}</small></td>
                    <td><small>${formatDate(group.added_at)}</small></td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            ${group.is_active ? `
                                <button class="btn btn-warning" onclick="toggleGroup(${group.id}, false)" title="Nofaol qilish">
                                    <i class="bi bi-pause"></i>
                                </button>
                            ` : `
                                <button class="btn btn-success" onclick="toggleGroup(${group.id}, true)" title="Faollashtirish">
                                    <i class="bi bi-play"></i>
                                </button>
                            `}
                            <button class="btn btn-danger" onclick="deleteGroup(${group.id})" title="O'chirish">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        // Update statistics
        const activeCount = groups.filter(g => g.is_active).length;
        const totalMessages = groups.reduce((sum, g) => sum + (g.total_messages || 0), 0);

        document.getElementById('totalGroups').textContent = groups.length;
        document.getElementById('activeGroups').textContent = activeCount;
        document.getElementById('totalGroupMessages').textContent = totalMessages;

    } catch (error) {
        console.error('Guruhlarni yuklashda xatolik:', error);
        const container = document.getElementById('groupsContainer');
        container.innerHTML = `
            <div class="alert alert-danger">
                Ma'lumotlarni yuklashda xatolik yuz berdi
            </div>
        `;
    }
}

// Toggle group active status
async function toggleGroup(id, isActive) {
    try {
        // Add API call here when endpoint is created
        alert(`Guruh ${isActive ? 'faollashtirildi' : 'nofaol qilindi'}!`);
        loadGroups();
    } catch (error) {
        console.error('Guruh statusini o\'zgartirishda xatolik:', error);
        alert('Xatolik yuz berdi');
    }
}

// Delete group
async function deleteGroup(id) {
    if (!confirm('Bu guruhni o\'chirishni xohlaysizmi? Guruh xabarlari saqlanib qoladi.')) {
        return;
    }

    try {
        // Add API call here when endpoint is created
        alert('Guruh o\'chirildi!');
        loadGroups();
    } catch (error) {
        console.error('Guruhni o\'chirishda xatolik:', error);
        alert('Xatolik yuz berdi');
    }
}

// Initialize
loadGroups();
