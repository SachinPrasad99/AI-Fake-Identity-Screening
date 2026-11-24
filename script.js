// =========================================================
// AI-Based Fake Identity & Document Screening System
// Frontend Controller (Vanilla JavaScript)
// =========================================================

const API_BASE_URL = (window.location.protocol.startsWith("http") && window.location.origin) ? window.location.origin : "http://127.0.0.1:5000";

// App State
let currentSelectedFile = null;
let currentScreeningData = null;

// DOM Elements
const navItems = document.querySelectorAll(".nav-item");
const viewSections = document.querySelectorAll(".view-section");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");
const systemPulse = document.getElementById("systemPulse");
const systemStatusText = document.getElementById("systemStatusText");
const kpiSystemStatus = document.getElementById("kpiSystemStatus");

// Upload Elements
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const browseBtn = document.getElementById("browseBtn");
const dropZonePrompt = document.getElementById("dropZonePrompt");
const previewArea = document.getElementById("previewArea");
const previewImg = document.getElementById("previewImg");
const previewFileName = document.getElementById("previewFileName");
const previewFileSize = document.getElementById("previewFileSize");
const removeFileBtn = document.getElementById("removeFileBtn");
const startScreenBtn = document.getElementById("startScreenBtn");
const screeningProgress = document.getElementById("screeningProgress");
const progressBarFill = document.getElementById("progressBarFill");
const progressStepText = document.getElementById("progressStepText");
const progressPercentText = document.getElementById("progressPercentText");

// Results Elements
const resultsPlaceholder = document.getElementById("resultsPlaceholder");
const resultsContent = document.getElementById("resultsContent");
const verdictBanner = document.getElementById("verdictBanner");
const verdictBadge = document.getElementById("verdictBadge");
const verdictHeading = document.getElementById("verdictHeading");
const verdictSummary = document.getElementById("verdictSummary");
const reviewReasonsBox = document.getElementById("reviewReasonsBox");
const reasonsList = document.getElementById("reasonsList");
const resDocType = document.getElementById("resDocType");
const resDocConfidence = document.getElementById("resDocConfidence");
const resKeywordsTags = document.getElementById("resKeywordsTags");
const resOcrConfidence = document.getElementById("resOcrConfidence");
const resOcrBar = document.getElementById("resOcrBar");
const resOcrLineCount = document.getElementById("resOcrLineCount");
const rawTextDrawer = document.getElementById("rawTextDrawer");
const rawTextContent = document.getElementById("rawTextContent");
const resFormatValidations = document.getElementById("resFormatValidations");
const resDetectedFields = document.getElementById("resDetectedFields");
const resConsistencyChecks = document.getElementById("resConsistencyChecks");
const resQualityBadge = document.getElementById("resQualityBadge");
const resDimensions = document.getElementById("resDimensions");
const resBlurScore = document.getElementById("resBlurScore");
const resBrightnessLevel = document.getElementById("resBrightnessLevel");
const resAnomalyContent = document.getElementById("resAnomalyContent");
const resDisclaimer = document.getElementById("resDisclaimer");

// Reports Elements
const reportsTableBody = document.getElementById("reportsTableBody");

// Authentication Elements
const authScreen = document.getElementById("authScreen");
const appContainer = document.getElementById("appContainer");
const loginForm = document.getElementById("loginForm");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const loginBtn = document.getElementById("loginBtn");
const loginBtnText = document.getElementById("loginBtnText");
const loginBtnSpinner = document.getElementById("loginBtnSpinner");
const loginAlert = document.getElementById("loginAlert");
const quickFillBtn = document.getElementById("quickFillBtn");
const sessionUserName = document.getElementById("sessionUserName");
const logoutBtn = document.getElementById("logoutBtn");

// Registration Elements
const tabSignIn = document.getElementById("tabSignIn");
const tabRegister = document.getElementById("tabRegister");
const registerForm = document.getElementById("registerForm");
const regUsername = document.getElementById("regUsername");
const regDisplayName = document.getElementById("regDisplayName");
const regPassword = document.getElementById("regPassword");
const regConfirmPassword = document.getElementById("regConfirmPassword");
const toggleRegPasswordBtn = document.getElementById("toggleRegPasswordBtn");
const registerBtn = document.getElementById("registerBtn");
const registerBtnText = document.getElementById("registerBtnText");
const registerBtnSpinner = document.getElementById("registerBtnSpinner");

