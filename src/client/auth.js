// Simple authentication system (localStorage-based for demo)

function login(merchantId, pin) {
    // Demo credentials
    const validCredentials = {
        '4920': '1234',
        '5001': '5678',
        'demo': 'demo'
    };

    if (validCredentials[merchantId] && validCredentials[merchantId] === pin) {
        const userData = {
            merchantId: merchantId,
            name: merchantId === '4920' ? 'John Mwangi' : merchantId === '5001' ? 'Jane Kamau' : 'Demo User',
            loginTime: new Date().toISOString()
        };

        localStorage.setItem('pesatrack_user', JSON.stringify(userData));
        // Set demo API key for instant access
        localStorage.setItem('pesadb_api_key', 'demo-key-123');
        return true;
    }
    return false;
}

function logout() {
    localStorage.removeItem('pesatrack_user');
    localStorage.removeItem('pesadb_api_key');
    window.location.href = 'login.html';
}

function isLoggedIn() {
    const user = localStorage.getItem('pesatrack_user');
    return user !== null;
}

function getCurrentUser() {
    const user = localStorage.getItem('pesatrack_user');
    return user ? JSON.parse(user) : null;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
        'success': 'check-circle',
        'error': 'alert-circle',
        'info': 'info'
    };

    toast.innerHTML = `
        <div class="toast-icon">
            <i data-lucide="${iconMap[type]}" style="width: 16px; height: 16px;"></i>
        </div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i data-lucide="x" style="width: 16px; height: 16px;"></i>
        </button>
    `;

    container.appendChild(toast);

    // Reinitialize icons
    if (window.lucide) lucide.createIcons();

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(400px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Export for use in other scripts
window.login = login;
window.logout = logout;
window.isLoggedIn = isLoggedIn;
window.getCurrentUser = getCurrentUser;
window.showToast = showToast;

// Login form handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const merchantId = document.getElementById('merchantIdInput').value;
        const pin = document.getElementById('pinInput').value;

        if (login(merchantId, pin)) {
            window.location.href = 'index.html';
        } else {
            showToast('Invalid credentials. Please try again.', 'error');
        }
    });
}

// Logout button handler
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            logout();
        }
    });
}

// Update user info in sidebar
const currentUser = getCurrentUser();
if (currentUser && document.getElementById('userName')) {
    document.getElementById('userName').innerText = currentUser.name;
    document.getElementById('userMerchantId').innerText = `Merchant ID: ${currentUser.merchantId}`;
}
