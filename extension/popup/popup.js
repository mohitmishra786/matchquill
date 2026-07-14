/**
 * MatchQuill Popup Script
 * Handles popup UI interactions and communication with background
 */

// State
let currentConfig = null;

// State
let currentJob = null;
let compiledResume = null;
let coverLetter = null;

// DOM Elements
const elements = {
    authStatus: document.getElementById('auth-status'),
    loginPrompt: document.getElementById('login-prompt'),
    noJob: document.getElementById('no-job'),
    jobSection: document.getElementById('job-section'),
    loading: document.getElementById('loading'),
    loadingText: document.getElementById('loading-text'),
    results: document.getElementById('results'),

    // Job details
    jobTitle: document.getElementById('job-title'),
    jobCompany: document.getElementById('job-company'),
    jobPreview: document.getElementById('job-preview'),

    // Buttons
    loginBtn: document.getElementById('login-btn'),
    extractBtn: document.getElementById('extract-btn'),
    compileBtn: document.getElementById('compile-btn'),
    coverLetterBtn: document.getElementById('cover-letter-btn'),
    downloadPdfBtn: document.getElementById('download-pdf-btn'),
    viewPdfBtn: document.getElementById('view-pdf-btn'),
    copyCoverBtn: document.getElementById('copy-cover-btn'),
    backBtn: document.getElementById('back-btn'),

    // Template
    templateSelect: document.getElementById('template-select'),

    // Tabs
    tabResume: document.getElementById('tab-resume'),
    tabCover: document.getElementById('tab-cover'),
    resumeResult: document.getElementById('resume-result'),
    coverResult: document.getElementById('cover-result'),
    coverLetterText: document.getElementById('cover-letter-text'),

    // Links
    profileLink: document.getElementById('profile-link'),
    settingsLink: document.getElementById('settings-link'),
};

/**
 * Show a specific section, hiding others
 */
function showSection(sectionId) {
    const sections = ['login-prompt', 'no-job', 'job-section', 'loading', 'results'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.toggle('hidden', id !== sectionId);
        }
    });
}

/**
 * Update auth status display
 */
function updateAuthStatus(isLoggedIn, user) {
    if (isLoggedIn && user) {
        elements.authStatus.innerHTML = `
      <span class="user-name">${user.name || user.email}</span>
      <button id="logout-btn" class="btn-icon" title="Logout">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </button>
    `;
        elements.authStatus.classList.add('logged-in');

        // Add logout handler
        document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
    } else {
        elements.authStatus.innerHTML = '<span class="status-text">Not logged in</span>';
        elements.authStatus.classList.remove('logged-in');
    }
}

/**
 * Display job details
 */
function displayJobDetails(job) {
    currentJob = job;

    elements.jobTitle.textContent = job.title || 'Job Position';
    elements.jobCompany.textContent = job.company || '';

    // Show preview of job description
    const preview = job.jobDescription.slice(0, 200) + (job.jobDescription.length > 200 ? '...' : '');
    elements.jobPreview.textContent = preview;
}

/**
 * Send message to background script
 */
function sendMessage(type, payload = {}) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type, payload }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(response);
            }
        });
    });
}

/**
 * Get configuration from background script
 */
async function getConfig() {
    if (currentConfig) {
        return currentConfig;
    }
    const response = await sendMessage('GET_CONFIG');
    if (response.success) {
        currentConfig = response.config;
        return currentConfig;
    }
    throw new Error('Failed to load configuration');
}

/**
 * Handle login button click
 */
async function handleLogin() {
    const config = await getConfig();
    chrome.tabs.create({ url: `${config.FRONTEND_URL}/login` });
}

/**
 * Handle logout
 */
async function handleLogout() {
    await chrome.storage.local.remove('authToken');
    updateAuthStatus(false);
    showSection('login-prompt');
}

/**
 * Handle manual extraction
 */
async function handleExtract() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'EXTRACT_JOB_DESCRIPTION',
        });

        if (response?.success && response.data) {
            displayJobDetails(response.data);
            showSection('job-section');
        } else {
            showNotification('Could not extract job description from this page', 'error');
        }
    } catch (error) {
        console.error('Extraction error:', error);
        showNotification('Error extracting job description', 'error');
    }
}

/**
 * Handle resume compilation
 */
async function handleCompileResume() {
    if (!currentJob?.jobDescription) {
        showNotification('No job description available', 'error');
        return;
    }

    showSection('loading');
    elements.loadingText.textContent = 'Generating your tailored resume...';

    try {
        const result = await sendMessage('COMPILE_RESUME', {
            jobDescription: currentJob.jobDescription,
            template: elements.templateSelect.value,
            atsType: currentJob.atsType || currentJob.jobBoard || null,
        });

        if (result.success) {
            compiledResume = result;
            showResults('resume');
        } else {
            throw new Error(result.error || 'Compilation failed');
        }
    } catch (error) {
        console.error('Compile error:', error);
        showNotification(error.message, 'error');
        showSection('job-section');
    }
}