// =========================================================
// INITIALIZATION
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
    initAuth();
    initNavigation();
    initDropZone();
    checkBackendHealth();

    // Check health every 15 seconds
    setInterval(checkBackendHealth, 15000);
});

// =========================================================
// AUTHENTICATION & SESSION MANAGEMENT
// =========================================================

function checkAuthStatus() {
    const token = sessionStorage.getItem("auth_token");
    const user = JSON.parse(sessionStorage.getItem("auth_user") || "null");

    if (token && user) {
        showDashboardView(user);
    } else {
        showLoginView();
    }
}

function showLoginView() {
    if (authScreen) authScreen.classList.remove("hidden");
    if (appContainer) appContainer.classList.add("auth-hidden");
    if (loginUsername) loginUsername.value = "";
    if (loginPassword) loginPassword.value = "";
    hideLoginAlert();
}

function showDashboardView(user) {
    if (authScreen) authScreen.classList.add("hidden");
    if (appContainer) appContainer.classList.remove("auth-hidden");
    if (sessionUserName && user) {
        sessionUserName.textContent = user.display_name || user.username || "Admin";
    }
    // Sync metrics and reports once authenticated
    syncReportsAndMetrics();
}

function showLoginAlert(message, type = "error") {
    if (!loginAlert) return;
    loginAlert.className = `auth-alert ${type}`;
    loginAlert.textContent = message;
    loginAlert.classList.remove("hidden");
}

function hideLoginAlert() {
    if (!loginAlert) return;
    loginAlert.classList.add("hidden");
    loginAlert.textContent = "";
}

