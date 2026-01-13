
const API_URL = 'http://localhost:3000/api/transactions';

// Read API key from localStorage for demo usage. In production use a secure auth flow.
const API_KEY = localStorage.getItem('pesadb_api_key') || '';
if (!API_KEY) console.warn('No API key found in localStorage (key: pesadb_api_key). Set it for authenticated API calls.');

function authHeaders() {
    const h = {};
    if (API_KEY) h['x-api-key'] = API_KEY;
    return h;
}

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
let searchQuery = '';
let dateFrom = '';
let dateTo = '';

// ===== PAGE NAVIGATION =====
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPage = link.getAttribute('data-page');

        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        pages.forEach(page => page.classList.remove('active'));
        document.getElementById(`page-${targetPage}`).classList.add('active');

        if (window.lucide) lucide.createIcons();

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
    const res = await fetch(API_URL, { headers: authHeaders() });
        const data = await res.json();
        transactions = data;
        renderDashboard();
        renderTransactionsFull();
    } catch (e) {
        console.error("Failed to fetch", e);
        showToast('Failed to load transactions', 'error');
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
            headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
            body: JSON.stringify(payload)
        });
        fetchTransactions();
        toggleModal(false);
        showToast(`Transaction ${id} recorded successfully!`, 'success');
    } catch (e) {
        console.error("Failed to add", e);
        showToast('Failed to add transaction', 'error');
    }
}

async function deleteTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    try {
    await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: authHeaders() });
        fetchTransactions();
        showToast('Transaction deleted', 'success');
    } catch (e) {
        console.error("Failed to delete", e);
        showToast('Failed to delete transaction', 'error');
    }
}

// ===== DASHBOARD RENDERING =====
function renderDashboard() {
    const total = transactions.filter(t => t.status === 'Success').reduce((sum, t) => sum + t.amount, 0);
    const count = transactions.length;
    const avg = count > 0 ? (total / count) : 0;

    totalSalesEl.innerText = `KES ${total.toLocaleString()}`;
    txCountEl.innerText = count;
    avgTicketEl.innerText = `KES ${Math.floor(avg).toLocaleString()}`;

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

    // Apply filters
    let filtered = transactions.filter(t => {
        // Status filter
        if (currentFilter !== 'all' && t.status !== currentFilter) return false;

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (!t.id.toLowerCase().includes(query) &&
                !t.merchant.toLowerCase().includes(query) &&
                !t.amount.toString().includes(query)) {
                return false;
            }
        }

        // Date range filter
        if (dateFrom && t.timestamp < dateFrom) return false;
        if (dateTo && t.timestamp > dateTo) return false;

        return true;
    });

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
            txFilter.querySelectorAll('span').forEach(s => s.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.getAttribute('data-filter');
            renderTransactionsFull();
        }
    });
}

// Search functionality
const searchTx = document.getElementById('searchTx');
if (searchTx) {
    searchTx.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderTransactionsFull();
    });
}

// Date filters
const dateFromInput = document.getElementById('dateFrom');
const dateToInput = document.getElementById('dateTo');

if (dateFromInput) {
    dateFromInput.addEventListener('change', (e) => {
        dateFrom = e.target.value;
        renderTransactionsFull();
    });
}

if (dateToInput) {
    dateToInput.addEventListener('change', (e) => {
        dateTo = e.target.value;
        renderTransactionsFull();
    });
}

// Clear filters
const clearFilters = document.getElementById('clearFilters');
if (clearFilters) {
    clearFilters.addEventListener('click', () => {
        searchQuery = '';
        dateFrom = '';
        dateTo = '';
        if (searchTx) searchTx.value = '';
        if (dateFromInput) dateFromInput.value = '';
        if (dateToInput) dateToInput.value = '';
        renderTransactionsFull();
        showToast('Filters cleared', 'info');
    });
}

// Export to CSV
const exportCsvBtn = document.getElementById('exportCsvBtn');
if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
        if (transactions.length === 0) {
            showToast('No transactions to export', 'error');
            return;
        }

        // Create CSV content
        const headers = ['ID', 'Merchant', 'Date', 'Amount', 'Status'];
        const csvRows = [headers.join(',')];

        transactions.forEach(tx => {
            const row = [
                tx.id,
                `"${tx.merchant}"`,
                tx.timestamp,
                tx.amount,
                tx.status
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pesatrack_transactions_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        showToast(`Exported ${transactions.length} transactions`, 'success');
    });
}

// ===== PAYOUTS PAGE =====
function loadPayouts() {
    const successfulTx = transactions.filter(t => t.status === 'Success');
    const totalSuccess = successfulTx.reduce((sum, t) => sum + t.amount, 0);
    const available = Math.floor(totalSuccess * 0.9);

    document.getElementById('availableBalance').innerText = `KES ${available.toLocaleString()}`;
    document.getElementById('pendingPayouts').innerText = 'KES 0.00';
    document.getElementById('totalPaidOut').innerText = 'KES 0.00';

    const payoutsTableBody = document.querySelector('#payoutsTable tbody');
    if (payoutsTableBody) {
        payoutsTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No payout history yet. Request your first payout!</td></tr>';
    }
}

const requestPayoutBtn = document.getElementById('requestPayoutBtn');
if (requestPayoutBtn) {
    requestPayoutBtn.addEventListener('click', () => {
        showToast('Payout request feature coming soon! This would integrate with Pesapal\'s payout API.', 'info');
    });
}

// ===== SETTINGS PAGE =====
function loadSettings() {
    const dbRecordCount = document.getElementById('dbRecordCount');
    const dbSize = document.getElementById('dbSize');
    const lastSync = document.getElementById('lastSync');

    if (dbRecordCount) dbRecordCount.innerText = transactions.length;
    if (dbSize) {
        const sizeKB = Math.ceil(JSON.stringify(transactions).length / 1024);
        dbSize.innerText = `${sizeKB} KB`;
    }
    if (lastSync) lastSync.innerText = new Date().toLocaleString();
}

const businessForm = document.getElementById('businessForm');
if (businessForm) {
    businessForm.addEventListener('submit', (e) => {
        e.preventDefault();
        showToast('Business information updated successfully!', 'success');
    });
}

const bankForm = document.getElementById('bankForm');
if (bankForm) {
    bankForm.addEventListener('submit', (e) => {
        e.preventDefault();
        showToast('Bank details updated successfully!', 'success');
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
        showToast('Data synced', 'success');
    });
}

if (refreshTxBtn) {
    refreshTxBtn.addEventListener('click', () => {
        fetchTransactions();
        showToast('Data synced', 'success');
    });
}

if (addTxBtn) addTxBtn.addEventListener('click', () => toggleModal(true));
if (addTxBtn2) addTxBtn2.addEventListener('click', () => toggleModal(true));
if (closeModal) closeModal.addEventListener('click', () => toggleModal(false));

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

window.deleteTransaction = deleteTransaction;

// ===== INITIALIZATION =====
fetchTransactions();
