/**
 * CV-Wiz Content Script
 * Extracts job descriptions from various job listing pages
 */

(function () {
    'use strict';

    // Job board specific selectors
    const JOB_SELECTORS = {
        linkedin: {
            description: [
                '.jobs-description__content',
                '.description__text',
                '.job-view-layout .jobs-description',
                '[data-job-id] .jobs-box__html-content',
            ],
            title: [
                '.job-details-jobs-unified-top-card__job-title',
                '.jobs-unified-top-card__job-title',
                'h1.job-title',
            ],
            company: [
                '.job-details-jobs-unified-top-card__company-name',
                '.jobs-unified-top-card__company-name',
            ],
        },
        indeed: {
            description: [
                '#jobDescriptionText',
                '.jobsearch-jobDescriptionText',
                '[data-testid="jobDescription"]',
            ],
            title: [
                'h1.jobsearch-JobInfoHeader-title',
                '[data-testid="jobsearch-JobInfoHeader-title"]',
            ],
            company: [
                '[data-testid="inlineHeader-companyName"]',
                '.jobsearch-InlineCompanyRating-companyHeader',
            ],
        },
        glassdoor: {
            description: [
                '.JobDetails_jobDescription__uW_fK',
                '.desc',
                '[data-test="description"]',
            ],
            title: [
                '[data-test="job-title"]',
                '.css-1vg6q84',
            ],
            company: [
                '[data-test="employer-name"]',
                '.css-16nw49e',
            ],
        },
        greenhouse: {
            description: [
                '#content',
                '.job__description',
                '[class*="job-description"]',
            ],
            title: [
                '.app-title',
                'h1.job-title',
            ],
            company: [
                '.company-name',
            ],
        },
        lever: {
            description: [
                '.section-wrapper.page-full-width',
                '[data-qa="job-description"]',
                '.content',
            ],
            title: [
                'h2.posting-headline',
                '.posting-headline h2',
            ],
            company: [
                '.posting-categories .sort-by-commitment',
            ],
        },
        generic: {
            description: [
                '[class*="job-description"]',
                '[class*="jobDescription"]',
                '[id*="job-description"]',
                '[id*="jobDescription"]',
                '.description',
                '#description',
            ],
            title: [
                'h1',
                '[class*="job-title"]',
                '[class*="jobTitle"]',
            ],
            company: [
                '[class*="company"]',
                '[class*="employer"]',
            ],
        },
    };

    /**
     * Detect which job board we're on
     */
    function detectJobBoard() {
        const hostname = window.location.hostname;

        if (hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')) return 'linkedin';
        if (hostname === 'indeed.com' || hostname.endsWith('.indeed.com')) return 'indeed';
        if (hostname === 'glassdoor.com' || hostname.endsWith('.glassdoor.com')) return 'glassdoor';
        if (hostname === 'greenhouse.io' || hostname.endsWith('.greenhouse.io')) return 'greenhouse';
        if (hostname === 'lever.co' || hostname.endsWith('.lever.co')) return 'lever';

        return 'generic';
    }

    /**
     * Find element using multiple selectors
     */
    function findElement(selectors) {
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        return null;
    }

    /**
     * Extract text content, cleaning up whitespace
     */
    function extractText(element) {
        if (!element) return null;

        // Get text content
        let text = element.innerText || element.textContent || '';

        // Clean up whitespace
        text = text
            .replace(/[ \t]+/g, ' ') // Collapse horizontal whitespace
            .replace(/\n\s*\n/g, '\n\n') // Normalize paragraph breaks
            .replace(/[ \t]+\n/g, '\n') // Remove trailing space before newline
            .replace(/\n[ \t]+/g, '\n') // Remove leading space after newline
            .trim();

        return text || null;
    }

    /**
     * Send telemetry data
     */
    function sendTelemetry(event, data) {
        try {
            chrome.runtime.sendMessage({
                type: 'TELEMETRY_EVENT',
                payload: {
                    event: event,
                    data: data,
                    timestamp: new Date().toISOString(),
                    url: window.location.href
                }
            });
        } catch (e) {
            console.error('[CV-Wiz] Telemetry failed:', e);
        }
    }

    /**
     * Enable manual text selection mode
     */
    function enableManualSelection() {
        document.body.style.cursor = 'crosshair';
        
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.1);
            z-index: 999998;
            pointer-events: none;
        `;
        document.body.appendChild(overlay);
        
        function onMouseUp() {
            const selection = window.getSelection();
            const text = selection.toString().trim();
            
            if (text && text.length > 50) {
                const data = {
                    jobDescription: text,
                    title: document.title,
                    company: "Manual Selection",
                    url: window.location.href,
                    jobBoard: "manual",
                    extractedAt: new Date().toISOString()
                };
                sendToBackground(data);
                showNotification('Manual selection successful! Opening CV-Wiz...');
                sendTelemetry('manual_extraction_success', { length: text.length });
            } else if (text) {
                showNotification('Selected text is too short. Please select the full description.', 'error');
            }
            
            // Cleanup
            document.body.style.cursor = 'default';
            document.removeEventListener('mouseup', onMouseUp);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }
        
        // Use timeout to avoid capturing the click on the button itself
        setTimeout(() => {
            document.addEventListener('mouseup', onMouseUp);
        }, 100);
        
        showNotification('Select the job description text on the page.', 'info');
    }

    /**
     * Extract job description from the page
     */
    function extractJobDescription() {
        const jobBoard = detectJobBoard();
        const selectors = JOB_SELECTORS[jobBoard] || JOB_SELECTORS.generic;

        // Find description
        const descriptionElement = findElement(selectors.description);
        const description = extractText(descriptionElement);

        if (!description || description.length < 50) {
            console.log('[CV-Wiz] Could not find job description');
            sendTelemetry('extraction_failed', { reason: 'not_found_or_short', jobBoard });
            return null;
        }

        // Find title
        const titleElement = findElement(selectors.title);
        const title = extractText(titleElement);

        // Find company
        const companyElement = findElement(selectors.company);
        const company = extractText(companyElement);

        sendTelemetry('extraction_success', { jobBoard, length: description.length });

        return {
            jobDescription: description,
            title: title,
            company: company,
            url: window.location.href,
            jobBoard: jobBoard,
            extractedAt: new Date().toISOString(),
        };
    }


    /**
     * Send extracted data to background script
     */
    function sendToBackground(data) {
        if (!data) return;

        chrome.runtime.sendMessage({
            type: 'JOB_DESCRIPTION_EXTRACTED',
            payload: data,
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[CV-Wiz] Error sending message:', chrome.runtime.lastError);
                return;
            }
            console.log('[CV-Wiz] Background acknowledged:', response);
        });
    }

    /**
     * Create floating button for manual extraction
     */
    function createFloatingButton() {
        // Check if button already exists
        if (document.getElementById('cvwiz-extract-btn')) return;

        const button = document.createElement('button');
        button.id = 'cvwiz-extract-btn';
        button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
      <span>CV-Wiz</span>
    `;

        button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      transition: all 0.3s ease;
    `;

        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.05)';
            button.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
        });

        button.addEventListener('click', () => {
            const data = extractJobDescription();
            if (data) {
                sendToBackground(data);
                showNotification('Job description extracted! Opening CV-Wiz...');
            } else {
                showNotification('Auto-extraction failed. Click to select text manually.', 'error');
                enableManualSelection();
            }
        });

        document.body.appendChild(button);
    }

    /**
     * Show notification to user
     */
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6'
        };
        
        notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      padding: 16px 24px;
      background: ${colors[type] || colors.success};
      color: white;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      animation: slideIn 0.3s ease;
    `;

        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Add CSS animations
     */
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
        document.head.appendChild(style);
    }

    /**
     * Listen for messages from popup/background
     */
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'EXTRACT_JOB_DESCRIPTION') {
            const data = extractJobDescription();
            sendResponse({ success: !!data, data });
        }
        return true; // Keep message channel open for async response
    });

    /**
     * Initialize content script
     */
    function init() {
        console.log('[CV-Wiz] Content script initialized');
        addStyles();

        // Wait for page to load fully
        if (document.readyState === 'complete') {
            createFloatingButton();
        } else {
            window.addEventListener('load', createFloatingButton);
        }

        // Auto-extract on page load (store for popup)
        setTimeout(() => {
            const data = extractJobDescription();
            if (data) {
                chrome.storage.local.set({
                    lastExtractedJob: data,
                    lastExtractedAt: Date.now(),
                });
                console.log('[CV-Wiz] Job description auto-extracted and cached');
            }
        }, 1500); // Wait for dynamic content
    }

    init();

    // Export for testing
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            JOB_SELECTORS,
            detectJobBoard,
            extractText
        };
    }
})();
