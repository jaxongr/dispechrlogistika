/**
 * SMS Settings Page Logic
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

        if (!devices || devices.length === 0) {
            select.innerHTML = '<option value="">Hech qanday qurilma topilmadi</option>';
            showAlert('SemySMS qurilmalari topilmadi. API token tekshiring!', 'warning');
            return;
        }

        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.device_id;
            const status = device.online === 1 ? '🟢' : '🔴';
            const battery = device.battery ? ` (${device.battery}%)` : '';
            option.textContent = `${status} ${device.device_name} - ${device.device_model}${battery}`;
            select.appendChild(option);
        });

        // Show account info
        document.getElementById('smsDeviceCount').textContent = devices.length;
        document.getElementById('smsAccountInfo').style.display = 'block';

        showAlert(`${devices.length} ta qurilma topildi!`, 'success');

    } catch (error) {
        console.error('Qurilmalarni yuklashda xatolik:', error);
        const select = document.getElementById('smsDeviceSelect');
        select.innerHTML = '<option value="">⚠️ Xatolik - API token tekshiring</option>';
        showAlert('Qurilmalarni yuklashda xatolik: ' + error.message, 'danger');
    }
}

// Refresh devices
document.getElementById('refreshDevicesBtn').addEventListener('click', async () => {
    const btn = document.getElementById('refreshDevicesBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Yangilanmoqda...';

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

        const btn = document.getElementById('saveSmsSettings');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saqlanmoqda...';

        await apiRequest('/sms/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });

        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-save"></i> SMS Sozlamalarni Saqlash';

        showAlert('✅ SMS sozlamalari saqlandi!', 'success');
    } catch (error) {
        console.error('SMS sozlamalarini saqlashda xatolik:', error);
        showAlert('❌ SMS sozlamalarini saqlashda xatolik', 'danger');

        const btn = document.getElementById('saveSmsSettings');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-save"></i> SMS Sozlamalarni Saqlash';
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
        btn.innerHTML = '<i class="bi bi-send"></i> Test Yuborish';

        showAlert('✅ Test SMS yuborildi!', 'success');

        // Reload history
        setTimeout(() => {
            loadSMSHistory();
        }, 1000);

    } catch (error) {
        console.error('Test SMS yuborishda xatolik:', error);
        showAlert('❌ Test SMS yuborishda xatolik: ' + (error.message || 'Noma\'lum xatolik'), 'danger');

        const btn = document.getElementById('sendTestSmsBtn');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-send"></i> Test Yuborish';
    }
});

// Load SMS history
async function loadSMSHistory() {
    try {
        const response = await apiRequest('/sms/history?limit=50');
        const history = response.history;

        const container = document.getElementById('smsHistoryContainer');

        if (history.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                    <p class="mt-2">Hali SMS yuborilmagan</p>
                </div>
            `;
            return;
        }

        let html = '<div class="table-responsive"><table class="table table-hover">';
        html += `
            <thead>
                <tr>
                    <th>Vaqt</th>
                    <th>Telefon</th>
                    <th>Xabar</th>
                    <th>Status</th>
                    <th>Qurilma</th>
                </tr>
            </thead>
            <tbody>
        `;

        history.forEach(sms => {
            const date = new Date(sms.sent_at).toLocaleString('uz-UZ', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            const statusBadge = sms.status === 'sent'
                ? '<span class="badge bg-success">✅ Yuborildi</span>'
                : '<span class="badge bg-danger">❌ Xatolik</span>';

            const deviceId = sms.device_id || 'N/A';
            const errorMsg = sms.error ? `<br><small class="text-danger">${sms.error}</small>` : '';

            html += `
                <tr>
                    <td><small>${date}</small></td>
                    <td><strong>${sms.phone}</strong></td>
                    <td><small>${truncate(sms.message, 80)}</small>${errorMsg}</td>
                    <td>${statusBadge}</td>
                    <td><small class="text-muted">${deviceId}</small></td>
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
    alertDiv.style.minWidth = '300px';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 4000);
}

// Initialize
loadSMSSettings();

// Auto-refresh history every 30 seconds
setInterval(() => {
    loadSMSHistory();
}, 30000);
