const STORAGE_PREDICTIONS = "complaintPredictionHistory";
const STORAGE_USERS = "registeredUsers";
const STORAGE_CURRENT_USER = "currentUserEmail";

function getStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn(`Unable to read ${key}`, error);
    return [];
  }
}

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getUsers() {
  return getStorage(STORAGE_USERS);
}

function saveUser(user) {
  const users = getUsers();
  users.push(user);
  saveStorage(STORAGE_USERS, users);
}

function findUserByEmail(email) {
  const normalized = (email || "").trim().toLowerCase();
  return getUsers().find((user) => user.email.toLowerCase() === normalized) || null;
}

function setCurrentUser(email) {
  localStorage.setItem(STORAGE_CURRENT_USER, (email || "").trim().toLowerCase());
}

function getCurrentUserEmail() {
  return localStorage.getItem(STORAGE_CURRENT_USER) || "";
}

function clearCurrentUser() {
  localStorage.removeItem(STORAGE_CURRENT_USER);
}

function showMessage(target, message, isError = false) {
  if (!target) return;
  target.textContent = message;
  target.style.color = isError ? "#b91c1c" : "#0f5132";
}

function formatCategory(category) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function normalizeText(value) {
  return (value || "").trim().toLowerCase();
}

function predictComplaintSeverity(text, category) {
  const lowerText = normalizeText(text);
  let score = 0;

  const urgentWords = [
    "urgent",
    "asap",
    "immediately",
    "danger",
    "emergency",
    "accident",
    "unsafe",
    "fire",
    "injury",
    "threat",
    "attack",
    "collapse"
  ];
  const problemWords = [
    "broken",
    "not working",
    "late",
    "delay",
    "refund",
    "overcharge",
    "leak",
    "power",
    "outage",
    "failure",
    "error",
    "incorrect"
  ];

  urgentWords.forEach((word) => {
    if (lowerText.includes(word)) score += 18;
  });
  problemWords.forEach((word) => {
    if (lowerText.includes(word)) score += 12;
  });

  if (category === "safety") score += 20;
  if (category === "service") score += 14;
  if (category === "billing") score += 10;
  if (category === "general") score += 6;

  const wordCount = lowerText.split(/\s+/).filter(Boolean).length;
  if (wordCount > 20) score += 10;
  if (wordCount > 40) score += 6;

  if (lowerText.length > 200) score += 8;
  if (lowerText.length < 50) score -= 4;

  const severity = score >= 70 ? "High" : score >= 35 ? "Medium" : "Low";
  const action = severity === "High"
    ? "Review immediately"
    : severity === "Medium"
    ? "Escalate for follow-up"
    : "Monitor and respond in normal time";

  const confidence = Math.min(98, Math.max(55, 40 + Math.round(score / 1.3)));

  return { severity, action, confidence };
}

function buildPrediction(formData) {
  const prediction = predictComplaintSeverity(formData.complaint, formData.category);

  return {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    name: formData.name,
    email: formData.email,
    category: formData.category,
    complaint: formData.complaint,
    severity: prediction.severity,
    confidence: prediction.confidence,
    action: prediction.action,
    summary: `Complaint predicted as ${prediction.severity} severity with ${prediction.confidence}% confidence.`
  };
}

function getPredictions() {
  return getStorage(STORAGE_PREDICTIONS);
}

function savePrediction(prediction) {
  const items = getPredictions();
  items.unshift(prediction);
  saveStorage(STORAGE_PREDICTIONS, items.slice(0, 20));
}

function getLastPrediction() {
  return getPredictions()[0] || null;
}

function showInlinePrediction(prediction) {
  const container = document.getElementById("prediction-result");
  if (!container) return;

  container.innerHTML = `
    <div class="inline-card">
      <strong>${prediction.summary}</strong>
      <p>Category: ${formatCategory(prediction.category)} · Severity: ${prediction.severity} · Confidence: ${prediction.confidence}%</p>
      <p>${prediction.action}</p>
    </div>
  `;
}

function renderTrackResults(items, target) {
  if (!target) return;
  if (!items || items.length === 0) {
    target.innerHTML = "<p>No matching complaints found.</p>";
    return;
  }

  target.innerHTML = items
    .map((item) => {
      return `
        <div class="track-item">
          <strong>ID:</strong> ${item.id}<br>
          <strong>Severity:</strong> ${item.severity}<br>
          <strong>Category:</strong> ${formatCategory(item.category)}<br>
          <strong>Submitted by:</strong> ${item.name} (${item.email})<br>
          <strong>Confidence:</strong> ${item.confidence}%<br>
          <strong>Action:</strong> ${item.action}<br>
          <p>${item.complaint}</p>
          <hr>
        </div>
      `;
    })
    .join("");
}

