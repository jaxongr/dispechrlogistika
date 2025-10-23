/**
 * Settings Page Logic
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

// Load settings from localStorage
function loadSettings() {
    const autoSend = localStorage.getItem('autoSendEnabled') === 'true';
    const readMessages = localStorage.getItem('readMessagesEnabled') !== 'false'; // default true
    const autoApproveThreshold = parseInt(localStorage.getItem('autoApproveThreshold') || '90');
    const detectionThreshold = parseInt(localStorage.getItem('detectionThreshold') || '70');

    document.getElementById('autoSendToggle').checked = autoSend;
    document.getElementById('readMessagesToggle').checked = readMessages;
    document.getElementById('autoApproveThreshold').value = autoApproveThreshold;
    document.getElementById('detectionThreshold').value = detectionThreshold;
    document.getElementById('thresholdValue').textContent = autoApproveThreshold;
    document.getElementById('detectionValue').textContent = detectionThreshold;
}

// Update threshold display
document.getElementById('autoApproveThreshold').addEventListener('input', (e) => {
    document.getElementById('thresholdValue').textContent = e.target.value;
});

document.getElementById('detectionThreshold').addEventListener('input', (e) => {
    document.getElementById('detectionValue').textContent = e.target.value;
});

// Save bot settings
document.getElementById('saveBotSettings').addEventListener('click', () => {
    const autoSend = document.getElementById('autoSendToggle').checked;
    const readMessages = document.getElementById('readMessagesToggle').checked;
    const autoApproveThreshold = document.getElementById('autoApproveThreshold').value;

    localStorage.setItem('autoSendEnabled', autoSend);
    localStorage.setItem('readMessagesEnabled', readMessages);
    localStorage.setItem('autoApproveThreshold', autoApproveThreshold);

    alert('✓ Bot sozlamalari saqlandi!\n\n' +
          `Kanalga avtomatik yuborish: ${autoSend ? 'Yoqilgan' : 'O\'chirilgan'}\n` +
          `Guruhlardan o'qish: ${readMessages ? 'Yoqilgan' : 'O\'chirilgan'}\n` +
          `Avtomatik tasdiqlash chegarasi: ${autoApproveThreshold}%`);
});

// Save security settings
document.getElementById('saveSecuritySettings').addEventListener('click', () => {
    const detectionThreshold = document.getElementById('detectionThreshold').value;

    localStorage.setItem('detectionThreshold', detectionThreshold);

    alert('✓ Xavfsizlik sozlamalari saqlandi!\n\n' +
          `Dispetcher aniqlash chegarasi: ${detectionThreshold}%`);
});

// Check system status
async function checkSystemStatus() {
    try {
        const health = await HealthAPI.check();

        const botStatus = document.getElementById('botStatusInfo');
        const sessionStatus = document.getElementById('sessionStatusInfo');

        if (health.services.telegram_bot) {
            botStatus.className = 'badge bg-success';
            botStatus.innerHTML = '<i class="bi bi-check-circle"></i> Ishlamoqda';
        } else {
            botStatus.className = 'badge bg-danger';
            botStatus.innerHTML = '<i class="bi bi-x-circle"></i> To\'xtatilgan';
        }

        if (health.services.telegram_session) {
            sessionStatus.className = 'badge bg-success';
            sessionStatus.innerHTML = '<i class="bi bi-check-circle"></i> Ulangan';
        } else {
            sessionStatus.className = 'badge bg-warning text-dark';
            sessionStatus.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Uzilgan';
        }
    } catch (error) {
        console.error('Status tekshirishda xatolik:', error);
    }
}

// Initialize
loadSettings();
checkSystemStatus();

// Auto-refresh status every 30 seconds
setInterval(checkSystemStatus, 30000);
