/**
 * CV-Wiz Background Service Worker
 * Handles API calls and coordinates between content scripts and popup
 */

// Import configuration module
importScripts('config.js');

// State
let currentJobData = null;
let authToken = null;
let configCache = null;

/**
 * Listen for messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[CV-Wiz BG] Received message:', message.type);

    switch (message.type) {
        case 'JOB_DESCRIPTION_EXTRACTED':
            handleJobExtracted(message.payload, sender);
            sendResponse({ success: true });
            break;

        case 'COMPILE_RESUME':
            handleCompileResume(message.payload)
                .then(result => sendResponse(result))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Keep channel open for async response

        case 'GENERATE_COVER_LETTER':
            handleGenerateCoverLetter(message.payload)
                .then(result => sendResponse(result))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'GET_AUTH_STATUS':
            getAuthStatus()
                .then(status => sendResponse(status))
                .catch(error => sendResponse({ isLoggedIn: false, error: error.message }));
            return true;

        case 'SET_AUTH_TOKEN':
            authToken = message.payload.token;
            chrome.storage.local.set({ authToken: message.payload.token });
            sendResponse({ success: true });
            break;

        case 'GET_CURRENT_JOB':
            chrome.storage.local.get(['lastExtractedJob'], (result) => {
                sendResponse({ job: result.lastExtractedJob || currentJobData });
            });
            return true;

        case 'OPEN_PROFILE':
            // Must not use await in non-async onMessage callback (CodeQL js/syntax-error)
            getConfigWithCache()
                .then((config) => {
                    chrome.tabs.create({ url: `${config.FRONTEND_URL}/profile` });
                    sendResponse({ success: true });
                })
                .catch((error) => {
                    sendResponse({ success: false, error: error.message });
                });
            return true;

        case 'GET_CONFIG':
            getConfigWithCache()
                .then(cfg => sendResponse({ success: true, config: cfg }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'SET_CONFIG':
            saveConfig(message.payload)
                .then(() => {
                    configCache = null; // Invalidate cache
                    sendResponse({ success: true });
                })
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        default:
            sendResponse({ success: false, error: 'Unknown message type' });
    }

    return false;
});

/**
 * Handle job description extraction from content script
 */
function handleJobExtracted(data, sender) {
    currentJobData = data;

    // Store in local storage
    chrome.storage.local.set({
        lastExtractedJob: data,
        lastExtractedAt: Date.now(),
    });

    // Update badge to indicate job is ready
    chrome.action.setBadgeText({ text: '1', tabId: sender.tab?.id });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId: sender.tab?.id });

    console.log('[CV-Wiz BG] Job extracted:', data.title);
}

/**
 * Get cached config or fetch fresh
 */
async function getConfigWithCache() {
    if (!configCache) {
        configCache = await getConfig();
    }
    return configCache;
}

/**
 * Compile resume via API
 */
async function handleCompileResume(payload) {
    const { jobDescription, template } = payload;

    // Get auth token from storage
    const token = await getStoredAuthToken();

    if (!token) {
        throw new Error('Not authenticated. Please log in first.');
    }

    const config = await getConfigWithCache();
    const response = await fetch(`${config.API_BASE_URL}/compile`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            authToken: token,
            jobDescription: jobDescription,
            template: template,
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || error.detail || 'Resume compilation failed');
    }

    const result = await response.json();

    // Cache the result
    chrome.storage.local.set({
        lastCompiledResume: result,
        lastCompiledAt: Date.now(),
    });

    return result;
}

/**
 * Generate cover letter via API
 */
async function handleGenerateCoverLetter(payload) {
    const { jobDescription, tone, maxWords } = payload;

    const token = await getStoredAuthToken();

    if (!token) {
        throw new Error('Not authenticated. Please log in first.');
    }

    const config = await getConfigWithCache();
    const response = await fetch(`${config.API_BASE_URL}/cover-letter`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            authToken: token,
            jobDescription: jobDescription,
            tone: tone || 'professional',
            maxWords: maxWords || 400,
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || error.detail || 'Cover letter generation failed');
    }

    const result = await response.json();

    // Cache the result
    chrome.storage.local.set({
        lastCoverLetter: result,
        lastCoverLetterAt: Date.now(),
    });

    return result;
}

/**
 * Get auth status from frontend
 */
async function getAuthStatus() {
    const token = await getStoredAuthToken();

    if (!token) {
        return { isLoggedIn: false };
    }

    const config = await getConfigWithCache();

    // Validate token by fetching profile
    try {
        const response = await fetch(`${config.FRONTEND_URL}/api/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (response.ok) {
            const profile = await response.json();
            return {
                isLoggedIn: true,
                user: {
                    id: profile.id,
                    email: profile.email,
                    name: profile.name,
                },
            };
        }
    } catch (error) {
        console.error('[CV-Wiz BG] Auth check failed:', error);
    }

    // Token is invalid, clear it
    chrome.storage.local.remove('authToken');
    return { isLoggedIn: false };
}

/**
 * Get stored auth token
 */
function getStoredAuthToken() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['authToken'], (result) => {
            resolve(result.authToken || null);
        });
    });
}

/**
 * Initialize background service worker
 */
async function init() {
    console.log('[CV-Wiz BG] Service worker initialized');

    // Pre-load config
    try {
        configCache = await getConfig();
        console.log('[CV-Wiz BG] Config loaded:', configCache.environment);
    } catch (error) {
        console.error('[CV-Wiz BG] Failed to load config:', error);
    }

    // Load stored auth token
    chrome.storage.local.get(['authToken'], (result) => {
        if (result.authToken) {
            authToken = result.authToken;
            console.log('[CV-Wiz BG] Auth token loaded from storage');
        }
    });
}

init();
