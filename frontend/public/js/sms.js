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
        document.getElementById('smsSuccessEnabled').checked = settings.success_enabled || false;
        document.getElementById('smsAutoSelectDevice').checked = settings.auto_select_device !== false;
        document.getElementById('smsTemplate').value = settings.template || '';
        document.getElementById('smsSuccessTemplate').value = settings.success_template || '';

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
            success_enabled: document.getElementById('smsSuccessEnabled').checked,
            success_template: document.getElementById('smsSuccessTemplate').value,
            device_id: document.getElementById('smsDeviceSelect').value || null,
            auto_select_device: document.getElementById('smsAutoSelectDevice').checked
        };

        if (settings.enabled && !settings.template) {
            showAlert('Bloklash SMS shablon kiritilmagan!', 'warning');
            return;
        }

        if (settings.success_enabled && !settings.success_template) {
            showAlert('Muvaffaqiyat SMS shablon kiritilmagan!', 'warning');
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
        const response = await apiRequest('/sms/history?limit=100');
        const history = response.history;

        // Separate block and success SMS
        const blockSMS = history.filter(sms => sms.type !== 'success');
        const successSMS = history.filter(sms => sms.type === 'success');

        // Update counts in tabs
        document.getElementById('blockSmsCount').textContent = blockSMS.length;
        document.getElementById('successSmsCount').textContent = successSMS.length;

        // Render block SMS history
        renderSMSHistoryTable(blockSMS, 'blockSmsHistoryContainer', 'danger', 'Bloklash SMS yuborilmagan');

        // Render success SMS history
        renderSMSHistoryTable(successSMS, 'successSmsHistoryContainer', 'success', 'Muvaffaqiyat SMS yuborilmagan');

    } catch (error) {
        console.error('SMS tarixini yuklashda xatolik:', error);
        document.getElementById('blockSmsHistoryContainer').innerHTML =
            '<div class="alert alert-danger">Tarixni yuklashda xatolik</div>';
        document.getElementById('successSmsHistoryContainer').innerHTML =
            '<div class="alert alert-danger">Tarixni yuklashda xatolik</div>';
    }
}

// Render SMS history table
function renderSMSHistoryTable(smsHistory, containerId, type, emptyMessage) {
    const container = document.getElementById(containerId);

    if (smsHistory.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                <p class="mt-2">${emptyMessage}</p>
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

    smsHistory.forEach(sms => {
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

        // Add type badge
        const typeBadge = sms.type === 'success'
            ? '<span class="badge bg-success me-1">Muvaffaqiyat</span>'
            : '<span class="badge bg-danger me-1">Bloklash</span>';

        html += `
            <tr>
                <td><small>${date}</small></td>
                <td><strong>${sms.phone}</strong></td>
                <td>${typeBadge}<small>${truncate(sms.message, 70)}</small>${errorMsg}</td>
                <td>${statusBadge}</td>
                <td><small class="text-muted">${deviceId}</small></td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
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