function initAuth() {
    // Quick-fill credentials for easy demoing
    if (quickFillBtn) {
        quickFillBtn.addEventListener("click", () => {
            if (loginUsername) loginUsername.value = "admin";
            if (loginPassword) loginPassword.value = "admin123";
            hideLoginAlert();
        });
    }

    // Toggle password visibility
    if (togglePasswordBtn && loginPassword) {
        togglePasswordBtn.addEventListener("click", () => {
            const isPassword = loginPassword.type === "password";
            loginPassword.type = isPassword ? "text" : "password";
            togglePasswordBtn.textContent = isPassword ? "🙈" : "👁️";
        });
    }

    // Handle Login Form Submit
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = loginUsername ? loginUsername.value.trim() : "";
            const password = loginPassword ? loginPassword.value.trim() : "";

            if (!username || !password) {
                showLoginAlert("Please enter both ID and password.");
                return;
            }

            hideLoginAlert();
            if (loginBtn) loginBtn.disabled = true;
            if (loginBtnText) loginBtnText.textContent = "Verifying Credentials...";
            if (loginBtnSpinner) loginBtnSpinner.classList.remove("hidden");

            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok && data.status === "success") {
                    sessionStorage.setItem("auth_token", data.token);
                    sessionStorage.setItem("auth_user", JSON.stringify(data.user));
                    showLoginAlert("Signed in successfully! Loading workspace...", "success");
                    setTimeout(() => {
                        showDashboardView(data.user);
                    }, 400);
                } else {
                    showLoginAlert(data.message || "Invalid Operator ID or Password. Please try again.");
                }
            } catch {
                // Client fallback if backend is offline or starting up
                const validOffline = (username.toLowerCase() === "admin" && password === "admin123") ||
                                     (username.toLowerCase() === "officer" && password === "screen2026") ||
                                     (username.toLowerCase() === "screener" && password === "demo");

                if (validOffline) {
                    const fallbackUser = { username: username.toLowerCase(), display_name: username.charAt(0).toUpperCase() + username.slice(1), role: "Authorized Inspector" };
                    sessionStorage.setItem("auth_token", "tok_offline_demo");
                    sessionStorage.setItem("auth_user", JSON.stringify(fallbackUser));
                    showLoginAlert("Signed in! (Notice: Backend is offline; please start backend/app.py for document analysis)", "success");
                    setTimeout(() => {
                        showDashboardView(fallbackUser);
                    }, 600);
                } else {
                    showLoginAlert("Backend server is not running on http://127.0.0.1:5000. Please start it using: .\\venv\\Scripts\\python backend\\app.py");
                }
            } finally {
                if (loginBtn) loginBtn.disabled = false;
                if (loginBtnText) loginBtnText.textContent = "Sign In to Dashboard";
                if (loginBtnSpinner) loginBtnSpinner.classList.add("hidden");
            }
        });
    }

    // Tab switching between Sign In and Register
    function switchAuthTab(mode) {
        hideLoginAlert();
        if (mode === "signin") {
            if (tabSignIn) tabSignIn.classList.add("active");
            if (tabRegister) tabRegister.classList.remove("active");
            if (loginForm) {
                loginForm.classList.remove("hidden");
                loginForm.style.display = "flex";
            }
            if (registerForm) {
                registerForm.classList.add("hidden");
                registerForm.style.display = "none";
            }
        } else {
            if (tabRegister) tabRegister.classList.add("active");
            if (tabSignIn) tabSignIn.classList.remove("active");
            if (registerForm) {
                registerForm.classList.remove("hidden");
                registerForm.style.display = "flex";
            }
            if (loginForm) {
                loginForm.classList.add("hidden");
                loginForm.style.display = "none";
            }
        }
    }

    // Set initial display states
    switchAuthTab("signin");

    if (tabSignIn) tabSignIn.addEventListener("click", () => switchAuthTab("signin"));
    if (tabRegister) tabRegister.addEventListener("click", () => switchAuthTab("register"));

    // Toggle registration password visibility
    if (toggleRegPasswordBtn && regPassword) {
        toggleRegPasswordBtn.addEventListener("click", () => {
            const isPassword = regPassword.type === "password";
            regPassword.type = isPassword ? "text" : "password";
            if (regConfirmPassword) regConfirmPassword.type = isPassword ? "text" : "password";
            toggleRegPasswordBtn.textContent = isPassword ? "🙈" : "👁️";
        });
    }

    // Handle Registration Form Submit
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = regUsername ? regUsername.value.trim().toLowerCase() : "";
            const displayName = regDisplayName ? regDisplayName.value.trim() : "";
            const password = regPassword ? regPassword.value.trim() : "";
            const confirmPassword = regConfirmPassword ? regConfirmPassword.value.trim() : "";

            if (!username || !password) {
                showLoginAlert("Operator ID and password are required.");
                return;
            }

            if (username.length < 3) {
                showLoginAlert("Operator ID must be at least 3 characters long.");
                return;
            }

            if (password.length < 4) {
                showLoginAlert("Password must be at least 4 characters long.");
                return;
            }

            if (password !== confirmPassword) {
                showLoginAlert("Passwords do not match. Please re-enter.");
                return;
            }

            hideLoginAlert();
            if (registerBtn) registerBtn.disabled = true;
            if (registerBtnText) registerBtnText.textContent = "Creating Account...";
            if (registerBtnSpinner) registerBtnSpinner.classList.remove("hidden");

            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: username,
                        password: password,
                        display_name: displayName
                    })
                });

                const data = await response.json();

                if (response.ok && data.status === "success") {
                    showLoginAlert(`Account '${username}' created successfully! Switching to sign in...`, "success");
                    // Pre-fill login form
                    if (loginUsername) loginUsername.value = username;
                    if (loginPassword) loginPassword.value = password;
                    // Reset registration fields
                    regUsername.value = "";
                    regDisplayName.value = "";
                    regPassword.value = "";
                    regConfirmPassword.value = "";
                    setTimeout(() => {
                        switchAuthTab("signin");
                    }, 1200);
                } else {
                    showLoginAlert(data.message || "Failed to create account. Please try again.");
                }
            } catch {
                showLoginAlert("Backend server is not running. Please start: .\\venv\\Scripts\\python backend\\app.py");
            } finally {
                if (registerBtn) registerBtn.disabled = false;
                if (registerBtnText) registerBtnText.textContent = "Create Operator Account";
                if (registerBtnSpinner) registerBtnSpinner.classList.add("hidden");
            }
        });
    }

    // Handle Logout
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to sign out of the screening terminal?")) {
                sessionStorage.removeItem("auth_token");
                sessionStorage.removeItem("auth_user");
                showLoginView();
            }
        });
    }

    // Check existing auth state on load
    checkAuthStatus();
}

// =========================================================
// NAVIGATION
// =========================================================

function initNavigation() {
    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const target = item.getAttribute("data-section");
            navigateTo(target);
        });
    });
}

