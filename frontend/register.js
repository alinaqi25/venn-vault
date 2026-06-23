// frontend/register.js

const form = document.getElementById("register-form");
const alertBox = document.getElementById("register-alert");
const submitBtn = document.getElementById("register-submit");

function showAlert(message, isError = true) {
  alertBox.textContent = message;
  alertBox.className = isError ? "alert alert-error" : "alert alert-success";
  alertBox.style.display = "block";
}

function hideAlert() {
  alertBox.textContent = "";
  alertBox.style.display = "none";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();

  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;

  if (!name || !email || !password) {
    showAlert("Please fill in all fields.");
    return;
  }

  if (password.length < 8) {
    showAlert("Password must be at least 8 characters.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Creating account…";

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      window.location.href = "/dashboard.html";
    } else {
      showAlert(data.error || "Registration failed. Please try again.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Account";
    }
  } catch (err) {
    showAlert("Network error. Please check your connection.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Create Account";
  }
});