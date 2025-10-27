/**
 * Group Statistics Page JavaScript
 */

const API_BASE = window.location.origin + '/api';
let token = localStorage.getItem('token');

// Check auth
if (!token) {
    window.location.href = '/login.html';
}

// Load data on page load
document.addEventListener('DOMContentLoaded', () => {
    loadGroupStats();
    loadDailyStats();
    loadTopGroups();

    // Setup date range filter
    setupDateRangeFilter();
});

/**
 * Load group statistics
 */
async function loadGroupStats() {
    try {
        const startDate = document.getElementById('startDate')?.value || new Date().toISOString().split('T')[0];
        const endDate = document.getElementById('endDate')?.value || new Date().toISOString().split('T')[0];

        const response = await fetch(`${API_BASE}/group-stats/summary?startDate=${startDate}&endDate=${endDate}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load group stats');

        const data = await response.json();
        displayGroupStats(data);
    } catch (error) {
        console.error('Error loading group stats:', error);
        showError('Guruh statistikasini yuklab bo\'lmadi');
    }
}

/**
 * Display group statistics
 */
function displayGroupStats(data) {
    // Display summary
    if (data.summary) {
        document.getElementById('totalGroups').textContent = data.summary.total_groups || 0;
        document.getElementById('totalMessages').textContent = data.summary.total_messages || 0;
        document.getElementById('totalSentToChannel').textContent = data.summary.total_sent_to_channel || 0;
        document.getElementById('totalAutoBlocked').textContent = data.summary.total_auto_blocked || 0;
        document.getElementById('totalManualBlocked').textContent = data.summary.total_manual_blocked || 0;
        document.getElementById('totalBlocked').textContent = data.summary.total_blocked || 0;
    }

    // Display groups table
    const container = document.getElementById('groupStatsTable');
    if (!container || !data.groups) return;

    let html = '<div class="table-responsive"><table class="table table-striped table-hover">';
    html += '<thead><tr>';
    html += '<th>#</th>';
    html += '<th>Guruh nomi</th>';
    html += '<th>Jami e\'lonlar</th>';
    html += '<th>Guruhga yuborilgan</th>';
    html += '<th>Avto-blok</th>';
    html += '<th>Qo\'lda blok</th>';
    html += '<th>Jami blok</th>';
    html += '</tr></thead><tbody>';

    data.groups.forEach((group, index) => {
        html += '<tr>';
        html += `<td>${index + 1}</td>`;
        html += `<td><strong>${escapeHtml(group.group_name)}</strong><br><small class="text-muted">@${group.group_username || 'N/A'}</small></td>`;
        html += `<td><span class="badge bg-primary">${group.total_messages}</span></td>`;
        html += `<td><span class="badge bg-success">${group.sent_to_channel}</span></td>`;
        html += `<td><span class="badge bg-warning">${group.auto_blocked}</span></td>`;
        html += `<td><span class="badge bg-danger">${group.manual_blocked}</span></td>`;
        html += `<td><span class="badge bg-dark">${group.total_blocked}</span></td>`;
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

/**
 * Load daily statistics
 */
async function loadDailyStats() {
    try {
        const days = document.getElementById('daysRange')?.value || 7;

        const response = await fetch(`${API_BASE}/group-stats/daily?days=${days}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load daily stats');

        const data = await response.json();
        displayDailyStats(data);
    } catch (error) {
        console.error('Error loading daily stats:', error);
        showError('Kunlik statistikani yuklab bo\'lmadi');
    }
}

/**
 * Display daily statistics
 */
function displayDailyStats(data) {
    const container = document.getElementById('dailyStatsTable');
    if (!container || !data.daily) return;

    let html = '<div class="table-responsive"><table class="table table-sm">';
    html += '<thead><tr>';
    html += '<th>Sana</th>';
    html += '<th>Jami</th>';
    html += '<th>Yuborilgan</th>';
    html += '<th>Avto-blok</th>';
    html += '<th>Qo\'lda blok</th>';
    html += '<th>Jami blok</th>';
    html += '</tr></thead><tbody>';

    data.daily.reverse().forEach(day => {
        html += '<tr>';
        html += `<td><strong>${day.date}</strong></td>`;
        html += `<td>${day.total_messages}</td>`;
        html += `<td><span class="badge bg-success">${day.sent_to_channel}</span></td>`;
        html += `<td><span class="badge bg-warning">${day.auto_blocked}</span></td>`;
        html += `<td><span class="badge bg-danger">${day.manual_blocked}</span></td>`;
        html += `<td><span class="badge bg-dark">${day.total_blocked}</span></td>`;
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

/**
 * Load top groups
 */
async function loadTopGroups() {
    try {
        const period = document.getElementById('topPeriod')?.value || 'today';
        const limit = document.getElementById('topLimit')?.value || 10;

        const response = await fetch(`${API_BASE}/group-stats/top-groups?period=${period}&limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load top groups');

        const data = await response.json();
        displayTopGroups(data);
    } catch (error) {
        console.error('Error loading top groups:', error);
        showError('Top guruhlarni yuklab bo\'lmadi');
    }
}

/**
 * Display top groups
 */
function displayTopGroups(data) {
    const container = document.getElementById('topGroupsList');
    if (!container || !data.top_groups) return;

    let html = '<div class="list-group">';

    data.top_groups.forEach((group, index) => {
        const percentage = group.sent_to_channel > 0 ? Math.round((group.sent_to_channel / group.total_messages) * 100) : 0;

        html += '<div class="list-group-item">';
        html += '<div class="d-flex w-100 justify-content-between">';
        html += `<h6 class="mb-1">${index + 1}. ${escapeHtml(group.group_name)}</h6>`;
        html += `<span class="badge bg-primary rounded-pill">${group.total_messages}</span>`;
        html += '</div>';
        html += `<small class="text-muted">@${group.group_username || 'N/A'}</small>`;
        html += '<div class="mt-2">';
        html += `<small>Guruhga yuborilgan: <strong>${group.sent_to_channel}</strong> (${percentage}%)</small>`;
        html += '</div>';
        html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
}

/**
 * Setup date range filter
 */
function setupDateRangeFilter() {
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    const applyFilter = document.getElementById('applyFilter');

    if (startDate && endDate) {
        // Set default dates (last 7 days to today)
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        startDate.value = sevenDaysAgo.toISOString().split('T')[0];
        endDate.value = today.toISOString().split('T')[0];
    }

    if (applyFilter) {
        applyFilter.addEventListener('click', () => {
            loadGroupStats();
        });
    }

    // Days range filter
    const daysRange = document.getElementById('daysRange');
    const applyDaysFilter = document.getElementById('applyDaysFilter');

    if (applyDaysFilter) {
        applyDaysFilter.addEventListener('click', () => {
            loadDailyStats();
        });
    }

    // Top groups filter
    const topPeriod = document.getElementById('topPeriod');
    const topLimit = document.getElementById('topLimit');
    const applyTopFilter = document.getElementById('applyTopFilter');

    if (applyTopFilter) {
        applyTopFilter.addEventListener('click', () => {
            loadTopGroups();
        });
    }
}

/**
 * Show error message
 */
function showError(message) {
    alert(message);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
});

// Display username
const username = localStorage.getItem('username');
if (username) {
    document.getElementById('username').textContent = username;
}
