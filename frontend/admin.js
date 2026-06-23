// frontend/admin.js

/* ─────────────────────────────────────────────
   State
───────────────────────────────────────────── */
let allUsers = [];

/* ─────────────────────────────────────────────
   Utility helpers
───────────────────────────────────────────── */
function formatCurrency(amount, currency = "PKR") {
  return `${currency} ${parseFloat(amount).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function showLoginAlert(message) {
  const box = document.getElementById("admin-alert");
  box.textContent = message;
  box.style.display = "block";
}

function hideLoginAlert() {
  const box = document.getElementById("admin-alert");
  box.textContent = "";
  box.style.display = "none";
}

/* ─────────────────────────────────────────────
   Login flow
───────────────────────────────────────────── */
const loginForm = document.getElementById("admin-login-form");
const loginBtn = document.getElementById("admin-login-btn");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideLoginAlert();

  const password = document.getElementById("admin-password-input").value;

  if (!password) {
    showLoginAlert("Please enter the admin password.");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Verifying…";

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showAdminPanel();
    } else {
      showLoginAlert(data.error || "Incorrect password.");
      loginBtn.disabled = false;
      loginBtn.textContent = "Access Panel";
    }
  } catch (err) {
    showLoginAlert("Network error. Please try again.");
    loginBtn.disabled = false;
    loginBtn.textContent = "Access Panel";
  }
});

/* ─────────────────────────────────────────────
   Show admin panel (hide login card, build UI)
───────────────────────────────────────────── */
function showAdminPanel() {
  // Replace the auth-main content with the admin panel
  const authMain = document.querySelector(".auth-main");
  authMain.innerHTML = buildAdminShell();
  loadUsers();
}

function buildAdminShell() {
  return `
    <div class="admin-panel">
      <div class="admin-panel-header">
        <h1>Admin Panel</h1>
        <div class="admin-stats" id="admin-stats">
          <span class="admin-stat"><span id="stat-total">—</span> Total</span>
          <span class="admin-stat"><span id="stat-active">—</span> Active</span>
          <span class="admin-stat"><span id="stat-frozen">—</span> Frozen</span>
        </div>
      </div>

      <div id="admin-panel-alert" class="alert" role="alert" style="display:none;"></div>

      <div class="admin-table-wrap">
        <table class="admin-table" id="admin-users-table">
          <thead>
            <tr>
              <th>Account No.</th>
              <th>Name</th>
              <th>Email</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="admin-users-tbody">
            <tr><td colspan="7" style="text-align:center; padding: 2rem;">Loading users…</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Transaction modal -->
      <div class="admin-modal-overlay" id="admin-modal-overlay">
        <div class="admin-modal" id="admin-modal">
          <div class="admin-modal-header">
            <h3 id="admin-modal-title">Transaction History</h3>
            <button class="panel-close" id="admin-modal-close">✕</button>
          </div>
          <div class="txn-list" id="admin-modal-txn-list">
            <p class="txn-empty">Loading…</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ─────────────────────────────────────────────
   Load users
───────────────────────────────────────────── */
async function loadUsers() {
  try {
    const res = await fetch("/api/admin/users", {
      credentials: "include",
    });

    if (res.status === 401) {
      window.location.reload();
      return;
    }

    const data = await res.json();

    if (!res.ok || !data.success) {
      showPanelAlert(data.error || "Failed to load users.", true);
      return;
    }

    allUsers = data.users;
    renderUsersTable(allUsers);
    updateStats(allUsers);

    // Bind modal close
    document.getElementById("admin-modal-close").addEventListener("click", closeModal);
    document.getElementById("admin-modal-overlay").addEventListener("click", (e) => {
      if (e.target === document.getElementById("admin-modal-overlay")) closeModal();
    });
  } catch (err) {
    showPanelAlert("Network error loading users.", true);
  }
}

function updateStats(users) {
  const active = users.filter((u) => !u.isFrozen && !u.isDeleted).length;
  const frozen = users.filter((u) => u.isFrozen && !u.isDeleted).length;
  const total = users.filter((u) => !u.isDeleted).length;

  const statTotal = document.getElementById("stat-total");
  const statActive = document.getElementById("stat-active");
  const statFrozen = document.getElementById("stat-frozen");
  if (statTotal) statTotal.textContent = total;
  if (statActive) statActive.textContent = active;
  if (statFrozen) statFrozen.textContent = frozen;
}

function renderUsersTable(users) {
  const tbody = document.getElementById("admin-users-tbody");
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;">No users found.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  users.forEach((user) => {
    const isFrozen = user.isFrozen;
    const isDeleted = user.isDeleted;

    const row = document.createElement("tr");
    if (isDeleted) row.classList.add("row-deleted");

    row.innerHTML = `
      <td class="mono">${user.accountNumber}</td>
      <td>${escapeHtml(user.name)}</td>
      <td>${escapeHtml(user.email)}</td>
      <td>${formatCurrency(user.balance, user.currency)}</td>
      <td>
        <span class="badge ${isDeleted ? "badge-deleted" : isFrozen ? "badge-frozen" : "badge-active"}">
          ${isDeleted ? "Deleted" : isFrozen ? "Frozen" : "Active"}
        </span>
      </td>
      <td>${formatDate(user.creatTime)}</td>
      <td class="admin-actions-cell">
        ${!isDeleted ? `
          <button class="btn btn-sm btn-ghost" onclick="viewTransactions(${user.id}, '${escapeHtml(user.name)}')">History</button>
          <button class="btn btn-sm ${isFrozen ? "btn-secondary" : "btn-warning"}" onclick="toggleFreeze(${user.id}, ${!isFrozen})">
            ${isFrozen ? "Unfreeze" : "Freeze"}
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})">Delete</button>
        ` : `<span style="opacity:0.4; font-size:0.8rem;">—</span>`}
      </td>
    `;
    tbody.appendChild(row);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ─────────────────────────────────────────────
   Admin actions
