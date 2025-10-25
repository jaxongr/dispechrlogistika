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

// ===== SMS SETTINGS =====

// Load SMS settings
async function loadSMSSettings() {
    try {
        const response = await apiRequest('/sms/settings');
        const settings = response.settings;

        document.getElementById('smsEnabled').checked = settings.enabled || false;
        document.getElementById('smsAutoSelectDevice').checked = settings.auto_select_device !== false;
        document.getElementById('smsTemplate').value = settings.template || '';

        // Load devices
        await loadSMSDevices();

        // Set selected device
        if (settings.device_id) {
            document.getElementById('smsDeviceSelect').value = settings.device_id;
        }

        // Load history
        await loadSMSHistory();

    } catch (error) {
        console.error('SMS sozlamalarini yuklashda xatolik:', error);
        showAlert('SMS sozlamalarini yuklashda xatolik', 'danger');
    }
}

// Load devices from SemySMS
async function loadSMSDevices() {
    try {
        const response = await apiRequest('/sms/devices');
        const devices = response.devices;

        const select = document.getElementById('smsDeviceSelect');
        select.innerHTML = '<option value="">Qurilma tanlang...</option>';

        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.device_id;
            const status = device.online === 1 ? '🟢' : '🔴';
            option.textContent = `${status} ${device.device_name} (${device.device_model})`;
            select.appendChild(option);
        });

        // Show account info
        if (devices.length > 0) {
            document.getElementById('smsDeviceCount').textContent = devices.length;
            document.getElementById('smsAccountInfo').style.display = 'block';
        }

    } catch (error) {
        console.error('Qurilmalarni yuklashda xatolik:', error);
        const select = document.getElementById('smsDeviceSelect');
        select.innerHTML = '<option value="">Xatolik - qurilmalar yuklanmadi</option>';
    }
}

// Refresh devices
document.getElementById('refreshDevicesBtn').addEventListener('click', async () => {
    const btn = document.getElementById('refreshDevicesBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise spinner-border spinner-border-sm"></i> Yangilanmoqda...';

    await loadSMSDevices();

    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Qurilmalarni Yangilash';
});

// Save SMS settings
document.getElementById('saveSmsSettings').addEventListener('click', async () => {
    try {
        const settings = {
            enabled: document.getElementById('smsEnabled').checked,
            template: document.getElementById('smsTemplate').value,
            device_id: document.getElementById('smsDeviceSelect').value || null,
            auto_select_device: document.getElementById('smsAutoSelectDevice').checked
        };

        if (settings.enabled && !settings.template) {
            showAlert('SMS shablon kiritilmagan!', 'warning');
            return;
        }

        await apiRequest('/sms/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });

        showAlert('SMS sozlamalari saqlandi!', 'success');
    } catch (error) {
        console.error('SMS sozlamalarini saqlashda xatolik:', error);
        showAlert('SMS sozlamalarini saqlashda xatolik', 'danger');
    }
});

// Send test SMS
document.getElementById('sendTestSmsBtn').addEventListener('click', async () => {
    try {
        const phone = document.getElementById('testPhoneNumber').value;
        const message = document.getElementById('smsTemplate').value;

        if (!phone || !message) {
            showAlert('Telefon raqam va xabar matni kiriting!', 'warning');
            return;
        }

        const btn = document.getElementById('sendTestSmsBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Yuborilmoqda...';

        await apiRequest('/sms/test', {
            method: 'POST',
            body: JSON.stringify({ phone, message })
        });

        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-send"></i> Test';

        showAlert('Test SMS yuborildi!', 'success');

        // Reload history
        await loadSMSHistory();

    } catch (error) {
        console.error('Test SMS yuborishda xatolik:', error);
        showAlert('Test SMS yuborishda xatolik: ' + error.message, 'danger');

        const btn = document.getElementById('sendTestSmsBtn');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-send"></i> Test';
    }
});

// Load SMS history
async function loadSMSHistory() {
    try {
        const response = await apiRequest('/sms/history?limit=10');
        const history = response.history;

        const container = document.getElementById('smsHistoryContainer');

        if (history.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-3">Hali SMS yuborilmagan</div>';
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-sm table-hover">';
        html += `
            <thead>
                <tr>
                    <th>Vaqt</th>
                    <th>Telefon</th>
                    <th>Xabar</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
        `;

        history.forEach(sms => {
            const date = new Date(sms.sent_at).toLocaleString('uz-UZ');
            const statusBadge = sms.status === 'sent'
                ? '<span class="badge bg-success">Yuborildi</span>'
                : '<span class="badge bg-danger">Xatolik</span>';

            html += `
                <tr>
                    <td><small>${date}</small></td>
                    <td><small>${sms.phone}</small></td>
                    <td><small>${truncate(sms.message, 50)}</small></td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('SMS tarixini yuklashda xatolik:', error);
        document.getElementById('smsHistoryContainer').innerHTML =
            '<div class="alert alert-danger">Tarixni yuklashda xatolik</div>';
    }
}

// Helper function to show alerts
function showAlert(message, type = 'info') {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

// Initialize
loadSettings();
checkSystemStatus();
loadSMSSettings();

// Auto-refresh status every 30 seconds
setInterval(checkSystemStatus, 30000);
