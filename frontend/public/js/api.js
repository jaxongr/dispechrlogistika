/**
 * API Helper Functions
 */

const API_BASE_URL = '/api';

// Get token from localStorage
function getToken() {
    return localStorage.getItem('token');
}

// Set token to localStorage
function setToken(token) {
    localStorage.setItem('token', token);
}

// Remove token from localStorage
function removeToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

// Check if user is authenticated
function isAuthenticated() {
    return !!getToken();
}

// Redirect to login if not authenticated
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = '/index.html';
        return false;
    }
    return true;
}

// Make API request with auth
async function apiRequest(endpoint, options = {}) {
    const token = getToken();

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        }
    };

    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, mergedOptions);

    if (response.status === 401) {
        removeToken();
        window.location.href = '/index.html';
        throw new Error('Unauthorized');
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
}

// Auth API
const AuthAPI = {
    async login(username, password) {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        setToken(data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    },

    async me() {
        return await apiRequest('/auth/me');
    },

    logout() {
        removeToken();
        window.location.href = '/index.html';
    }
};

// Messages API
const MessagesAPI = {
    async getAll(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await apiRequest(`/messages?${query}`);
    },

    async getOne(id) {
        return await apiRequest(`/messages/${id}`);
    },

    async approve(id) {
        return await apiRequest(`/messages/${id}/approve`, {
            method: 'POST'
        });
    },

    async sendToChannel(id) {
        return await apiRequest(`/messages/${id}/send`, {
            method: 'POST'
        });
    },

    async blockSender(id, reason) {
        return await apiRequest(`/messages/${id}/block-sender`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
    },

    async reanalyze(id) {
        return await apiRequest(`/messages/${id}/reanalyze`, {
            method: 'POST'
        });
    },

    async getStatistics() {
        return await apiRequest('/messages/statistics');
    },

    async delete(id) {
        return await apiRequest(`/messages/${id}`, {
            method: 'DELETE'
        });
    }
};

// Health API
const HealthAPI = {
    async check() {
        return await apiRequest('/health');
    }
};

// Show alert
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) return;

    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    alertContainer.appendChild(alert);

    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('uz-UZ', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Truncate text
function truncate(text, length = 100) {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
}

// Format phone number to +998 XX XXX XX XX
function formatPhone(phone) {
    if (!phone) return '';
    
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // If starts with 998 and has 12 digits: 998XXXXXXXXX
    if (digits.startsWith('998') && digits.length === 12) {
        return '+998 ' + digits.substr(3, 2) + ' ' + digits.substr(5, 3) + ' ' + 
               digits.substr(8, 2) + ' ' + digits.substr(10, 2);
    }
    
    // If has 9 digits: XXXXXXXXX (assume Uzbek)
    if (digits.length === 9) {
        return '+998 ' + digits.substr(0, 2) + ' ' + digits.substr(2, 3) + ' ' + 
               digits.substr(5, 2) + ' ' + digits.substr(7, 2);
    }
    
    // If already has +998 prefix
    if (phone.includes('+998')) {
        const digitsOnly = digits.startsWith('998') ? digits.substr(3) : digits;
        if (digitsOnly.length === 9) {
            return '+998 ' + digitsOnly.substr(0, 2) + ' ' + digitsOnly.substr(2, 3) + ' ' + 
                   digitsOnly.substr(5, 2) + ' ' + digitsOnly.substr(7, 2);
        }
    }
    
    // Return as-is if cannot format
    return phone;
}

// Generic API helper for statistics and other pages
const api = {
    async get(endpoint) {
        const token = getToken();
        return fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        });
    },

    async post(endpoint, data) {
        const token = getToken();
        return fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: JSON.stringify(data)
        });
    },

    async put(endpoint, data) {
        const token = getToken();
        return fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: JSON.stringify(data)
        });
    },

    async delete(endpoint) {
        const token = getToken();
        return fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        });
    }
};
