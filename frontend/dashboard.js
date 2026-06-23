// frontend/dashboard.js

/* ─────────────────────────────────────────────
   State
───────────────────────────────────────────── */
let currentUser = null;
let currentWallet = null;

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

function showAlert(boxId, message, isError = true) {
  const box = document.getElementById(boxId);
  if (!box) return;
  box.textContent = message;
  box.className = isError ? "alert alert-error" : "alert alert-success";
  box.style.display = "block";
}

function hideAlert(boxId) {
  const box = document.getElementById(boxId);
  if (!box) return;
  box.textContent = "";
  box.style.display = "none";
}

/* ─────────────────────────────────────────────
   Panel helpers
───────────────────────────────────────────── */
const overlay = document.getElementById("panel-overlay");

function openPanel(panelId) {
  closeAllPanels();
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add("open");
  overlay.classList.add("open");
}

function closeAllPanels() {
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("open"));
  overlay.classList.remove("open");
}

overlay.addEventListener("click", closeAllPanels);

/* ─────────────────────────────────────────────
   Load profile
───────────────────────────────────────────── */
async function loadProfile() {
  try {
    const res = await fetch("/api/auth/profile", {
      method: "GET",
      credentials: "include",
    });

    if (res.status === 401 || res.status === 403) {
      window.location.href = "/login";
      return;
    }

    const data = await res.json();

    if (!res.ok || !data.success) {
      window.location.href = "/login";
      return;
    }

    currentUser = data.user;
    currentWallet = data.wallet;

    // Welcome
    document.getElementById("dashboard-user-name").textContent = currentUser.name;

    // Balance card
    document.getElementById("dashboard-user-balance").textContent =
      currentWallet ? formatCurrency(currentWallet.balance, currentWallet.currency) : "—";
    document.getElementById("dashboard-acct-display").textContent =
      `Account No. ${currentUser.accountNumber}`;

    // Status badge
    const statusBadge = document.getElementById("dashboard-status-badge");
    if (currentUser.isFrozen) {
      statusBadge.textContent = "Frozen";
      statusBadge.className = "badge badge-frozen";
    } else {
      statusBadge.textContent = "Active";
      statusBadge.className = "badge badge-active";
    }

    // Account info panel
    document.getElementById("info-name").textContent = currentUser.name;
    document.getElementById("info-account-number").textContent = currentUser.accountNumber;
    document.getElementById("info-email").textContent = currentUser.email;
    document.getElementById("info-wallet-id").textContent = currentWallet ? currentWallet.id : "—";
    document.getElementById("info-balance").textContent =
      currentWallet ? formatCurrency(currentWallet.balance, currentWallet.currency) : "—";
    document.getElementById("info-date").textContent = formatDate(currentUser.dateCreated);

    // Load recent transactions
    loadRecentTransactions();
  } catch (err) {
    window.location.href = "/login";
  }
}

/* ─────────────────────────────────────────────
   Transactions
───────────────────────────────────────────── */
function buildTxnItem(txn) {
  const isCredit =
    txn.transactionType === "DEPOSIT" ||
    (txn.transactionType === "TRANSFER" &&
      currentWallet &&
      txn.receiverWalletId === currentWallet.id);
  const sign = isCredit ? "+" : "-";
  const amountClass = isCredit ? "txn-amount credit" : "txn-amount debit";

  let label = "";
  if (txn.transactionType === "DEPOSIT") {
    label = "Deposit";
  } else if (txn.transactionType === "WITHDRAW") {
    label = "Withdrawal";
  } else if (txn.transactionType === "TRANSFER") {
    if (isCredit) {
      label = `Transfer from ${txn.senderName || txn.senderAccNumber || "Unknown"}`;
    } else {
      label = `Transfer to ${txn.recvName || txn.recvAccNumber || "Unknown"}`;
    }
  }

  const item = document.createElement("div");
  item.className = "txn-item";
  item.innerHTML = `
    <div class="txn-meta">
      <p class="txn-type">${label}</p>
      <p class="txn-date">${formatDate(txn.createTime)}</p>
    </div>
    <p class="${amountClass}">${sign}${formatCurrency(txn.amount, txn.senderCurrency || txn.recvCurrency || "PKR")}</p>
  `;
  return item;
}

