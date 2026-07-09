/**
 * CV-Wiz Extension Options Page Script
 * Handles configuration management for the extension
 */

// Environment presets
const ENV_PRESETS = {
    development: {
        apiBaseUrl: 'http://localhost:8000/api',
        frontendUrl: 'http://localhost:3000',
    },
    staging: {
        apiBaseUrl: 'https://staging.cv-wiz.vercel.app/api',
        frontendUrl: 'https://staging.cv-wiz.vercel.app',
    },
    production: {
        apiBaseUrl: 'https://cv-wiz.vercel.app/api',
        frontendUrl: 'https://cv-wiz.vercel.app',
    },
};

// DOM Elements
const elements = {
    environment: document.getElementById('environment'),
    apiBaseUrl: document.getElementById('api-base-url'),
    frontendUrl: document.getElementById('frontend-url'),
    configDisplay: document.getElementById('config-display'),
    validationStatus: document.getElementById('validation-status'),
    saveBtn: document.getElementById('save-btn'),
    resetBtn: document.getElementById('reset-btn'),
    testBtn: document.getElementById('test-btn'),
    notification: document.getElementById('notification'),
};

/**
 * Load current configuration
 */
async function loadConfig() {
    try {
        const result = await chrome.storage.sync.get([
            'environment',
            'apiBaseUrl',
            'frontendUrl',
        ]);

        const environment = result.environment || 'development';
        
        // Set environment dropdown
        elements.environment.value = environment;

        // Set URL inputs (use presets if not custom)
        if (environment === 'custom') {
            elements.apiBaseUrl.value = result.apiBaseUrl || '';
            elements.frontendUrl.value = result.frontendUrl || '';
        } else {
            const preset = ENV_PRESETS[environment];
            elements.apiBaseUrl.value = preset.apiBaseUrl;
            elements.frontendUrl.value = preset.frontendUrl;
        }

        updateConfigDisplay(environment, elements.apiBaseUrl.value, elements.frontendUrl.value);
        updateInputState(environment);
    } catch (error) {
        console.error('[CV-Wiz Options] Error loading config:', error);
        showNotification('Failed to load configuration', 'error');
    }
}

/**
 * Update configuration display
 */