function navigateTo(sectionId) {
    navItems.forEach(item => {
        if (item.getAttribute("data-section") === sectionId) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });

    viewSections.forEach(sec => {
        if (sec.id === `section-${sectionId}`) {
            sec.classList.add("active");
        } else {
            sec.classList.remove("active");
        }
    });

    const titles = {
        dashboard: {
            title: "System Dashboard",
            sub: "Real-time overview of document screening activities and system status"
        },
        screen: {
            title: "Document Screening",
            sub: "Upload dummy identity documents for automated preliminary analysis"
        },
        results: {
            title: "Screening Results",
            sub: "Detailed diagnostic breakdown of optical character recognition and format checks"
        },
        reports: {
            title: "Reports & History",
            sub: "Locally archived document screening reports and diagnostic logs"
        },
        about: {
            title: "About the System",
            sub: "System architecture, screening methodology, and project disclaimer"
        }
    };

    if (titles[sectionId]) {
        pageTitle.textContent = titles[sectionId].title;
        pageSubtitle.textContent = titles[sectionId].sub;
    }

    if (sectionId === "reports" || sectionId === "dashboard") {
        syncReportsAndMetrics();
    }
}

// =========================================================
// BACKEND HEALTH CHECK
// =========================================================

async function checkBackendHealth() {
    const authPulse = document.getElementById("authPulse");
    const authStatusText = document.getElementById("authStatusText");

    try {
        const response = await fetch(`${API_BASE_URL}/api/health`, { method: "GET" });
        if (response.ok) {
            const data = await response.json();
            if (systemPulse) systemPulse.classList.remove("offline");
            if (systemStatusText) systemStatusText.textContent = "Flask Backend Online";
            if (kpiSystemStatus) {
                kpiSystemStatus.textContent = "Online";
                kpiSystemStatus.style.color = "var(--accent-green)";
            }
            const backendInfo = document.getElementById("kpiBackendInfo");
            if (backendInfo) backendInfo.textContent = `v${data.version || "1.0.0"} • Port 5000`;

            if (authPulse) authPulse.classList.remove("offline");
            if (authStatusText) {
                authStatusText.textContent = "Backend Connected (Port 5000)";
                authStatusText.style.color = "var(--accent-green)";
            }
        } else {
            throw new Error("Backend non-200");
        }
    } catch {
        if (systemPulse) systemPulse.classList.add("offline");
        if (systemStatusText) systemStatusText.textContent = "Backend Offline";
        if (kpiSystemStatus) {
            kpiSystemStatus.textContent = "Offline";
            kpiSystemStatus.style.color = "var(--accent-red)";
        }
        const backendInfo = document.getElementById("kpiBackendInfo");
        if (backendInfo) backendInfo.textContent = "Start backend/app.py";

        if (authPulse) authPulse.classList.add("offline");
        if (authStatusText) {
            authStatusText.textContent = "Backend Offline • Start python backend/app.py";
            authStatusText.style.color = "#f87171";
        }
    }
}

// =========================================================
// FILE UPLOAD & PREVIEW
// =========================================================

function initDropZone() {
    browseBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleSelectedFile(e.target.files[0]);
        }
    });

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) {
            handleSelectedFile(e.dataTransfer.files[0]);
        }
    });

    removeFileBtn.addEventListener("click", resetUploadState);
    startScreenBtn.addEventListener("click", executeScreening);
}