function initComplaintForm() {
  const form = document.getElementById("complaint-form");
  if (!form) return;

  const prefillingEmail = getCurrentUserEmail();
  if (prefillingEmail) {
    const emailInput = document.getElementById("c-email");
    if (emailInput && !emailInput.value) {
      emailInput.value = prefillingEmail;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = {
      name: document.getElementById("c-name")?.value || "Anonymous",
      email: document.getElementById("c-email")?.value || getCurrentUserEmail() || "unknown@example.com",
      category: document.getElementById("c-category")?.value || "general",
      complaint: document.getElementById("c-text")?.value || ""
    };

    const prediction = buildPrediction(formData);
    savePrediction(prediction);
    showInlinePrediction(prediction);

    setTimeout(() => {
      window.location.href = "prediction_result.html";
    }, 1000);
  });
}

function initPredictionPage() {
  const statusValue = document.getElementById("status-value");
  if (!statusValue) return;

  const prediction = getLastPrediction();
  if (!prediction) {
    statusValue.textContent = "No data";
    document.getElementById("details-text").textContent = "No prediction history found. Please submit a complaint first.";
    document.getElementById("confidence-value").textContent = "—";
    document.getElementById("category-value").textContent = "—";
    document.getElementById("action-value").textContent = "—";
    statusValue.classList.remove("high", "medium", "low");
    return;
  }

  statusValue.textContent = prediction.severity;
  statusValue.classList.remove("high", "medium", "low");
  statusValue.classList.add(prediction.severity.toLowerCase());
  document.getElementById("details-text").innerHTML = `The complaint is predicted to be <strong>${prediction.severity} priority</strong>. ${prediction.summary}`;
  document.getElementById("confidence-value").textContent = `${prediction.confidence}%`;
  document.getElementById("category-value").textContent = formatCategory(prediction.category);
  document.getElementById("action-value").textContent = prediction.action;
}

function initLoginPage() {
  const form = document.getElementById("login-form");
  if (!form) return;

  const alertBox = document.getElementById("alert");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = document.getElementById("login-email")?.value.trim();
    const password = document.getElementById("login-password")?.value;
    const user = findUserByEmail(email);

    if (!email || !password) {
      showMessage(alertBox, "Enter both email and password.", true);
      return;
    }

    if (!user || user.password !== password) {
      showMessage(alertBox, "Invalid email or password.", true);
      return;
    }

    setCurrentUser(user.email);
    window.location.href = "submit_complaint.html";
  });
}

function initRegisterPage() {
  const form = document.getElementById("register-form");
  if (!form) return;

  const alertBox = document.getElementById("alert");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = document.getElementById("register-name")?.value.trim();
    const email = document.getElementById("register-email")?.value.trim();
    const phone = document.getElementById("register-phone")?.value.trim();
    const password = document.getElementById("register-password")?.value;
    const confirmPassword = document.getElementById("register-confirm-password")?.value;
    const acceptedTerms = document.getElementById("terms")?.checked;

    if (!name || !email || !phone || !password || !confirmPassword) {
      showMessage(alertBox, "Please complete all fields.", true);
      return;
    }

    if (password !== confirmPassword) {
      showMessage(alertBox, "Passwords do not match.", true);
      return;
    }

    if (!acceptedTerms) {
      showMessage(alertBox, "You must accept the terms and conditions.", true);
      return;
    }

    if (findUserByEmail(email)) {
      showMessage(alertBox, "An account with this email already exists.", true);
      return;
    }

    saveUser({ name, email, phone, password });
    setCurrentUser(email);
    showMessage(alertBox, "Registration successful! Redirecting to complaint form...");
    setTimeout(() => {
      window.location.href = "submit_complaint.html";
    }, 1200);
  });
}

function initHomePage() {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const feedback = document.getElementById("contact-feedback");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = document.getElementById("contact-name")?.value.trim();
    const email = document.getElementById("contact-email")?.value.trim();
    const message = document.getElementById("contact-message")?.value.trim();

    if (!name || !email || !message) {
      showMessage(feedback, "Please enter all fields before sending.", true);
      return;
    }

    showMessage(feedback, "Thanks! Your message has been received.");
    form.reset();
  });
}

function initTrackStatusPage() {
  const findButton = document.getElementById("find-btn");
  const showButton = document.getElementById("show-my");
  const output = document.getElementById("track-output");
  const searchInput = document.getElementById("complaint-id");
  if (!output || (!findButton && !showButton)) return;

  const allComplaints = getPredictions();

  findButton?.addEventListener("click", () => {
    const idValue = searchInput?.value.trim();
    if (!idValue) {
      output.innerHTML = "<p>Please enter a complaint ID to search.</p>";
      return;
    }

    const matches = allComplaints.filter((item) => item.id.toString() === idValue);
    renderTrackResults(matches, output);
  });

  showButton?.addEventListener("click", () => {
    const currentEmail = getCurrentUserEmail();
    const matches = currentEmail
      ? allComplaints.filter((item) => item.email.toLowerCase() === currentEmail.toLowerCase())
      : allComplaints;

    if (matches.length === 0) {
      output.innerHTML = currentEmail
        ? "<p>No complaints found for your account.</p>"
        : "<p>No complaints available yet. Submit a complaint first.</p>";
      return;
    }

    renderTrackResults(matches, output);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  initComplaintForm();
  initPredictionPage();
  initLoginPage();
  initRegisterPage();
  initHomePage();
  initTrackStatusPage();
});
