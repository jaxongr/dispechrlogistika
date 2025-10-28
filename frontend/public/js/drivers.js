/**
 * Drivers Page Logic
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
let currentFilter = 'black'; // 'all', 'black', 'white'
let allDrivers = [];

// Load statistics
async function loadStatistics() {
    try {
        const response = await fetch('/api/drivers/statistics', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        });

        if (!response.ok) throw new Error('Failed to load statistics');

        const data = await response.json();
        const stats = data.data;

        document.getElementById('blacklistTotal').textContent = stats.black_list.total || 0;
        document.getElementById('whitelistTotal').textContent = stats.white_list.total || 0;
        document.getElementById('totalDebt').textContent = (stats.black_list.total_debt || 0).toLocaleString();

        const recentTotal = (stats.black_list.recent_30days || 0) + (stats.white_list.recent_30days || 0);
        document.getElementById('recentDrivers').textContent = recentTotal;

    } catch (error) {
        console.error('Statistics error:', error);
    }
}

// Load drivers
async function loadDrivers(listType = null) {
    try {
        const url = listType ? `/api/drivers?list_type=${listType}&limit=100` : '/api/drivers?limit=100';

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        });

        if (!response.ok) throw new Error('Failed to load drivers');

        const data = await response.json();
        allDrivers = data.data || [];

        displayDrivers(allDrivers);

    } catch (error) {
        console.error('Load drivers error:', error);
        document.getElementById('driversContainer').innerHTML = `
            <div class="alert alert-danger">
                Haydovchilarni yuklashda xatolik yuz berdi
            </div>
        `;
    }
}

// Display drivers
function displayDrivers(drivers) {
    const container = document.getElementById('driversContainer');
    document.getElementById('totalCount').textContent = `${drivers.length} ta`;

    if (drivers.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                <p class="mt-2">Haydovchilar topilmadi</p>
            </div>
        `;
        return;
    }

    let html = '<div class="table-responsive"><table class="table table-hover">';
    html += `
        <thead>
            <tr>
                <th>Ro'yxat</th>
                <th>Telefon</th>
                <th>Mashina</th>
                <th>Rang</th>
                <th>Davlat raqam</th>
                <th>Qarz</th>
                <th>Sana</th>
                <th>Qo'shgan</th>
            </tr>
        </thead>
        <tbody>
    `;

    drivers.forEach(driver => {
        const listBadge = driver.list_type === 'black'
            ? '<span class="badge bg-dark">Qora ro\'yxat</span>'
            : '<span class="badge bg-info">Oq ro\'yxat</span>';

        const debt = driver.total_debt ? `${driver.total_debt.toLocaleString()} so'm` : '-';
        const date = new Date(driver.created_at).toLocaleDateString('uz-UZ');

        html += `
            <tr onclick="showDriverDetails('${driver.phone}')" style="cursor: pointer;">
                <td>${listBadge}</td>
                <td><strong>${driver.phone}</strong></td>
                <td>${driver.truck.type || '-'}</td>
                <td>${driver.truck.color || '-'}</td>
                <td>${driver.truck.plate || '-'}</td>
                <td>${debt}</td>
                <td><small>${date}</small></td>
                <td><small>${driver.added_by.name}</small></td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Search driver
async function searchDriver(phone) {
    try {
        const response = await fetch(`/api/drivers/search/${encodeURIComponent(phone)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('token')
            }
        });

        const resultDiv = document.getElementById('searchResult');

        if (response.status === 404) {
            resultDiv.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle"></i> Haydovchi topilmadi: ${phone}
                </div>
            `;
            return;
        }

        if (!response.ok) throw new Error('Search failed');

        const data = await response.json();
        const driver = data.data;

        // Necha marta qo'shilganini hisoblash
        const blackCount = driver.history.filter(h => h.list_type === 'black').length;
        const whiteCount = driver.history.filter(h => h.list_type === 'white').length;

        let html = `<div class="card">`;

        // Agar ikkalasida ham bo'lsa
        if (driver.list_type === 'both') {
            html += `
                <div class="card-header bg-secondary text-white">
                    <h5>⚫⚪ IKKI RO'YXATDA HAM BOR</h5>
                </div>
                <div class="card-body">
                    <p><strong>📱 Telefon:</strong> ${driver.phone}</p>
                    <hr>
            `;

            // Qora ro'yxat
            if (driver.black_list_info) {
                html += `
                    <div class="alert alert-dark">
                        <h6>⚫ QORA RO'YXAT: ${blackCount} marta qo'shilgan</h6>
                        <p><strong>🚗 Mashina:</strong> ${driver.black_list_info.truck.type || '?'}</p>
                        <p><strong>💰 Qarz:</strong> ${driver.black_list_info.total_debt.toLocaleString()} so'm</p>
                        <p><strong>👤 Qo'shgan:</strong> ${driver.black_list_info.added_by}</p>
                    </div>
                `;
            }

            // Oq ro'yxat
            if (driver.white_list_info) {
                html += `
                    <div class="alert alert-info">
                        <h6>⚪ OQ RO'YXAT: ${whiteCount} marta qo'shilgan</h6>
                        <p><strong>🚗 Mashina:</strong> ${driver.white_list_info.truck.type || '?'}</p>
                        <p><strong>⭐ Reyting:</strong> ${driver.white_list_info.rating}/5</p>
                        <p><strong>👤 Qo'shgan:</strong> ${driver.white_list_info.added_by}</p>
                    </div>
                `;
            }
        } else {
            // Faqat bitta ro'yxatda
            const listIcon = driver.list_type === 'black' ? '⚫' : '⚪';
            const listName = driver.list_type === 'black' ? 'QORA RO\'YXAT' : 'OQ RO\'YXAT';
            const info = driver.list_type === 'black' ? driver.black_list_info : driver.white_list_info;
            const count = driver.list_type === 'black' ? blackCount : whiteCount;

            html += `
                <div class="card-header ${driver.list_type === 'black' ? 'bg-dark text-white' : 'bg-info text-white'}">
                    <h5>${listIcon} ${listName}: ${count} marta qo'shilgan</h5>
                </div>
                <div class="card-body">
                    <p><strong>📱 Telefon:</strong> ${driver.phone}</p>
            `;

            if (info) {
                html += `<p><strong>🚗 Mashina:</strong> ${info.truck.type || '?'}</p>`;
                if (driver.list_type === 'black' && info.total_debt > 0) {
                    html += `<p><strong>💰 Qarz:</strong> ${info.total_debt.toLocaleString()} so'm</p>`;
                }
                html += `<p><strong>👤 Qo'shgan:</strong> ${info.added_by}</p>`;
            }
        }

        html += `<hr><h6>📝 TARIXLAR (${driver.total_records} ta):</h6>`;

        driver.history.slice(0, 5).forEach(h => {
            const date = new Date(h.date).toLocaleString('uz-UZ');
            const typeIcon = h.list_type === 'black' ? '⚫' : '⚪';
            const typeBadge = h.list_type === 'black'
                ? '<span class="badge bg-dark">Qora ro\'yxat</span>'
                : '<span class="badge bg-info">Oq ro\'yxat</span>';

            html += `
                <div class="border-bottom pb-2 mb-2">
                    <small class="text-muted">${typeIcon} 📅 ${date}</small> ${typeBadge}<br>
                    <strong>👤 ${h.dispatcher_name}</strong><br>
            `;
            if (h.route) html += `📍 ${h.route}<br>`;
            if (h.debt) html += `💰 ${h.debt.toLocaleString()} so'm<br>`;
            if (h.reason) html += `⚠️ ${h.reason}<br>`;
            if (h.note) html += `📝 ${h.note}<br>`;
            html += `</div>`;
        });

        if (driver.total_records > 5) {
            html += `<p class="text-muted">... va yana ${driver.total_records - 5} ta qayd</p>`;
        }

        html += '</div></div>';
        resultDiv.innerHTML = html;

    } catch (error) {
        console.error('Search error:', error);
        document.getElementById('searchResult').innerHTML = `
            <div class="alert alert-danger">
                Qidirishda xatolik yuz berdi
            </div>
        `;
    }
}

// Show driver details (when clicking on row)
function showDriverDetails(phone) {
    document.getElementById('searchPhone').value = phone;
    searchDriver(phone);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Filter handlers
document.getElementById('filterAll').addEventListener('click', () => {
    currentFilter = 'all';
    document.querySelectorAll('.btn-group button').forEach(btn => btn.classList.remove('active'));
    document.getElementById('filterAll').classList.add('active');
    loadDrivers();
});

document.getElementById('filterBlack').addEventListener('click', () => {
    currentFilter = 'black';
    document.querySelectorAll('.btn-group button').forEach(btn => btn.classList.remove('active'));
    document.getElementById('filterBlack').classList.add('active');
    loadDrivers('black');
});

document.getElementById('filterWhite').addEventListener('click', () => {
    currentFilter = 'white';
    document.querySelectorAll('.btn-group button').forEach(btn => btn.classList.remove('active'));
    document.getElementById('filterWhite').classList.add('active');
    loadDrivers('white');
});

// Search handler
document.getElementById('searchBtn').addEventListener('click', () => {
    const phone = document.getElementById('searchPhone').value.trim();
    if (phone) {
        searchDriver(phone);
    }
});

document.getElementById('searchPhone').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const phone = document.getElementById('searchPhone').value.trim();
        if (phone) {
            searchDriver(phone);
        }
    }
});

// Initialize
async function initialize() {
    await loadStatistics();
    await loadDrivers('black'); // Default: show black list
}

initialize();