async function loadRecentTransactions() {
  const container = document.getElementById("recent-txn-list");
  try {
    const res = await fetch("/api/wallet/transactions", {
      credentials: "include",
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      container.innerHTML = `<p class="txn-empty">Could not load transactions.</p>`;
      return;
    }

    const transactions = data.transactions;
    if (!transactions || transactions.length === 0) {
      container.innerHTML = `<p class="txn-empty">No transactions yet.</p>`;
      return;
    }

    container.innerHTML = "";
    transactions.slice(0, 5).forEach((txn) => {
      container.appendChild(buildTxnItem(txn));
    });
  } catch (err) {
    container.innerHTML = `<p class="txn-empty">Could not load transactions.</p>`;
  }
}

async function loadAllTransactions() {
  const container = document.getElementById("txn-list-container");
  container.innerHTML = `<p class="txn-empty">Loading…</p>`;
  try {
    const res = await fetch("/api/wallet/transactions", {
      credentials: "include",
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      container.innerHTML = `<p class="txn-empty">Could not load transactions.</p>`;
      return;
    }

    const transactions = data.transactions;
    if (!transactions || transactions.length === 0) {
      container.innerHTML = `<p class="txn-empty">No transactions yet.</p>`;
      return;
    }

    container.innerHTML = "";
    transactions.forEach((txn) => {
      container.appendChild(buildTxnItem(txn));
    });
  } catch (err) {
    container.innerHTML = `<p class="txn-empty">Could not load transactions.</p>`;
  }
}

/* ─────────────────────────────────────────────
   Update balance everywhere after a transaction
───────────────────────────────────────────── */
function updateDisplayedBalance(newBalance) {
  const currency = currentWallet ? currentWallet.currency : "PKR";
  if (currentWallet) currentWallet.balance = newBalance;

  document.getElementById("dashboard-user-balance").textContent =
    formatCurrency(newBalance, currency);
  document.getElementById("info-balance").textContent =
    formatCurrency(newBalance, currency);
}

/* ─────────────────────────────────────────────
   Deposit
───────────────────────────────────────────── */
const depositForm = document.getElementById("deposit-form");
const depositInput = document.getElementById("deposit-input");

depositForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert("deposit-alert");

  const amount = parseFloat(depositInput.value);
  if (!amount || amount <= 0) {
    showAlert("deposit-alert", "Please enter a valid amount.");
    return;
  }

  const btn = document.getElementById("deposit-submit");
  btn.disabled = true;
  btn.textContent = "Processing…";

  try {
    const res = await fetch("/api/wallet/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();

    if (res.ok && data.success) {
      updateDisplayedBalance(data.newBalance);
      loadRecentTransactions();
      depositInput.value = "";
      showAlert("deposit-alert", "Deposit successful!", false);
    } else {
      showAlert("deposit-alert", data.error || "Deposit failed.");
    }
  } catch (err) {
    showAlert("deposit-alert", "Network error. Please try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Deposit";
  }
});

/* ─────────────────────────────────────────────
   Withdraw
───────────────────────────────────────────── */
const withdrawForm = document.getElementById("withdraw-form");
const withdrawInput = document.getElementById("withdraw-input");
const remainingBalanceSpan = document.getElementById("remaining-balance");

withdrawInput.addEventListener("input", () => {
  const amount = parseFloat(withdrawInput.value) || 0;
  const balance = currentWallet ? parseFloat(currentWallet.balance) : 0;
  const remaining = balance - amount;
  const currency = currentWallet ? currentWallet.currency : "PKR";
  remainingBalanceSpan.textContent =
    remaining >= 0 ? formatCurrency(remaining, currency) : "Insufficient funds";
  remainingBalanceSpan.style.color = remaining >= 0 ? "" : "var(--danger)";
});

withdrawForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert("withdraw-alert");

  const amount = parseFloat(withdrawInput.value);
  if (!amount || amount <= 0) {
    showAlert("withdraw-alert", "Please enter a valid amount.");
    return;
  }

  const btn = document.getElementById("withdraw-submit");
  btn.disabled = true;
  btn.textContent = "Processing…";

  try {
    const res = await fetch("/api/wallet/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();

    if (res.ok && data.success) {
      updateDisplayedBalance(data.newBalance);
      loadRecentTransactions();
      withdrawInput.value = "";
      remainingBalanceSpan.textContent = "—";
      remainingBalanceSpan.style.color = "";
      showAlert("withdraw-alert", "Withdrawal successful!", false);
    } else {
      showAlert("withdraw-alert", data.error || "Withdrawal failed.");
    }
  } catch (err) {
    showAlert("withdraw-alert", "Network error. Please try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Withdraw";
  }
});

/* ─────────────────────────────────────────────
   Transfer
───────────────────────────────────────────── */
const transferForm = document.getElementById("transfer-form");
const transferAmountInput = document.getElementById("transfer-amount-input");
const transferRemainingSpan = document.getElementById("transfer-remaining-balance");

transferAmountInput.addEventListener("input", () => {
  const amount = parseFloat(transferAmountInput.value) || 0;
  const balance = currentWallet ? parseFloat(currentWallet.balance) : 0;
  const remaining = balance - amount;
  const currency = currentWallet ? currentWallet.currency : "PKR";
  transferRemainingSpan.textContent =
    remaining >= 0 ? formatCurrency(remaining, currency) : "Insufficient funds";
  transferRemainingSpan.style.color = remaining >= 0 ? "" : "var(--danger)";
});

transferForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert("transfer-alert");

  const recipient = document.getElementById("transfer-recipient-input").value.trim();
  const amount = parseFloat(transferAmountInput.value);

  if (!recipient) {
    showAlert("transfer-alert", "Please enter a recipient email or Wallet ID.");
    return;
  }
  if (!amount || amount <= 0) {
    showAlert("transfer-alert", "Please enter a valid amount.");
    return;
  }

  const btn = document.getElementById("transfer-submit");
  btn.disabled = true;
  btn.textContent = "Processing…";

  try {
    const res = await fetch("/api/wallet/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ amount, recipient }),
    });
    const data = await res.json();

    if (res.ok && data.success) {
      updateDisplayedBalance(data.newBalance);
      loadRecentTransactions();
      document.getElementById("transfer-recipient-input").value = "";
      transferAmountInput.value = "";
      transferRemainingSpan.textContent = "—";
      transferRemainingSpan.style.color = "";
      showAlert("transfer-alert", "Transfer successful!", false);
    } else {
      showAlert("transfer-alert", data.error || "Transfer failed.");
    }
  } catch (err) {
    showAlert("transfer-alert", "Network error. Please try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Transfer";
  }
});

