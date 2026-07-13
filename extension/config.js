/**
 * CV-Wiz Extension Configuration
 * Centralized configuration for API URLs and environment settings
 * Supports both development and production environments
 */

// Default configuration values
const DEFAULT_CONFIG = {
    API_BASE_URL: 'http://localhost:8000/api/py',
    FRONTEND_URL: 'http://localhost:3000',
};

// Environment-specific configurations
const ENV_CONFIGS = {
    development: {
        API_BASE_URL: 'http://localhost:8000/api/py',
        FRONTEND_URL: 'http://localhost:3000',
    },
    production: {
        API_BASE_URL: 'https://cv-wiz.vercel.app/api/py',
        FRONTEND_URL: 'https://cv-wiz.vercel.app',
    },
    staging: {
        API_BASE_URL: 'https://staging.cv-wiz.vercel.app/api/py',
        FRONTEND_URL: 'https://staging.cv-wiz.vercel.app',
    },
};

/**
 * Get configuration for the current environment
 * Priority:
 * 1. User-configured values from chrome.storage.sync
 * 2. Environment-specific defaults
 * 3. Development defaults
 * @returns {Promise<{API_BASE_URL: string, FRONTEND_URL: string, environment: string}>}
 */
async function getConfig() {
    try {
        const result = await chrome.storage.sync.get(['apiBaseUrl', 'frontendUrl', 'environment']);
        
        const environment = result.environment || 'development';
        const envDefaults = ENV_CONFIGS[environment] || ENV_CONFIGS.development;
        
        return {
            API_BASE_URL: result.apiBaseUrl || envDefaults.API_BASE_URL,
            FRONTEND_URL: result.frontendUrl || envDefaults.FRONTEND_URL,
            environment: environment,
        };
    } catch (error) {
        console.error('[CV-Wiz Config] Error loading config:', error);
        return {
            ...DEFAULT_CONFIG,
            environment: 'development',
        };
    }
}

/**
 * Save configuration to storage
 * @param {Object} config - Configuration to save
 * @param {string} [config.apiBaseUrl] - API base URL
 * @param {string} [config.frontendUrl] - Frontend URL
 * @param {string} [config.environment] - Environment name
 * @returns {Promise<void>}
 */
async function saveConfig(config) {
    const storageData = {};
    
    if (config.apiBaseUrl !== undefined) {
        storageData.apiBaseUrl = config.apiBaseUrl;
    }
    if (config.frontendUrl !== undefined) {
        storageData.frontendUrl = config.frontendUrl;
    }
    if (config.environment !== undefined) {
        storageData.environment = config.environment;
    }
    
    await chrome.storage.sync.set(storageData);
    console.log('[CV-Wiz Config] Configuration saved:', storageData);
}

/**
 * Reset configuration to environment defaults
 * @param {string} [environment='development'] - Environment to reset to
 * @returns {Promise<void>}
 */
async function resetConfig(environment = 'development') {
    const envConfig = ENV_CONFIGS[environment] || ENV_CONFIGS.development;
    
    await chrome.storage.sync.set({
        apiBaseUrl: envConfig.API_BASE_URL,
        frontendUrl: envConfig.FRONTEND_URL,
        environment: environment,
    });
    
    console.log('[CV-Wiz Config] Configuration reset to', environment);
}

/**
 * Validate configuration values
 * @param {Object} config - Configuration to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateConfig(config) {
    const errors = [];
    
    if (!config.API_BASE_URL) {
        errors.push('API_BASE_URL is required');
    } else if (!isValidUrl(config.API_BASE_URL)) {
        errors.push('API_BASE_URL must be a valid URL');
    }
    
    if (!config.FRONTEND_URL) {
        errors.push('FRONTEND_URL is required');
    } else if (!isValidUrl(config.FRONTEND_URL)) {
        errors.push('FRONTEND_URL must be a valid URL');
    }
    
    return {
        valid: errors.length === 0,
        errors: errors,
    };
}

/**
 * Check if a string is a valid URL
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getConfig,
        saveConfig,
        resetConfig,
        validateConfig,
        ENV_CONFIGS,
        DEFAULT_CONFIG,
    };
}