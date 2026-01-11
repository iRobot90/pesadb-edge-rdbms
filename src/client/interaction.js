
const API_URL = 'http://localhost:3000/api/transactions';

// Elements
const txTableBody = document.querySelector('#txTable tbody');
const txTableFullBody = document.querySelector('#txTableFull tbody');
const totalSalesEl = document.getElementById('totalSales');
const txCountEl = document.getElementById('txCount');
const avgTicketEl = document.getElementById('avgTicket');

// Page Navigation
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page-content');

// State
let transactions = [];
let currentFilter = 'all';

// ===== PAGE NAVIGATION =====
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPage = link.getAttribute('data-page');

        // Update active nav
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Show target page
        pages.forEach(page => page.classList.remove('active'));
        document.getElementById(`page-${targetPage}`).classList.add('active');

        // Reinitialize icons for new page
        if (window.lucide) lucide.createIcons();

        // Load page-specific data
        if (targetPage === 'transactions') {
            renderTransactionsFull();
        } else if (targetPage === 'payouts') {
            loadPayouts();
        } else if (targetPage === 'settings') {
            loadSettings();
        }
    });
});

// ===== API CLIENT =====
async function fetchTransactions() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        transactions = data;
        renderDashboard();
        renderTransactionsFull();
    } catch (e) {
        console.error("Failed to fetch", e);
    }
}

async function addTransaction(amount, status) {
    const id = 'TX-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const timestamp = new Date().toISOString().split('T')[0];
    const merchant = document.getElementById('mName').value;

    const payload = {
        id,
        amount: Number(amount),
        merchant,
        status,
        timestamp
    };

    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        fetchTransactions();
        toggleModal(false);
    } catch (e) {
        console.error("Failed to add", e);
    }
}

async function deleteTransaction(id) {
    if (!confirm("Are you sure?")) return;
    try {
        await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        fetchTransactions();
    } catch (e) {
        console.error("Failed to delete", e);
    }
}

// ===== DASHBOARD RENDERING =====
function renderDashboard() {
    // Stats
    const total = transactions.filter(t => t.status === 'Success').reduce((sum, t) => sum + t.amount, 0);
    const count = transactions.length;
    const avg = count > 0 ? (total / count) : 0;

    totalSalesEl.innerText = `KES ${total.toLocaleString()}`;
    txCountEl.innerText = count;
    avgTicketEl.innerText = `KES ${Math.floor(avg).toLocaleString()}`;

    // Table (last 5)
    txTableBody.innerHTML = '';
    const reversed = [...transactions].reverse().slice(0, 5);

    if (reversed.length === 0) {
        txTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No transactions recorded.</td></tr>';
        return;
    }

    reversed.forEach(tx => {
        const tr = document.createElement('tr');
        const statusClass = `status-${tx.status.toLowerCase()}`;

        tr.innerHTML = `
            <td><code>${tx.id}</code></td>
            <td>${tx.merchant}</td>
            <td>${tx.timestamp}</td>
            <td>KES ${tx.amount.toLocaleString()}</td>
            <td><span class="status-ill ${statusClass}">${tx.status}</span></td>
            <td>
                <button class="delete-btn" onclick="deleteTransaction('${tx.id}')">
                    <i data-lucide="trash-2" style="width: 16px;"></i>
                </button>
            </td>
        `;
        txTableBody.appendChild(tr);
    });

    if (window.lucide) lucide.createIcons();
}

// ===== TRANSACTIONS PAGE =====
function renderTransactionsFull() {
    if (!txTableFullBody) return;

    txTableFullBody.innerHTML = '';

    // Apply filter
    let filtered = currentFilter === 'all'
        ? transactions
        : transactions.filter(t => t.status === currentFilter);

    const reversed = [...filtered].reverse();

    if (reversed.length === 0) {
        txTableFullBody.innerHTML = '<tr><td colspan="6" class="empty-state">No transactions found.</td></tr>';
        return;
    }

    reversed.forEach(tx => {
        const tr = document.createElement('tr');
        const statusClass = `status-${tx.status.toLowerCase()}`;

        tr.innerHTML = `
            <td><code>${tx.id}</code></td>
            <td>${tx.merchant}</td>
            <td>${tx.timestamp}</td>
            <td>KES ${tx.amount.toLocaleString()}</td>
            <td><span class="status-ill ${statusClass}">${tx.status}</span></td>
            <td>
                <button class="delete-btn" onclick="deleteTransaction('${tx.id}')">
                    <i data-lucide="trash-2" style="width: 16px;"></i>
                </button>
            </td>
        `;
        txTableFullBody.appendChild(tr);
    });

    if (window.lucide) lucide.createIcons();
}

