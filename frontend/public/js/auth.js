/**
 * Authentication Page Logic
 */

// Check if already logged in
if (isAuthenticated()) {
    window.location.href = '/dashboard.html';
}

// Login form handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');

    // Disable button and show loading
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Yuklanmoqda...';

    try {
        const data = await AuthAPI.login(username, password);

        // Show success message
        showAlert('Muvaffaqiyatli kirish! Dashboard ga yo\'naltirilmoqda...', 'success');

        // Redirect to dashboard
        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 1000);

    } catch (error) {
        showAlert(error.message || 'Login xatolik yuz berdi', 'danger');

        // Re-enable button
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Kirish';
    }
});