───────────────────────────────────────────── */
async function toggleFreeze(userId, freeze) {
  hidePanelAlert();
  try {
    const res = await fetch(`/api/admin/users/${userId}/freeze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ frozen: freeze }),
    });
    const data = await res.json();

    if (res.ok && data.success) {
      // Update local state
      const user = allUsers.find((u) => u.id === userId);
      if (user) user.isFrozen = freeze;
      renderUsersTable(allUsers);
      updateStats(allUsers);
      showPanelAlert(data.message || (freeze ? "User frozen." : "User unfrozen."), false);
    } else {
      showPanelAlert(data.error || "Action failed.", true);
    }
  } catch (err) {
    showPanelAlert("Network error.", true);
  }
}

async function deleteUser(userId) {
  if (!confirm("Are you sure you want to delete this user? This action marks the account as deleted.")) {
    return;
  }
  hidePanelAlert();
  try {
    const res = await fetch(`/api/admin/users/${userId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    const data = await res.json();

    if (res.ok && data.success) {
      const user = allUsers.find((u) => u.id === userId);
      if (user) user.isDeleted = true;
      renderUsersTable(allUsers);
      updateStats(allUsers);
      showPanelAlert("User deleted.", false);
    } else {
      showPanelAlert(data.error || "Delete failed.", true);
    }
  } catch (err) {
    showPanelAlert("Network error.", true);
  }
}

async function viewTransactions(userId, userName) {
  const modal = document.getElementById("admin-modal-overlay");
  const title = document.getElementById("admin-modal-title");
  const list = document.getElementById("admin-modal-txn-list");

  title.textContent = `Transactions — ${userName}`;
  list.innerHTML = `<p class="txn-empty">Loading…</p>`;
  modal.style.display = "flex";

  try {
    const res = await fetch(`/api/admin/users/${userId}/transactions`, {
      credentials: "include",
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      list.innerHTML = `<p class="txn-empty">Could not load transactions.</p>`;
      return;
    }

    const transactions = data.transactions;
    if (!transactions || transactions.length === 0) {
      list.innerHTML = `<p class="txn-empty">No transactions for this user.</p>`;
      return;
    }

    list.innerHTML = "";
    transactions.forEach((txn) => {
      const item = document.createElement("div");
      item.className = "txn-item";

      let label = "";
      let sign = "";
      let amountClass = "";

      if (txn.transactionType === "DEPOSIT") {
        label = `Deposit`;
        sign = "+";
        amountClass = "txn-amount-credit";
      } else if (txn.transactionType === "WITHDRAW") {
        label = `Withdrawal`;
        sign = "-";
        amountClass = "txn-amount-debit";
      } else if (txn.transactionType === "TRANSFER") {
        // For admin view we show who sent to whom
        const from = txn.senderName || txn.senderAccNumber || "Unknown";
        const to = txn.recvName || txn.recvAccNumber || "Unknown";
        label = `Transfer: ${from} → ${to}`;
        sign = "";
        amountClass = "txn-amount-debit";
      }

      item.innerHTML = `
        <div class="txn-item-left">
          <p class="txn-label">${label}</p>
          <p class="txn-date">${formatDate(txn.createTime)}</p>
        </div>
        <p class="txn-amount ${amountClass}">${sign}${formatCurrency(txn.amount, txn.senderCurrency || txn.recvCurrency || "PKR")}</p>
      `;
      list.appendChild(item);
    });
  } catch (err) {
    list.innerHTML = `<p class="txn-empty">Network error loading transactions.</p>`;
  }
}

function closeModal() {
  const modal = document.getElementById("admin-modal-overlay");
  if (modal) modal.style.display = "none";
}

/* ─────────────────────────────────────────────
   Panel-level alert (inside admin panel)
───────────────────────────────────────────── */
function showPanelAlert(message, isError = true) {
  const box = document.getElementById("admin-panel-alert");
  if (!box) return;
  box.textContent = message;
  box.className = isError ? "alert alert-error" : "alert alert-success";
  box.style.display = "block";
  setTimeout(() => { box.style.display = "none"; }, 4000);
}

function hidePanelAlert() {
  const box = document.getElementById("admin-panel-alert");
  if (box) box.style.display = "none";
}

/* ─────────────────────────────────────────────
   Expose action functions to global scope
   (called from inline onclick in generated HTML)
───────────────────────────────────────────── */
window.toggleFreeze = toggleFreeze;
window.deleteUser = deleteUser;
window.viewTransactions = viewTransactions;