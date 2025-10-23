/**
 * Messages Page Logic
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
let currentPage = 0;
let currentFilters = {};

// Load messages
async function loadMessages() {
    try {
        const params = {
            limit: 20,
            offset: currentPage * 20,
            ...currentFilters
        };

        const data = await MessagesAPI.getAll(params);
        const container = document.getElementById('messagesContainer');

        if (data.messages.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                    <p class="mt-2">E'lonlar topilmadi</p>
                </div>
            `;
            document.getElementById('paginationContainer').style.display = 'none';
            return;
        }

        // Render messages table
        let html = '<div class="table-responsive"><table class="table table-hover">';
        html += `
            <thead>
                <tr>
                    <th style="width: 150px;">Sana</th>
                    <th>Guruh</th>
                    <th>Yuboruvchi</th>
                    <th>Xabar</th>
                    <th style="width: 120px;">Status</th>
                    <th style="width: 80px;">Ishonch</th>
                    <th style="width: 150px;">Amallar</th>
                </tr>
            </thead>
            <tbody>
        `;

        data.messages.forEach(msg => {
            const statusBadge = msg.is_dispatcher
                ? '<span class="badge bg-danger"><i class="bi bi-x-circle"></i> Dispetcher</span>'
                : msg.is_approved
                ? '<span class="badge bg-success"><i class="bi bi-check-circle"></i> Tasdiqlangan</span>'
                : '<span class="badge bg-warning text-dark"><i class="bi bi-clock"></i> Kutilmoqda</span>';

            const sentBadge = msg.is_sent_to_channel
                ? '<br><span class="badge bg-info mt-1"><i class="bi bi-send-check"></i> Yuborilgan</span>'
                : '';

            const confidence = msg.confidence_score
                ? `<span class="badge ${msg.is_dispatcher ? 'bg-danger' : 'bg-success'}">${(msg.confidence_score * 100).toFixed(0)}%</span>`
                : '-';

            // Count user's groups
            const userGroupCount = msg.user_group_count || '-';

            html += `
                <tr style="cursor: pointer;" onclick="viewMessage(${msg.id})">
                    <td><small>${formatDate(msg.message_date)}</small></td>
                    <td><small>${msg.group_name || 'N/A'}</small></td>
                    <td>
                        <small>${msg.sender_full_name || msg.sender_username || 'N/A'}</small><br>
                        <span class="badge bg-secondary" style="font-size: 0.7rem;">
                            <i class="bi bi-people"></i> ${userGroupCount} guruh
                        </span>
                    </td>
                    <td><small>${truncate(msg.message_text, 100)}</small></td>
                    <td>${statusBadge}${sentBadge}</td>
                    <td class="text-center">${confidence}</td>
                    <td onclick="event.stopPropagation();">
                        <div class="btn-group btn-group-sm" role="group">
                            ${!msg.is_dispatcher && !msg.is_approved ?
                                '<button class="btn btn-success" onclick="approveMessage(' + msg.id + ')" title="Tasdiqlash">' +
                                    '<i class="bi bi-check"></i>' +
                                '</button>'
                            : ''}
                            ${msg.is_approved && !msg.is_sent_to_channel ?
                                '<button class="btn btn-primary" onclick="sendMessage(' + msg.id + ')" title="Yuborish">' +
                                    '<i class="bi bi-send"></i>' +
                                '</button>'
                            : ''}
                            ${!msg.is_dispatcher ?
                                '<button class="btn btn-danger" onclick="markAsDispatcher(' + msg.id + ')" title="Dispetchr deb belgilash">' +
                                    '<i class="bi bi-ban"></i> Dispetchr' +
                                '</button>'
                            : ''}
                            <button class="btn btn-info" onclick="viewMessage(${msg.id})" title="Ko'rish">
                                <i class="bi bi-eye"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        // Render pagination
        renderPagination(data.pagination);

    } catch (error) {
        console.error('Xabarlarni yuklashda xatolik:', error);
        const container = document.getElementById('messagesContainer');
        container.innerHTML = `
            <div class="alert alert-danger">
                Xabarlarni yuklashda xatolik yuz berdi
            </div>
        `;
    }
}

// Render pagination
function renderPagination(pagination) {
    if (pagination.pages <= 1) {
        document.getElementById('paginationContainer').style.display = 'none';
        return;
    }

    document.getElementById('paginationContainer').style.display = 'block';
    const paginationEl = document.getElementById('pagination');
    let html = '';

    // Previous button
    html += `
        <li class="page-item ${currentPage === 0 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;">Oldingi</a>
        </li>
    `;

    // Page numbers
    for (let i = 0; i < pagination.pages; i++) {
        if (
            i === 0 ||
            i === pagination.pages - 1 ||
            (i >= currentPage - 2 && i <= currentPage + 2)
        ) {
            html += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i + 1}</a>
                </li>
            `;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
    }

    // Next button
    html += `
        <li class="page-item ${currentPage >= pagination.pages - 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;">Keyingi</a>
        </li>
    `;

    paginationEl.innerHTML = html;
}

// Change page
function changePage(page) {
    currentPage = page;
    loadMessages();
    window.scrollTo(0, 0);
}

// Apply filters
document.getElementById('applyFilters').addEventListener('click', () => {
    const status = document.getElementById('filterStatus').value;
    const sent = document.getElementById('filterSent').value;
    const search = document.getElementById('searchInput').value;

    currentFilters = {};

    if (status === 'approved') {
        currentFilters.is_approved = 'true';
        currentFilters.is_dispatcher = 'false';
    } else if (status === 'pending') {
        currentFilters.is_approved = 'false';
        currentFilters.is_dispatcher = 'false';
    } else if (status === 'dispatcher') {
        currentFilters.is_dispatcher = 'true';
    }

    if (sent) {
        currentFilters.is_sent_to_channel = sent;
    }

    if (search) {
        currentFilters.search = search;
    }

    currentPage = 0;
    loadMessages();
});

// View message details
async function viewMessage(id) {
    try {
        const data = await MessagesAPI.getOne(id);
        const msg = data.message;

        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <p><strong>Sana:</strong><br>${formatDate(msg.message_date)}</p>
                    <p><strong>Guruh:</strong><br>${msg.group_name || 'N/A'}</p>
                    <p><strong>Yuboruvchi:</strong><br>${msg.sender_full_name || msg.sender_username || 'N/A'}</p>
                </div>
                <div class="col-md-6">
                    <p><strong>Status:</strong><br>
                        ${msg.is_dispatcher
                            ? '<span class="badge bg-danger">Dispetcher</span>'
                            : msg.is_approved
                            ? '<span class="badge bg-success">Tasdiqlangan</span>'
                            : '<span class="badge bg-warning text-dark">Kutilmoqda</span>'}
                    </p>
                    <p><strong>Ishonch darajasi:</strong><br>
                        ${msg.confidence_score
                            ? `<span class="badge ${msg.is_dispatcher ? 'bg-danger' : 'bg-success'}">${(msg.confidence_score * 100).toFixed(0)}%</span>`
                            : '-'}
                    </p>
                    <p><strong>Yuborilgan:</strong><br>
                        ${msg.is_sent_to_channel
                            ? '<span class="badge bg-info">Ha</span>'
                            : '<span class="badge bg-secondary">Yo\'q</span>'}
                    </p>
                </div>
            </div>
            <hr>
            <p><strong>Xabar matni:</strong></p>
            <div class="border p-3 bg-light" style="white-space: pre-wrap;">${msg.message_text}</div>
        `;

        const modalFooter = document.getElementById('modalFooter');
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Yopish</button>
            ${!msg.is_dispatcher && !msg.is_approved ?
                '<button type="button" class="btn btn-success" onclick="approveMessage(' + msg.id + ')">' +
                    '<i class="bi bi-check"></i> Tasdiqlash' +
                '</button>'
            : ''}
            ${msg.is_approved && !msg.is_sent_to_channel ?
                '<button type="button" class="btn btn-primary" onclick="sendMessage(' + msg.id + ')">' +
                    '<i class="bi bi-send"></i> Kanalga yuborish' +
                '</button>'
            : ''}
            ${!msg.is_dispatcher ?
                '<button type="button" class="btn btn-danger" onclick="blockSender(' + msg.id + ')">' +
                    '<i class="bi bi-ban"></i> Yuboruvchini bloklash' +
                '</button>'
            : ''}
        `;

        const modal = new bootstrap.Modal(document.getElementById('messageModal'));
        modal.show();

    } catch (error) {
        console.error('Xabar ma\'lumotlarini yuklashda xatolik:', error);
        alert('Xatolik yuz berdi');
    }
}

// Approve message
async function approveMessage(id) {
    try {
        await MessagesAPI.approve(id);
        alert('Xabar tasdiqlandi!');
        loadMessages();

        // Close modal if open
        const modal = bootstrap.Modal.getInstance(document.getElementById('messageModal'));
        if (modal) modal.hide();
    } catch (error) {
        console.error('Xabarni tasdiqlashda xatolik:', error);
        alert('Xatolik yuz berdi');
    }
}

// Send message to channel
async function sendMessage(id) {
    if (!confirm('Xabarni kanalga yuborishni xohlaysizmi?')) {
        return;
    }

    try {
        await MessagesAPI.sendToChannel(id);
        alert('Xabar kanalga yuborildi!');
        loadMessages();

        // Close modal if open
        const modal = bootstrap.Modal.getInstance(document.getElementById('messageModal'));
        if (modal) modal.hide();
    } catch (error) {
        console.error('Xabarni yuborishda xatolik:', error);
        alert('Xatolik yuz berdi');
    }
}

// Block sender
async function blockSender(id) {
    const reason = prompt('Bloklash sababini kiriting:');
    if (!reason) return;

    try {
        await MessagesAPI.blockSender(id, reason);
        alert('Yuboruvchi bloklandi!');
        loadMessages();

        // Close modal if open
        const modal = bootstrap.Modal.getInstance(document.getElementById('messageModal'));
        if (modal) modal.hide();
    } catch (error) {
        console.error('Yuboruvchini bloklashda xatolik:', error);
        alert('Xatolik yuz berdi');
    }
}

// Mark message as dispatcher and block sender
async function markAsDispatcher(id) {
    if (!confirm('Bu yuboruvchini DISPETCHR deb belgilash va bloklashni xohlaysizmi?\n\nBu user keyingi xabarlarini yuborolmaydi!')) {
        return;
    }

    try {
        // Block sender with auto reason
        await MessagesAPI.blockSender(id, 'Dispetchr deb belgilangan');
        alert('✅ Dispetchr deb belgilandi va bloklandi!');
        loadMessages();
    } catch (error) {
        console.error('Dispetchr belgilashda xatolik:', error);
        alert('Xatolik yuz berdi');
    }
}

// Initialize
loadMessages();
