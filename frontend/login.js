// frontend/login.js

const form = document.getElementById("login-form");
const alertBox = document.getElementById("login-alert");
const submitBtn = document.getElementById("login-submit");

function showAlert(message) {
  alertBox.textContent = message;
  alertBox.style.display = "block";
}

function hideAlert() {
  alertBox.textContent = "";
  alertBox.style.display = "none";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();

  const accountNumber = document.getElementById("login-account-number").value.trim();
  const password = document.getElementById("login-password").value;

  if (!accountNumber || !password) {
    showAlert("Please enter your account number and password.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in…";

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accountNumber, password }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      window.location.href = "/dashboard";
    } else {
      showAlert(data.error || "Login failed. Please try again.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Log In";
    }
  } catch (err) {
    showAlert("Network error. Please check your connection.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Log In";
  }
});