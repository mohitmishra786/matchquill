/**
 * MatchQuill Content Script
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
        // UNVERIFIED — needs live DOM check. Naukri uses CSS-modules with hashed
        // class suffixes (e.g. "styles_xxx__hAsH") that shift between deploys, so
        // these exact classes are expected to go stale fastest. The `[class*=]`
        // fallbacks are intentionally loose to survive hash rotation.
        naukri: {
            description: [
                '.styles_JDC__dang-inner-html__h0K4t',
                '[class*="JDC__dang-inner-html"]',
                '[class*="job-desc"]',
                '.job-desc',
            ],
            title: [
                '.styles_jd-header-title__rZwM1',
                '[class*="jd-header-title"]',
                'h1[class*="title"]',
            ],
            company: [
                '.styles_jd-header-comp-name__MvqAI',
                '[class*="jd-header-comp-name"]',
                '[class*="comp-name"]',
            ],
        },
        // UNVERIFIED — needs live DOM check. Wellfound (formerly AngelList Talent)
        // is a heavily JS-rendered React SPA; could not confirm selectors via
        // static fetch. `data-test` attributes are a best guess based on
        // Wellfound's general use of `data-test` hooks across the product.
        wellfound: {
            description: [
                '[data-test="JobDescription"]',
                '[data-test*="description" i]',
                '[class*="description" i]',
            ],
            title: [
                '[data-test="JobTitle"]',
                '[data-test*="title" i] h1',
                'h1',
            ],
            company: [
                '[data-test="StartupName"]',
                '[data-test*="company" i]',
                '[class*="company" i]',
            ],
        },
        // UNVERIFIED — needs live DOM check. ZipRecruiter already had
        // host_permissions/manifest matches before this change but no selectors
        // were ever wired up (silently fell back to `generic`).
        ziprecruiter: {
            description: [
                '.job_description',
                '#job-description',
                '[class*="jobDescriptionSection"]',
                '[class*="description"]',
            ],
            title: [
                'h1.job_title',
                '[data-testid="job-title"]',
                'h1[class*="title"]',
            ],
            company: [
                '.hiring_company_text',
                '.job_company',
                '[class*="company"]',
            ],
        },
        // UNVERIFIED — needs live DOM check. Ashby's frontend uses vanilla-extract
        // CSS-in-JS with hashed class names (e.g. "_descriptionText_kb2b1_10"),
        // among the least stable of any ATS in this list. Prefer the `h1`/id
        // fallbacks since Ashby job pages typically render a single `h1` for
        // the posting title.
        ashby: {
            description: [
                '[class*="_descriptionText_"]',
                '.ashby-job-posting-body',
                '[class*="description" i]',
            ],
            title: [
                'h1[class*="_title_"]',
                'h1',
            ],
            company: [
                '[class*="_companyName_"]',
                '[class*="company" i]',
            ],
        },
        // UNVERIFIED — needs live DOM check. SmartRecruiters career pages
        // sometimes render schema.org JobPosting microdata (itemprop attrs),
        // which tend to be more durable since they back Google Jobs indexing.
        smartrecruiters: {
            description: [
                '[itemprop="description"]',
                '#job-description',
                '.job-sections',
                '[class*="description" i]',
            ],
            title: [
                '[itemprop="title"]',
                'h1[class*="job-title" i]',
                'h1',
            ],
            company: [
                '[itemprop="hiringOrganization"]',
                '[class*="company-name" i]',
            ],
        },
        // UNVERIFIED — needs live DOM check. iCIMS-hosted career pages
        // historically render job content inside a same-origin iframe
        // (commonly `#icims_content_iframe`). `all_frames: true` is set for
        // this content script in manifest.json specifically so it can also
        // run inside that iframe; without it, extraction on iCIMS sites would
        // silently fail on the top-level (empty) frame.
        icims: {
            description: [
                '.iCIMS_JobContent',
                '#iCIMS_JobContent',
                '.iCIMS_InfoMsg_Job',
                '[class*="iCIMS_JobContent"]',
            ],
            title: [
                '.iCIMS_JobHeaderTitle',
                'h1.iCIMS_Header',
                '[class*="iCIMS_JobHeaderTitle"]',
            ],
            company: [
                '.iCIMS_CompanyName',
                '[class*="iCIMS_Company"]',
            ],
        },
        // UNVERIFIED — needs live DOM check. Workable's public widget docs
        // reference `data-ui` hooks for styling overrides (e.g.
        // `data-ui="job-description"`); best-effort based on that, not a live
        // DOM confirmation.
        workable: {
            description: [
                '[data-ui="job-description"]',
                '[data-ui*="description"]',
                '[class*="description" i]',
            ],
            title: [
                '[data-ui="job-title"]',
                'h1[data-ui*="title"]',
                'h1',
            ],
            company: [
                '[data-ui="company-name"]',
                '[data-ui*="company"]',
                '[class*="company" i]',
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
        if (hostname === 'naukri.com' || hostname.endsWith('.naukri.com')) return 'naukri';
        if (hostname === 'wellfound.com' || hostname.endsWith('.wellfound.com')
            || hostname === 'angel.co' || hostname.endsWith('.angel.co')) return 'wellfound';
        if (hostname === 'ziprecruiter.com' || hostname.endsWith('.ziprecruiter.com')) return 'ziprecruiter';
        if (hostname === 'ashbyhq.com' || hostname.endsWith('.ashbyhq.com')) return 'ashby';
        if (hostname === 'smartrecruiters.com' || hostname.endsWith('.smartrecruiters.com')) return 'smartrecruiters';
        if (hostname === 'icims.com' || hostname.endsWith('.icims.com')) return 'icims';
        if (hostname === 'workable.com' || hostname.endsWith('.workable.com')) return 'workable';

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
            console.error('[MatchQuill] Telemetry failed:', e);
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
                    atsType: "manual",
                    extractedAt: new Date().toISOString()
                };
                sendToBackground(data);
                showNotification('Manual selection successful! Opening MatchQuill...');
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
            console.log('[MatchQuill] Could not find job description');
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
            // ATS identifier, explicitly named for backend consumers that key
            // off the hiring platform rather than the display name of the site
            // (currently mirrors `jobBoard`, kept as its own field so the two
            // can diverge later, e.g. if a single ATS is detected across
            // multiple custom-domain career sites).
            atsType: jobBoard,
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
                console.error('[MatchQuill] Error sending message:', chrome.runtime.lastError);
                return;
            }
            console.log('[MatchQuill] Background acknowledged:', response);
        });
    }

    /**
     * Create floating button for manual extraction
     */
    function createFloatingButton() {
        // Check if button already exists
        if (document.getElementById('matchquill-extract-btn')) return;

        const button = document.createElement('button');
        button.id = 'matchquill-extract-btn';
        button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
      <span>MatchQuill</span>
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
                showNotification('Job description extracted! Opening MatchQuill...');
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
        console.log('[MatchQuill] Content script initialized');

        // Some ATS platforms (e.g. iCIMS) load job content inside a
        // same-origin iframe, so this script is injected with
        // `all_frames: true` on those hosts to reach it. The floating UI
        // (button/overlay/notifications) should only ever render once per
        // page, so it's restricted to the top frame; extraction still runs
        // in every frame so it can find the description wherever it lives.
        const isTopFrame = window.self === window.top;

        if (!isTopFrame) {
            // Auto-extract on page load from this frame only; UI lives in the
            // top frame.
            setTimeout(() => {
                const data = extractJobDescription();
                if (data) {
                    chrome.storage.local.set({
                        lastExtractedJob: data,
                        lastExtractedAt: Date.now(),
                    });
                    console.log('[MatchQuill] Job description auto-extracted and cached (iframe)');
                }
            }, 1500);
            return;
        }

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
                console.log('[MatchQuill] Job description auto-extracted and cached');
            }
        }, 1500); // Wait for dynamic content
    }

    init();

    // Export for testing
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            JOB_SELECTORS,
            detectJobBoard,
            extractText,
            extractJobDescription,
            findElement
        };
    }
})();
