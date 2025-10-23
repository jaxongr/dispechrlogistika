/**
 * Phone Numbers Page Logic
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

// State
let allPhones = [];
let filteredPhones = [];

// Load phone numbers
async function loadPhoneNumbers() {
    try {
        const response = await fetch('/api/messages/phone-numbers', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch phone numbers');
        }

        const data = await response.json();
        allPhones = data.phones || [];
        filteredPhones = allPhones;

        updateStats();
        renderPhones();

    } catch (error) {
        console.error('Telefon raqamlarni yuklashda xatolik:', error);
        const container = document.getElementById('phonesContainer');
        container.innerHTML = `
            <div class="alert alert-danger">
                Telefon raqamlarni yuklashda xatolik yuz berdi
            </div>
        `;
    }
}

// Update statistics
function updateStats() {
    const total = allPhones.length;
    const approved = allPhones.filter(p => p.is_approved).length;
    const pending = allPhones.filter(p => !p.is_approved && !p.is_dispatcher).length;

    document.getElementById('totalPhones').textContent = total;
    document.getElementById('approvedPhones').textContent = approved;
    document.getElementById('pendingPhones').textContent = pending;
}

// Render phones table
function renderPhones() {
    const container = document.getElementById('phonesContainer');

    if (filteredPhones.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-telephone-x" style="font-size: 3rem;"></i>
                <p class="mt-2">Telefon raqamlar topilmadi</p>
            </div>
        `;
        return;
    }

    let html = '<div class="table-responsive"><table class="table table-hover table-sm">';
    html += `
        <thead>
            <tr>
                <th style="width: 150px;">Telefon</th>
                <th>Yuboruvchi</th>
                <th>Guruh</th>
                <th>Yo'nalish</th>
                <th>Yuk turi</th>
                <th style="width: 150px;">Sana</th>
                <th style="width: 100px;">Status</th>
            </tr>
        </thead>
        <tbody>
    `;

    filteredPhones.forEach(phone => {
        const statusBadge = phone.is_dispatcher
            ? '<span class="badge bg-danger">Dispetcher</span>'
            : phone.is_approved
            ? '<span class="badge bg-success">Tasdiqlangan</span>'
            : '<span class="badge bg-warning text-dark">Kutilmoqda</span>';

        const route = phone.route_from && phone.route_to
            ? `${phone.route_from} → ${phone.route_to}`
            : '-';

        html += `
            <tr>
                <td><strong>${phone.phone}</strong></td>
                <td><small>${phone.sender}</small></td>
                <td><small>${phone.group}</small></td>
                <td><small>${route}</small></td>
                <td><small>${phone.cargo_type || '-'}</small></td>
                <td><small>${formatDate(phone.date)}</small></td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Apply filters
document.getElementById('applyFilters').addEventListener('click', () => {
    const status = document.getElementById('filterStatus').value;
    const search = document.getElementById('searchInput').value.toLowerCase();

    filteredPhones = allPhones.filter(phone => {
        // Status filter
        if (status === 'approved' && !phone.is_approved) return false;
        if (status === 'pending' && (phone.is_approved || phone.is_dispatcher)) return false;

        // Search filter
        if (search && !phone.phone.toLowerCase().includes(search)) return false;

        return true;
    });

    renderPhones();
});

// Export to TXT
document.getElementById('exportTxtBtn').addEventListener('click', () => {
    if (filteredPhones.length === 0) {
        alert('Hech qanday telefon raqam yo\'q!');
        return;
    }

    // Get unique phone numbers only
    const uniquePhones = [...new Set(filteredPhones.map(p => p.phone))];
    const txtContent = uniquePhones.join('\n');

    const blob = new Blob([txtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telefon_raqamlar_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`${uniquePhones.length}ta telefon raqam ko'chirib olindi!`);
});

// Export to CSV
document.getElementById('exportCsvBtn').addEventListener('click', () => {
    if (filteredPhones.length === 0) {
        alert('Hech qanday telefon raqam yo\'q!');
        return;
    }

    // CSV header
    let csvContent = 'Telefon,Yuboruvchi,Guruh,Yo\'nalish (from),Yo\'nalish (to),Yuk turi,Sana,Status\n';

    filteredPhones.forEach(phone => {
        const status = phone.is_dispatcher ? 'Dispetcher'
            : phone.is_approved ? 'Tasdiqlangan'
            : 'Kutilmoqda';

        const row = [
            phone.phone,
            phone.sender.replace(/,/g, ' '),
            phone.group.replace(/,/g, ' '),
            phone.route_from || '-',
            phone.route_to || '-',
            phone.cargo_type || '-',
            new Date(phone.date).toLocaleDateString('uz-UZ'),
            status
        ].join(',');

        csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telefon_raqamlar_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`${filteredPhones.length}ta ma'lumot CSV formatda ko'chirib olindi!`);
});

// Initialize
loadPhoneNumbers();