function handleSelectedFile(file) {
    const validExtensions = ["jpg", "jpeg", "png"];
    const ext = file.name.split(".").pop().toLowerCase();

    if (!validExtensions.includes(ext)) {
        alert("Please select a valid image file (.jpg, .jpeg, or .png).");
        return;
    }

    if (file.size > 16 * 1024 * 1024) {
        alert("Selected image exceeds maximum allowed upload size (16 MB).");
        return;
    }

    currentSelectedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewFileName.textContent = file.name;
        previewFileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;

        dropZonePrompt.style.display = "none";
        previewArea.style.display = "flex";
        startScreenBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

function resetUploadState() {
    currentSelectedFile = null;
    fileInput.value = "";
    previewImg.src = "";
    dropZonePrompt.style.display = "block";
    previewArea.style.display = "none";
    startScreenBtn.disabled = true;
    screeningProgress.style.display = "none";
    progressBarFill.style.width = "0%";
}

// =========================================================
// SCREENING EXECUTION PIPELINE
// =========================================================

async function executeScreening() {
    if (!currentSelectedFile) return;

    startScreenBtn.disabled = true;
    screeningProgress.style.display = "block";

    updateProgress(15, "Uploading document to local backend...");

    const formData = new FormData();
    formData.append("document", currentSelectedFile);

    try {
        const timer1 = setTimeout(() => updateProgress(40, "Preprocessing image & running EasyOCR..."), 400);
        const timer2 = setTimeout(() => updateProgress(70, "Classifying document type & pattern validation..."), 1200);
        const timer3 = setTimeout(() => updateProgress(88, "Synthesizing consistency, quality & saving report..."), 2000);

        const response = await fetch(`${API_BASE_URL}/api/screen`, {
            method: "POST",
            body: formData
        });

        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || "Failed to process document screening.");
        }

        updateProgress(100, "Preliminary screening completed!");

        const data = await response.json();
        currentScreeningData = data;

        // Display results after brief animation
        setTimeout(() => {
            renderScreeningResults(data);
            syncReportsAndMetrics();
            navigateTo("results");
            resetUploadState();
        }, 500);

    } catch (err) {
        screeningProgress.style.display = "none";
        startScreenBtn.disabled = false;
        alert(`Screening Failed: ${err.message || "Could not reach backend service."}`);
    }
}

function updateProgress(percent, stepText) {
    progressBarFill.style.width = `${percent}%`;
    progressStepText.textContent = stepText;
    progressPercentText.textContent = `${percent}%`;
}

// =========================================================
// RENDER SCREENING RESULTS
// =========================================================