/* ─────────────────────────────────────────────
   Logout
───────────────────────────────────────────── */
document.getElementById("dash-logout-btn").addEventListener("click", () => {
  window.location.href = "/login";
});

/* ─────────────────────────────────────────────
   Panel open/close bindings
───────────────────────────────────────────── */
document.getElementById("dash-account-info-btn").addEventListener("click", () => {
  openPanel("account-info-panel");
});

document.getElementById("close-account-info").addEventListener("click", closeAllPanels);

document.getElementById("deposit-action-button").addEventListener("click", () => {
  hideAlert("deposit-alert");
  openPanel("deposit-panel");
});
document.getElementById("close-deposit-panel").addEventListener("click", closeAllPanels);

document.getElementById("withdraw-action-button").addEventListener("click", () => {
  hideAlert("withdraw-alert");
  remainingBalanceSpan.textContent = "—";
  remainingBalanceSpan.style.color = "";
  openPanel("withdraw-panel");
});
document.getElementById("close-withdraw-panel").addEventListener("click", closeAllPanels);

document.getElementById("transfer-action-button").addEventListener("click", () => {
  hideAlert("transfer-alert");
  transferRemainingSpan.textContent = "—";
  transferRemainingSpan.style.color = "";
  openPanel("transfer-panel");
});
document.getElementById("close-transfer-panel").addEventListener("click", closeAllPanels);

document.getElementById("txn-history-action-button").addEventListener("click", () => {
  openPanel("txn-history-panel");
  loadAllTransactions();
});
document.getElementById("close-txn-history-panel").addEventListener("click", closeAllPanels);

/* ─────────────────────────────────────────────
   Init
───────────────────────────────────────────── */
loadProfile();