// Transaction Filter
const txFilter = document.getElementById('txFilter');
if (txFilter) {
    txFilter.addEventListener('click', (e) => {
        if (e.target.tagName === 'SPAN') {
            // Update active filter
            txFilter.querySelectorAll('span').forEach(s => s.classList.remove('active'));
            e.target.classList.add('active');

            // Update filter state
            currentFilter = e.target.getAttribute('data-filter');
            renderTransactionsFull();
        }
    });
}

// ===== PAYOUTS PAGE =====
function loadPayouts() {
    // Calculate payout stats from successful transactions
    const successfulTx = transactions.filter(t => t.status === 'Success');
    const totalSuccess = successfulTx.reduce((sum, t) => sum + t.amount, 0);

    // Simulate 10% platform fee
    const available = Math.floor(totalSuccess * 0.9);

    document.getElementById('availableBalance').innerText = `KES ${available.toLocaleString()}`;
    document.getElementById('pendingPayouts').innerText = 'KES 0.00';
    document.getElementById('totalPaidOut').innerText = 'KES 0.00';

    // Mock payout history
    const payoutsTableBody = document.querySelector('#payoutsTable tbody');
    if (payoutsTableBody) {
        payoutsTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No payout history yet. Request your first payout!</td></tr>';
    }
}

// Payout Request
const requestPayoutBtn = document.getElementById('requestPayoutBtn');
if (requestPayoutBtn) {
    requestPayoutBtn.addEventListener('click', () => {
        alert('Payout request feature coming soon! This would integrate with Pesapal\'s payout API.');
    });
}

// ===== SETTINGS PAGE =====
function loadSettings() {
    // Load DB stats
    const dbRecordCount = document.getElementById('dbRecordCount');
    const dbSize = document.getElementById('dbSize');
    const lastSync = document.getElementById('lastSync');

    if (dbRecordCount) {
        dbRecordCount.innerText = transactions.length;
    }
    if (dbSize) {
        // Estimate size (very rough)
        const sizeKB = Math.ceil(JSON.stringify(transactions).length / 1024);
        dbSize.innerText = `${sizeKB} KB`;
    }
    if (lastSync) {
        lastSync.innerText = new Date().toLocaleString();
    }
}

// Settings Forms
const businessForm = document.getElementById('businessForm');
if (businessForm) {
    businessForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Business information updated successfully!');
    });
}

const bankForm = document.getElementById('bankForm');
if (bankForm) {
    bankForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Bank details updated successfully!');
    });
}

// ===== MODAL =====
const refreshBtn = document.getElementById('refreshBtn');
const addTxBtn = document.getElementById('addTxBtn');
const addTxBtn2 = document.getElementById('addTxBtn2');
const refreshTxBtn = document.getElementById('refreshTxBtn');
const txModal = document.getElementById('txModal');
const closeModal = document.getElementById('closeModal');
const txForm = document.getElementById('txForm');

function toggleModal(show) {
    txModal.style.display = show ? 'flex' : 'none';
    if (show) {
        document.getElementById('mAmount').value = '';
        document.getElementById('mAmount').focus();
    }
}

if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        fetchTransactions();
    });
}

if (refreshTxBtn) {
    refreshTxBtn.addEventListener('click', () => {
        fetchTransactions();
    });
}

if (addTxBtn) {
    addTxBtn.addEventListener('click', () => toggleModal(true));
}

if (addTxBtn2) {
    addTxBtn2.addEventListener('click', () => toggleModal(true));
}

if (closeModal) {
    closeModal.addEventListener('click', () => toggleModal(false));
}

if (txModal) {
    txModal.addEventListener('click', (e) => {
        if (e.target === txModal) toggleModal(false);
    });
}

if (txForm) {
    txForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = document.getElementById('mAmount').value;
        const status = document.getElementById('mStatus').value;
        addTransaction(amount, status);
    });
}

// Expose to window
window.deleteTransaction = deleteTransaction;

// ===== INITIALIZATION =====
fetchTransactions();