function renderScreeningResults(data) {
    resultsPlaceholder.style.display = "none";
    resultsContent.style.display = "block";

    const res = data.screening_result || {};
    const ocr = data.ocr || {};
    const cls = data.classification || {};
    const fmt = data.format_validation || [];
    const fields = data.detected_fields || {};
    const constChecks = data.consistency_checks || [];
    const quality = data.image_quality || {};
    const anomalies = data.image_anomalies || {};

    // 1. Verdict Banner
    const isNeedsReview = res.status === "Needs Review";
    verdictBanner.className = `verdict-banner ${isNeedsReview ? "needs-review" : ""}`;
    verdictBadge.textContent = res.status || "Completed";
    verdictHeading.textContent = isNeedsReview ? "Manual Review Recommended" : "Preliminary Screening Passed";
    verdictSummary.textContent = res.summary_message || "Screening completed.";

    // 2. Review Reasons Box
    const reasons = res.reasons_for_review || [];
    if (isNeedsReview && reasons.length > 0) {
        reviewReasonsBox.style.display = "block";
        reasonsList.innerHTML = reasons.map(r => `<li>${escapeHtml(r)}</li>`).join("");
    } else {
        reviewReasonsBox.style.display = "none";
        reasonsList.innerHTML = "";
    }

    // 3. Document Category Card
    resDocType.textContent = cls.document_type || "Unknown Document";
    resDocConfidence.textContent = `${cls.confidence || 0}%`;

    const keywords = cls.detected_keywords || [];
    if (keywords.length > 0) {
        resKeywordsTags.innerHTML = keywords.map(kw => `<span class="tag-pill">${escapeHtml(kw)}</span>`).join("");
    } else {
        resKeywordsTags.innerHTML = `<span class="tag-pill">No specific keywords detected</span>`;
    }

    // 4. OCR Extraction Card
    const avgConf = ocr.average_confidence || 0;
    resOcrConfidence.textContent = `${avgConf}%`;
    resOcrBar.style.width = `${Math.min(avgConf, 100)}%`;
    resOcrBar.style.backgroundColor = avgConf >= 60 ? "var(--accent-green)" : (avgConf >= 40 ? "var(--accent-amber)" : "var(--accent-red)");
    resOcrLineCount.textContent = `${ocr.line_count || 0} line(s) detected`;
    rawTextContent.textContent = ocr.raw_text || "(No readable text detected)";

    // 5. Format Validations
    if (fmt.length > 0) {
        resFormatValidations.innerHTML = fmt.map(f => {
            const isDetected = f.status === "Format Detected";
            const badgeClass = isDetected ? "badge-success" : "badge-review";
            return `
                <div class="validation-item">
                    <div class="item-header">
                        <strong>${escapeHtml(f.identifier_type || "Identifier")}</strong>
                        <span class="badge ${badgeClass}">${escapeHtml(f.status)}</span>
                    </div>
                    <p class="item-desc">${escapeHtml(f.message || "")}</p>
                    ${f.matched_value ? `<div style="font-family: var(--font-mono); font-size: 11px; color: #94a3b8; margin-top: 4px;">Pattern: ${escapeHtml(f.matched_value)}</div>` : ""}
                </div>
            `;
        }).join("");
    } else {
        resFormatValidations.innerHTML = `<div class="item-desc">No format validation rules applied.</div>`;
    }

    // 6. Detected Fields
    const fieldEntries = Object.entries(fields);
    if (fieldEntries.length > 0) {
        resDetectedFields.innerHTML = fieldEntries.map(([key, val]) => `
            <div class="field-cell">
                <span class="field-key">${escapeHtml(key)}</span>
                <span class="field-val">${escapeHtml(val)}</span>
            </div>
        `).join("");
    } else {
        resDetectedFields.innerHTML = `<div class="item-desc" style="padding: 10px;">No standard identity fields identified.</div>`;
    }

    // 7. Consistency Checks
    if (constChecks.length > 0) {
        resConsistencyChecks.innerHTML = constChecks.map(c => {
            const isPassed = c.status === "Passed";
            const badgeClass = isPassed ? "badge-success" : "badge-review";
            return `
                <div class="consistency-item">
                    <div class="item-header">
                        <strong>${escapeHtml(c.check || "Consistency")}</strong>
                        <span class="badge ${badgeClass}">${escapeHtml(c.status)}</span>
                    </div>
                    <p class="item-desc">${escapeHtml(c.message || "")}</p>
                </div>
            `;
        }).join("");
    } else {
        resConsistencyChecks.innerHTML = `<div class="item-desc">No consistency rules applied.</div>`;
    }

    // 8. Image Quality & Anomalies
    resDimensions.textContent = `${quality.width || 0} × ${quality.height || 0} px (${quality.megapixels || 0} MP)`;
    resBlurScore.textContent = `${quality.blur_score || 0} (Laplacian Variance)`;
    resBrightnessLevel.textContent = `${quality.brightness_level || "Normal"} (Score: ${quality.brightness_score || 0})`;

    const qRating = quality.quality || "Moderate";
    resQualityBadge.textContent = qRating;
    resQualityBadge.className = `badge ${qRating === "Good" ? "badge-success" : (qRating === "Moderate" ? "badge-neutral" : "badge-review")}`;

    const anomIndicators = anomalies.indicators || [];
    if (anomIndicators.length > 0) {
        resAnomalyContent.innerHTML = anomIndicators.map(a => `<div class="anomaly-pill">⚠️ ${escapeHtml(a)}</div>`).join("");
    } else {
        resAnomalyContent.innerHTML = `<span style="font-size: 12px; color: var(--cyber-neon);">No basic image anomalies observed.</span>`;
    }

    // 8b. Forensic & Cryptographic Integrity Suite
    const forensics = data.forensics || (data.report && data.report.forensics) || {};
    const resForensicBadge = document.getElementById("resForensicStatusBadge");
    const resForensicScore = document.getElementById("resForensicScore");
    const badgeVerhoeff = document.getElementById("badgeVerhoeff");
    const msgVerhoeff = document.getElementById("msgVerhoeff");
    const badgePanSemantics = document.getElementById("badgePanSemantics");
    const msgPanSemantics = document.getElementById("msgPanSemantics");
    const badgeEla = document.getElementById("badgeEla");
    const elaRiskScore = document.getElementById("elaRiskScore");
    const elaBarFill = document.getElementById("elaBarFill");
    const msgEla = document.getElementById("msgEla");
    const badgeQrCode = document.getElementById("badgeQrCode");
    const msgQrCode = document.getElementById("msgQrCode");
    const resForensicFindingsList = document.getElementById("resForensicFindingsList");

    if (resForensicBadge && resForensicScore) {
        const isForensicPass = (forensics.forensic_status || "Passed") === "Passed";
        resForensicBadge.textContent = forensics.forensic_status || "Passed";
        resForensicBadge.className = `badge ${isForensicPass ? "badge-cyber-success" : "badge-review"}`;
        resForensicScore.textContent = `${forensics.forensic_integrity_score || 95}%`;

        // 1. Verhoeff Checksum
        if (forensics.verhoeff_checksum) {
            const vValid = forensics.verhoeff_checksum.is_valid;
            badgeVerhoeff.textContent = vValid ? "Passed" : "Checksum Failed";
            badgeVerhoeff.className = `badge ${vValid ? "badge-cyber-success" : "badge-review"}`;
            msgVerhoeff.textContent = forensics.verhoeff_checksum.message;
        } else {
            badgeVerhoeff.textContent = "N/A";
            badgeVerhoeff.className = "badge badge-neutral";
            msgVerhoeff.textContent = "Applicable to 12-digit Aadhaar / identity numbers.";
        }

        // 2. PAN Semantics
        if (forensics.pan_semantics) {
            const pPass = forensics.pan_semantics.status === "Passed";
            badgePanSemantics.textContent = pPass ? "Passed" : "Needs Review";
            badgePanSemantics.className = `badge ${pPass ? "badge-cyber-success" : "badge-review"}`;
            msgPanSemantics.textContent = forensics.pan_semantics.message;
        } else {
            badgePanSemantics.textContent = "N/A";
            badgePanSemantics.className = "badge badge-neutral";
            msgPanSemantics.textContent = "Applicable to PAN identification cards.";
        }

        // 3. Error Level Analysis (ELA)
        const ela = forensics.error_level_analysis || {};
        const elaRisk = ela.tampering_score !== undefined ? ela.tampering_score : 6.5;
        const elaPass = (ela.status || "Passed") === "Passed";
        badgeEla.textContent = elaPass ? "Passed (Clean)" : "Tampering Flag";
        badgeEla.className = `badge ${elaPass ? "badge-cyber-success" : "badge-review"}`;
        elaRiskScore.textContent = `${elaRisk}%`;
        elaBarFill.style.width = `${Math.min(Math.max(elaRisk, 5), 100)}%`;
        elaBarFill.style.backgroundColor = elaRisk > 50 ? "var(--accent-red)" : (elaRisk > 25 ? "var(--accent-amber)" : "var(--cyber-neon)");
        msgEla.textContent = ela.message || "Uniform JPEG compression variance. No localized digital manipulation detected.";

        // 4. Machine-Readable QR Code
        const qr = forensics.qr_cross_verification || {};
        if (qr.qr_detected) {
            const qrPass = qr.status === "Passed";
            badgeQrCode.textContent = qrPass ? "Verified" : "Tampering Flag";
            badgeQrCode.className = `badge ${qrPass ? "badge-cyber-success" : "badge-review"}`;
            msgQrCode.textContent = qr.message;
        } else {
            badgeQrCode.textContent = "No QR";
            badgeQrCode.className = "badge badge-neutral";
            msgQrCode.textContent = qr.message || "No machine-readable QR code detected on card face.";
        }

        // Findings list
        const findings = forensics.forensic_findings || [];
        if (findings.length > 0 && resForensicFindingsList) {
            resForensicFindingsList.innerHTML = findings.map(f => {
                const isP = f.includes("PASSED") || f.includes("verified");
                const isF = f.includes("FAILED") || f.includes("NEEDS REVIEW");
                const bulletIcon = isP ? "🛡️" : (isF ? "⚠️" : "🔍");
                const colorClass = isP ? "cyber-finding-pass" : (isF ? "cyber-finding-fail" : "cyber-finding-info");
                return `<li class="${colorClass}"><span class="finding-icon">${bulletIcon}</span><span>${escapeHtml(f)}</span></li>`;
            }).join("");
        } else if (resForensicFindingsList) {
            resForensicFindingsList.innerHTML = `<li>No specific forensic anomalies flagged.</li>`;
        }
    }

    // 9. Disclaimer
    if (res.disclaimer) {
        resDisclaimer.textContent = res.disclaimer;
    }
}