/**
 * Handle cover letter generation
 */
async function handleGenerateCoverLetter() {
    if (!currentJob?.jobDescription) {
        showNotification('No job description available', 'error');
        return;
    }

    showSection('loading');
    elements.loadingText.textContent = 'Crafting your cover letter...';

    try {
        const result = await sendMessage('GENERATE_COVER_LETTER', {
            jobDescription: currentJob.jobDescription,
            tone: 'professional',
            maxWords: 400,
            atsType: currentJob.atsType || currentJob.jobBoard || null,
        });

        if (result.success) {
            coverLetter = result;
            showResults('cover');
        } else {
            throw new Error(result.error || 'Generation failed');
        }
    } catch (error) {
        console.error('Cover letter error:', error);
        showNotification(error.message, 'error');
        showSection('job-section');
    }
}

/**
 * Show results section
 */
function showResults(tab = 'resume') {
    showSection('results');

    // Update tabs
    elements.tabResume.classList.toggle('active', tab === 'resume');
    elements.tabCover.classList.toggle('active', tab === 'cover');
    elements.resumeResult.classList.toggle('hidden', tab !== 'resume');
    elements.coverResult.classList.toggle('hidden', tab !== 'cover');

    // Display content
    if (tab === 'cover' && coverLetter?.coverLetter) {
        elements.coverLetterText.textContent = coverLetter.coverLetter;
    }
}

/**
 * Download PDF
 */
function handleDownloadPdf() {
    if (!compiledResume?.pdfBase64) return;

    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${compiledResume.pdfBase64}`;
    link.download = 'resume.pdf';
    link.click();
}

/**
 * View PDF in new tab
 */
function handleViewPdf() {
    if (!compiledResume?.pdfBase64) return;

    const pdfUrl = `data:application/pdf;base64,${compiledResume.pdfBase64}`;
    chrome.tabs.create({ url: pdfUrl });
}

/**
 * Copy cover letter to clipboard
 */
async function handleCopyCoverLetter() {
    if (!coverLetter?.coverLetter) return;

    try {
        await navigator.clipboard.writeText(coverLetter.coverLetter);
        showNotification('Cover letter copied to clipboard!');
    } catch (error) {
        showNotification('Failed to copy to clipboard', 'error');
    }
}

/**
 * Show notification
 */
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * Initialize popup
 */
async function init() {
    console.log('[MatchQuill Popup] Initializing...');

    // Load configuration first
    try {
        await getConfig();
        console.log('[MatchQuill Popup] Config loaded:', currentConfig.environment);
    } catch (error) {
        console.error('[MatchQuill Popup] Failed to load config:', error);
    }

    // Set up event listeners
    elements.loginBtn?.addEventListener('click', handleLogin);
    elements.extractBtn?.addEventListener('click', handleExtract);
    elements.compileBtn?.addEventListener('click', handleCompileResume);
    elements.coverLetterBtn?.addEventListener('click', handleGenerateCoverLetter);
    elements.downloadPdfBtn?.addEventListener('click', handleDownloadPdf);
    elements.viewPdfBtn?.addEventListener('click', handleViewPdf);
    elements.copyCoverBtn?.addEventListener('click', handleCopyCoverLetter);
    elements.backBtn?.addEventListener('click', () => showSection('job-section'));

    elements.tabResume?.addEventListener('click', () => showResults('resume'));
    elements.tabCover?.addEventListener('click', () => showResults('cover'));

    elements.profileLink?.addEventListener('click', (e) => {
        e.preventDefault();
        sendMessage('OPEN_PROFILE');
    });

    elements.settingsLink?.addEventListener('click', async (e) => {
        e.preventDefault();
        const config = await getConfig();
        chrome.tabs.create({ url: `${config.FRONTEND_URL}/settings` });
    });

    // Check auth status
    try {
        const authStatus = await sendMessage('GET_AUTH_STATUS');
        updateAuthStatus(authStatus.isLoggedIn, authStatus.user);

        if (!authStatus.isLoggedIn) {
            showSection('login-prompt');
            return;
        }

        // Get current job
        const jobResult = await sendMessage('GET_CURRENT_JOB');

        if (jobResult.job) {
            displayJobDetails(jobResult.job);
            showSection('job-section');
        } else {
            showSection('no-job');
        }
    } catch (error) {
        console.error('[MatchQuill Popup] Init error:', error);
        showSection('login-prompt');
    }
}

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', init);