function updateConfigDisplay(environment, apiUrl, frontendUrl) {
    elements.configDisplay.textContent = '';
    const p1 = document.createElement('p');
    p1.innerHTML = `<span class="label">Environment:</span> <span class="value">${escapeHtml(environment)}</span>`;
    const p2 = document.createElement('p');
    p2.innerHTML = `<span class="label">API Base URL:</span> <span class="value">${escapeHtml(apiUrl || 'Not set')}</span>`;
    const p3 = document.createElement('p');
    p3.innerHTML = `<span class="label">Frontend URL:</span> <span class="value">${escapeHtml(frontendUrl || 'Not set')}</span>`;
    elements.configDisplay.appendChild(p1);
    elements.configDisplay.appendChild(p2);
    elements.configDisplay.appendChild(p3);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Update input field state based on environment selection
 */
function updateInputState(environment) {
    const isCustom = environment === 'custom';
    elements.apiBaseUrl.disabled = !isCustom;
    elements.frontendUrl.disabled = !isCustom;

    if (!isCustom) {
        const preset = ENV_PRESETS[environment];
        if (preset) {
            elements.apiBaseUrl.value = preset.apiBaseUrl;
            elements.frontendUrl.value = preset.frontendUrl;
        }
    }
}

/**
 * Handle environment change
 */
function handleEnvironmentChange() {
    const environment = elements.environment.value;
    updateInputState(environment);
    
    if (environment !== 'custom') {
        const preset = ENV_PRESETS[environment];
        updateConfigDisplay(environment, preset.apiBaseUrl, preset.frontendUrl);
    } else {
        updateConfigDisplay(environment, elements.apiBaseUrl.value, elements.frontendUrl.value);
    }
}

/**
 * Validate configuration
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateConfig() {
    const errors = [];
    const apiUrl = elements.apiBaseUrl.value.trim();
    const frontendUrl = elements.frontendUrl.value.trim();

    if (!apiUrl) {
        errors.push('API Base URL is required');
    } else if (!isValidUrl(apiUrl)) {
        errors.push('API Base URL must be a valid URL');
    }

    if (!frontendUrl) {
        errors.push('Frontend URL is required');
    } else if (!isValidUrl(frontendUrl)) {
        errors.push('Frontend URL must be a valid URL');
    }

    return {
        valid: errors.length === 0,
        errors: errors,
    };
}

/**
 * Check if a string is a valid URL
 */
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Show validation status
 */
function showValidationStatus(valid, message) {
    elements.validationStatus.className = 'validation-status';
    elements.validationStatus.classList.add(valid ? 'success' : 'error');
    elements.validationStatus.textContent = message;
}

/**
 * Clear validation status
 */
function clearValidationStatus() {
    elements.validationStatus.className = 'validation-status';
    elements.validationStatus.textContent = '';
}

/**
 * Save configuration
 */
async function saveConfig() {
    clearValidationStatus();

    const validation = validateConfig();
    if (!validation.valid) {
        showValidationStatus(false, validation.errors.join('. '));
        return;
    }

    const environment = elements.environment.value;
    const config = {
        environment: environment,
    };

    if (environment === 'custom') {
        config.apiBaseUrl = elements.apiBaseUrl.value.trim();
        config.frontendUrl = elements.frontendUrl.value.trim();
    } else {
        const preset = ENV_PRESETS[environment];
        config.apiBaseUrl = preset.apiBaseUrl;
        config.frontendUrl = preset.frontendUrl;
    }

    try {
        await chrome.storage.sync.set(config);
        
        // Notify background script to refresh config cache
        await chrome.runtime.sendMessage({
            type: 'SET_CONFIG',
            payload: config,
        });

        updateConfigDisplay(environment, config.apiBaseUrl, config.frontendUrl);
        showValidationStatus(true, 'Configuration saved successfully!');
        showNotification('Settings saved successfully!', 'success');
    } catch (error) {
        console.error('[CV-Wiz Options] Error saving config:', error);
        showValidationStatus(false, 'Failed to save configuration');
        showNotification('Failed to save settings', 'error');
    }
}

/**
 * Reset configuration to defaults
 */
async function resetConfig() {
    try {
        await chrome.storage.sync.remove(['environment', 'apiBaseUrl', 'frontendUrl']);
        
        elements.environment.value = 'development';
        updateInputState('development');
        
        const preset = ENV_PRESETS.development;
        updateConfigDisplay('development', preset.apiBaseUrl, preset.frontendUrl);
        
        // Notify background script
        await chrome.runtime.sendMessage({
            type: 'SET_CONFIG',
            payload: {
                environment: 'development',
                apiBaseUrl: preset.apiBaseUrl,
                frontendUrl: preset.frontendUrl,
            },
        });

        clearValidationStatus();
        showNotification('Settings reset to defaults', 'success');
    } catch (error) {
        console.error('[CV-Wiz Options] Error resetting config:', error);
        showNotification('Failed to reset settings', 'error');
    }
}

/**
 * Test connection to API
 */
async function testConnection() {
    clearValidationStatus();

    const validation = validateConfig();
    if (!validation.valid) {
        showValidationStatus(false, validation.errors.join('. '));
        return;
    }

    const apiUrl = elements.apiBaseUrl.value.trim();
    
    showValidationStatus(true, 'Testing connection...');
    elements.testBtn.disabled = true;

    try {
        const response = await fetch(`${apiUrl}/health`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (response.ok) {
            showValidationStatus(true, 'Connection successful! API is reachable.');
            showNotification('Connection test successful!', 'success');
        } else {
            showValidationStatus(false, `Connection failed: HTTP ${response.status}`);
            showNotification('Connection test failed', 'error');
        }
    } catch (error) {
        console.error('[CV-Wiz Options] Connection test failed:', error);
        showValidationStatus(false, 'Connection failed: Unable to reach API');
        showNotification('Connection test failed', 'error');
    } finally {
        elements.testBtn.disabled = false;
    }
}

/**
 * Show notification
 */
function showNotification(message, type = 'success') {
    elements.notification.textContent = message;
    elements.notification.className = `notification ${type}`;
    elements.notification.classList.add('show');

    setTimeout(() => {
        elements.notification.classList.remove('show');
    }, 3000);
}

/**
 * Initialize options page
 */
function init() {
    // Load current configuration
    loadConfig();

    // Set up event listeners
    elements.environment.addEventListener('change', handleEnvironmentChange);
    elements.saveBtn.addEventListener('click', saveConfig);
    elements.resetBtn.addEventListener('click', resetConfig);
    elements.testBtn.addEventListener('click', testConnection);

    // Update display when custom URLs change
    elements.apiBaseUrl.addEventListener('input', () => {
        if (elements.environment.value === 'custom') {
            updateConfigDisplay('custom', elements.apiBaseUrl.value, elements.frontendUrl.value);
        }
    });

    elements.frontendUrl.addEventListener('input', () => {
        if (elements.environment.value === 'custom') {
            updateConfigDisplay('custom', elements.apiBaseUrl.value, elements.frontendUrl.value);
        }
    });

    console.log('[CV-Wiz Options] Options page initialized');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