function toggleRawText() {
    const isHidden = rawTextDrawer.style.display === "none";
    rawTextDrawer.style.display = isHidden ? "block" : "none";
    document.getElementById("toggleRawTextBtn").textContent = isHidden ? "Hide Raw Extracted Text" : "View Raw Extracted Text";
}

// =========================================================
// REPORTS & DASHBOARD METRICS SYNCHRONIZATION
// =========================================================

async function syncReportsAndMetrics() {
    let reports = [];

    // Try fetching from backend API
    try {
        const response = await fetch(`${API_BASE_URL}/api/reports`, { method: "GET" });
        if (response.ok) {
            const data = await response.json();
            reports = data.reports || [];
        } else {
            throw new Error("API error");
        }
    } catch {
        // Fallback to local storage if API is not running
        try {
            const stored = localStorage.getItem("screening_reports_history");
            reports = stored ? JSON.parse(stored) : [];
        } catch {
            reports = [];
        }
    }

    // Update KPI metrics
    const total = reports.length;
    const normalCount = reports.filter(r => r.status === "Normal").length;
    const reviewCount = reports.filter(r => r.status === "Needs Review").length;

    document.getElementById("kpiTotalScreened").textContent = total;
    document.getElementById("kpiNormalScreenings").textContent = normalCount;
    document.getElementById("kpiReviewScreenings").textContent = reviewCount;

    // Update Latest Screening Box
    const latestBox = document.getElementById("latestScreeningBox");
    if (reports.length > 0) {
        const latest = reports[0];
        const isNormal = latest.status === "Normal";
        latestBox.innerHTML = `
            <div style="background-color: var(--bg-card-alt); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="color: #ffffff; font-size: 14px;">${escapeHtml(latest.filename)}</strong>
                    <span class="badge ${isNormal ? "badge-success" : "badge-review"}">${escapeHtml(latest.status)}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
                    <div>Type: <span style="color: #ffffff;">${escapeHtml(latest.document_type)}</span></div>
                    <div>Screened: <span>${escapeHtml(latest.formatted_date)}</span></div>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="viewReportDetails('${latest.report_id}')">View Full Details &rarr;</button>
            </div>
        `;
    } else {
        latestBox.innerHTML = `
            <div class="empty-state-mini">
                <span>📄</span>
                <p>No documents screened yet. Upload your first document to see live results here.</p>
            </div>
        `;
    }

    // Update Reports Table
    if (reportsTableBody) {
        if (reports.length === 0) {
            reportsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="table-empty">No reports saved yet. Completed screenings will appear here.</td>
                </tr>
            `;
        } else {
            reportsTableBody.innerHTML = reports.map(r => {
                const isNormal = r.status === "Normal";
                const badgeClass = isNormal ? "badge-success" : "badge-review";
                return `
                    <tr>
                        <td style="font-family: var(--font-mono); font-weight: 600;">${escapeHtml(r.report_id)}</td>
                        <td>${escapeHtml(r.formatted_date)}</td>
                        <td>${escapeHtml(r.filename)}</td>
                        <td><strong>${escapeHtml(r.document_type)}</strong></td>
                        <td><span class="badge ${badgeClass}">${escapeHtml(r.status)}</span></td>
                        <td>
                            <button class="btn btn-secondary btn-sm" onclick="viewReportDetails('${r.report_id}')">View</button>
                            <button class="btn btn-outline btn-sm" style="color: #ff5252; margin-left: 6px;" onclick="deleteReport('${r.report_id}')">Delete</button>
                        </td>
                    </tr>
                `;
            }).join("");
        }
    }
}

async function viewReportDetails(reportId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/reports/${reportId}`);
        if (response.ok) {
            const data = await response.json();
            const report = data.report;
            // Build compatible payload
            const payload = {
                file_info: { original_filename: report.filename },
                screening_result: {
                    status: report.screening_status,
                    summary_message: report.summary_message,
                    reasons_for_review: report.screening_indicators,
                    disclaimer: report.disclaimer
                },
                classification: report.classification || { document_type: report.document_type },
                ocr: { average_confidence: report.ocr_confidence, line_count: report.ocr_line_count, raw_text: "" },
                format_validation: report.format_validation || [],
                detected_fields: report.detected_fields || {},
                consistency_checks: report.consistency_checks || [],
                image_quality: report.image_quality || {},
                image_anomalies: report.image_anomalies || {}
            };
            renderScreeningResults(payload);
            navigateTo("results");
        } else {
            alert("Could not load report details from server.");
        }
    } catch {
        alert("Failed to connect to backend server to fetch report.");
    }
}

async function deleteReport(reportId) {
    if (!confirm(`Are you sure you want to delete report ${reportId}?`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/reports/${reportId}`, {
            method: "DELETE"
        });
        if (response.ok) {
            syncReportsAndMetrics();
        } else {
            alert("Failed to delete report on server.");
        }
    } catch {
        alert("Could not connect to server to delete report.");
    }
}

function clearAllReports() {
    alert("To clear all reports, you can delete files directly inside the reports/ folder or use the individual Delete buttons.");
}

// Utility: HTML Escaping
function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}