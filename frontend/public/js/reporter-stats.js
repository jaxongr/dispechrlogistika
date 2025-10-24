// API base URL
const API_URL = window.location.origin;

// Authentication check
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/login.html';
}

// API request helper
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    });

    if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
        return;
    }

    return response.json();
}

// Load statistics on page load
let allReporters = [];

async function loadStatistics() {
    try {
        // Get statistics
        const statsResponse = await apiRequest('/api/dispatcher-reports/statistics');
        const stats = statsResponse.statistics;

        // Update summary cards
        document.getElementById('totalReports').textContent = stats.total_reports || 0;
        document.getElementById('uniqueReporters').textContent = stats.unique_reporters || 0;

        // Get today's reports
        const todayResponse = await apiRequest('/api/dispatcher-reports/today');
        document.getElementById('todayReports').textContent = todayResponse.count || 0;

        // Store all reporters for search
        allReporters = stats.all_reporters || [];

        // Display top 10
        displayTopReporters(stats.top_reporters || []);

        // Display all reporters
        displayAllReporters(allReporters);

    } catch (error) {
        console.error('Statistika yuklashda xatolik:', error);
        alert('Statistika yuklashda xatolik!');
    }
}

function displayTopReporters(topReporters) {
    const container = document.getElementById('topReportersList');

    if (topReporters.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                <p class="mt-3">Hali hech kim bloklagan emas</p>
            </div>
        `;
        return;
    }

    let html = '';

    topReporters.forEach((reporter, index) => {
        const isTop = index === 0;
        const cardClass = isTop ? 'reporter-card top-reporter' :
                         reporter.total_reports > 10 ? 'reporter-card danger' :
                         reporter.total_reports > 5 ? 'reporter-card warning' :
                         'reporter-card';

        const trophy = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;

        const lastReport = reporter.last_report ?
            new Date(reporter.last_report).toLocaleString('uz-UZ', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Noma\'lum';

        html += `
            <div class="${cardClass}">
                <div class="row align-items-center">
                    <div class="col-auto">
                        <h2 class="mb-0">${trophy}</h2>
                    </div>
                    <div class="col">
                        <h5 class="mb-1">
                            ${reporter.username ? `@${reporter.username}` : reporter.full_name || 'Noma\'lum'}
                        </h5>
                        <p class="mb-0 text-muted">
                            <small>ID: <code>${reporter.user_id}</code></small>
                        </p>
                    </div>
                    <div class="col-auto text-end">
                        <h3 class="mb-0 text-danger">
                            <i class="bi bi-flag-fill"></i>
                            ${reporter.total_reports}
                        </h3>
                        <small class="text-muted">hisobot</small>
                    </div>
                    <div class="col-12 mt-2">
                        <small class="text-muted">
                            <i class="bi bi-clock"></i> Oxirgi: ${lastReport}
                        </small>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function displayAllReporters(reporters) {
    const container = document.getElementById('allReportersList');

    if (reporters.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                <p class="mt-3">Hali hech kim bloklagan emas</p>
            </div>
        `;
        return;
    }

    let html = '<div class="table-responsive"><table class="table table-hover">';
    html += `
        <thead class="table-dark">
            <tr>
                <th>#</th>
                <th>User</th>
                <th>ID</th>
                <th class="text-center">Hisobotlar</th>
                <th>Oxirgi hisobot</th>
            </tr>
        </thead>
        <tbody>
    `;

    reporters.forEach((reporter, index) => {
        const lastReport = reporter.last_report ?
            new Date(reporter.last_report).toLocaleString('uz-UZ', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Noma\'lum';

        const badgeClass = reporter.total_reports > 10 ? 'bg-danger' :
                          reporter.total_reports > 5 ? 'bg-warning text-dark' :
                          'bg-primary';

        html += `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td>
                    ${reporter.username ? `@${reporter.username}` : reporter.full_name || 'Noma\'lum'}
                </td>
                <td><code>${reporter.user_id}</code></td>
                <td class="text-center">
                    <span class="badge ${badgeClass}">
                        ${reporter.total_reports}
                    </span>
                </td>
                <td>
                    <small>${lastReport}</small>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Search functionality
document.getElementById('searchReporter').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();

    if (searchTerm === '') {
        displayAllReporters(allReporters);
        return;
    }

    const filtered = allReporters.filter(reporter => {
        const username = (reporter.username || '').toLowerCase();
        const fullName = (reporter.full_name || '').toLowerCase();
        const userId = reporter.user_id.toString();

        return username.includes(searchTerm) ||
               fullName.includes(searchTerm) ||
               userId.includes(searchTerm);
    });

    displayAllReporters(filtered);
});

// Load on page ready
document.addEventListener('DOMContentLoaded', loadStatistics);

// Refresh every 30 seconds
setInterval(loadStatistics, 30000);
