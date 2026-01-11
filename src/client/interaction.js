
const API_URL = 'http://localhost:3000/api/transactions';

// Elements
const txTableBody = document.querySelector('#txTable tbody');
const totalSalesEl = document.getElementById('totalSales');
const txCountEl = document.getElementById('txCount');
const avgTicketEl = document.getElementById('avgTicket');

const refreshBtn = document.getElementById('refreshBtn');
const addTxBtn = document.getElementById('addTxBtn');
const txModal = document.getElementById('txModal');
const closeModal = document.getElementById('closeModal');
const txForm = document.getElementById('txForm');

// State
let transactions = [];

// API Client
async function fetchTransactions() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        transactions = data;
        render();
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
        fetchTransactions(); // Refresh
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

// Logic
function render() {
    // Stats
    const total = transactions.filter(t => t.status === 'Success').reduce((sum, t) => sum + t.amount, 0);
    const count = transactions.length;
    const avg = count > 0 ? (total / count) : 0;

    totalSalesEl.innerText = `KES ${total.toLocaleString()}`;
    txCountEl.innerText = count;
    avgTicketEl.innerText = `KES ${Math.floor(avg).toLocaleString()}`;

    // Table
    txTableBody.innerHTML = '';

    // Sort by most recent (assuming simple append order for now, 
    // real app would sort by TS, but our TS is string YYYY-MM-DD so generic sort works)
    const reversed = [...transactions].reverse();

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

    // Re-init generic icons for new elements
    if (window.lucide) lucide.createIcons();
}

// Events
function toggleModal(show) {
    txModal.style.display = show ? 'flex' : 'none';
    if (show) document.getElementById('mAmount').focus();
}

refreshBtn.addEventListener('click', () => {
    refreshBtn.querySelector('i').classList.add('spin'); // Add spin class via CSS if we had it
    fetchTransactions();
    setTimeout(() => refreshBtn.querySelector('i').classList.remove('spin'), 1000);
});

addTxBtn.addEventListener('click', () => toggleModal(true));
closeModal.addEventListener('click', () => toggleModal(false));
txModal.addEventListener('click', (e) => {
    if (e.target === txModal) toggleModal(false);
});

txForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = document.getElementById('mAmount').value;
    const status = document.getElementById('mStatus').value;
    addTransaction(amount, status);
});

// Expose delete to window for onclick
window.deleteTransaction = deleteTransaction;

// Init
fetchTransactions();
