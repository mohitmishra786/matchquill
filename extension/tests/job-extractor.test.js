
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

/**
 * Loads job-extractor.js into a fresh JSDOM window at the given URL, with the
 * given body markup already present (so extraction selectors have something
 * to find). Mirrors the harness used in `beforeEach` below, but parameterized
 * so per-site tests can supply their own URL/fixture.
 */
function loadExtractor(url, bodyHtml = '') {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>${bodyHtml}</body></html>`, { url });

    const chromeMock = {
        runtime: {
            sendMessage: vi.fn(),
            onMessage: { addListener: vi.fn() },
            lastError: null
        },
        storage: {
            local: { set: vi.fn() },
            sync: { get: vi.fn() }
        }
    };

    const scriptPath = path.resolve(__dirname, '../content/job-extractor.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');

    const module = { exports: {} };
    const runScript = new Function('module', 'window', 'document', 'chrome', scriptContent);
    runScript(module, dom.window, dom.window.document, chromeMock);

    return { extractor: module.exports, window: dom.window, document: dom.window.document };
}

describe('Job Extractor', () => {
    let extractor;
    let dom;

    beforeEach(() => {
        // Setup JSDOM
        dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
            url: 'https://www.linkedin.com/jobs/view/123'
        });

        // Setup globals
        global.window = dom.window;
        global.document = dom.window.document;
        global.chrome = {
            runtime: {
                sendMessage: vi.fn(),
                onMessage: { addListener: vi.fn() },
                lastError: null
            },
            storage: {
                local: { set: vi.fn() },
                sync: { get: vi.fn() }
            }
        };

        // Read script
        const scriptPath = path.resolve(__dirname, '../content/job-extractor.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');

        // Mock module context
        const module = { exports: {} };

        // Execute script in global scope (mimicking browser but with module injection)
        // We use new Function to avoid strict mode issues with eval if any, but eval is fine
        // We need to pass 'module' into the scope
        const runScript = new Function('module', 'window', 'document', 'chrome', scriptContent);
        runScript(module, global.window, global.document, global.chrome);

        extractor = module.exports;
    });

    it('should export selectors', () => {
        expect(extractor.JOB_SELECTORS).toBeDefined();
        expect(extractor.JOB_SELECTORS.linkedin).toBeDefined();
    });

    it('should detect linkedin job board', () => {
        expect(extractor.detectJobBoard()).toBe('linkedin');
    });

    it('should extract text from element', () => {
        const div = document.createElement('div');
        div.innerHTML = '  Hello   \n\n World  ';
        expect(extractor.extractText(div)).toBe('Hello\n\nWorld');
    });
    
    it('should have valid selectors syntax', () => {
        for (const board in extractor.JOB_SELECTORS) {
            const selectors = extractor.JOB_SELECTORS[board];
            ['description', 'title', 'company'].forEach(field => {
                selectors[field].forEach(selector => {
                    // Check if selector throws error
                    expect(() => document.querySelector(selector)).not.toThrow();
                });
            });
        }
    });
});

// A description long enough to clear the extractor's 50-char minimum.
const SAMPLE_DESCRIPTION = 'We are looking for an experienced engineer to join our growing platform team.';

describe('New job board / ATS coverage', () => {
    it('detects and extracts Naukri postings', () => {
        const { extractor } = loadExtractor(
            'https://www.naukri.com/job-listings-software-engineer-acme-123456',
            `
                <div class="styles_JDC__dang-inner-html__h0K4t">${SAMPLE_DESCRIPTION}</div>
                <h1 class="styles_jd-header-title__rZwM1">Software Engineer</h1>
                <div class="styles_jd-header-comp-name__MvqAI">Acme Corp</div>
            `
        );

        expect(extractor.detectJobBoard()).toBe('naukri');

        const data = extractor.extractJobDescription();
        expect(data).not.toBeNull();
        expect(data.jobBoard).toBe('naukri');
        expect(data.atsType).toBe('naukri');
        expect(data.title).toBe('Software Engineer');
        expect(data.company).toBe('Acme Corp');
        expect(data.jobDescription).toContain('experienced engineer');
    });

    it('detects and extracts Wellfound postings', () => {
        const { extractor } = loadExtractor(
            'https://wellfound.com/jobs/123456-software-engineer',
            `
                <div data-test="JobDescription">${SAMPLE_DESCRIPTION}</div>
                <h1 data-test="JobTitle">Software Engineer</h1>
                <div data-test="StartupName">Acme Startup</div>
            `
        );

        expect(extractor.detectJobBoard()).toBe('wellfound');

        const data = extractor.extractJobDescription();
        expect(data).not.toBeNull();
        expect(data.jobBoard).toBe('wellfound');
        expect(data.atsType).toBe('wellfound');
        expect(data.title).toBe('Software Engineer');
        expect(data.company).toBe('Acme Startup');
    });

    it('detects and extracts ZipRecruiter postings', () => {
        const { extractor } = loadExtractor(
            'https://www.ziprecruiter.com/jobs/acme-corp-123456',
            `
                <div class="job_description">${SAMPLE_DESCRIPTION}</div>
                <h1 class="job_title">Software Engineer</h1>
                <a class="hiring_company_text">Acme Corp</a>
            `
        );

        expect(extractor.detectJobBoard()).toBe('ziprecruiter');

        const data = extractor.extractJobDescription();
        expect(data).not.toBeNull();
        expect(data.jobBoard).toBe('ziprecruiter');
        expect(data.atsType).toBe('ziprecruiter');
        expect(data.title).toBe('Software Engineer');
        expect(data.company).toBe('Acme Corp');
    });

    it('detects and extracts Ashby postings', () => {
        const { extractor } = loadExtractor(
            'https://jobs.ashbyhq.com/acme/123456',
            `
                <div class="_descriptionText_kb2b1_10">${SAMPLE_DESCRIPTION}</div>
                <h1 class="_title_kb2b1_5">Software Engineer</h1>
                <div class="_companyName_kb2b1_2">Acme Corp</div>
            `
        );

        expect(extractor.detectJobBoard()).toBe('ashby');

        const data = extractor.extractJobDescription();
        expect(data).not.toBeNull();
        expect(data.jobBoard).toBe('ashby');
        expect(data.atsType).toBe('ashby');
        expect(data.title).toBe('Software Engineer');
        expect(data.company).toBe('Acme Corp');
    });

    it('detects and extracts SmartRecruiters postings', () => {
        const { extractor } = loadExtractor(
            'https://careers.smartrecruiters.com/Acme/software-engineer-123456',
            `
                <div itemprop="description">${SAMPLE_DESCRIPTION}</div>
                <h1 itemprop="title">Software Engineer</h1>
                <div itemprop="hiringOrganization">Acme Corp</div>
            `
        );

        expect(extractor.detectJobBoard()).toBe('smartrecruiters');

        const data = extractor.extractJobDescription();
        expect(data).not.toBeNull();
        expect(data.jobBoard).toBe('smartrecruiters');
        expect(data.atsType).toBe('smartrecruiters');
        expect(data.title).toBe('Software Engineer');
        expect(data.company).toBe('Acme Corp');
    });

    it('detects and extracts iCIMS-hosted postings', () => {
        const { extractor } = loadExtractor(
            'https://careers-acme.icims.com/jobs/123456/software-engineer/job',
            `
                <div class="iCIMS_JobContent">${SAMPLE_DESCRIPTION}</div>
                <h1 class="iCIMS_JobHeaderTitle">Software Engineer</h1>
                <div class="iCIMS_CompanyName">Acme Corp</div>
            `
        );

        expect(extractor.detectJobBoard()).toBe('icims');

        const data = extractor.extractJobDescription();
        expect(data).not.toBeNull();
        expect(data.jobBoard).toBe('icims');
        expect(data.atsType).toBe('icims');
        expect(data.title).toBe('Software Engineer');
        expect(data.company).toBe('Acme Corp');
    });

    it('detects and extracts Workable-hosted postings', () => {
        const { extractor } = loadExtractor(
            'https://apply.workable.com/acme/j/123456/',
            `
                <div data-ui="job-description">${SAMPLE_DESCRIPTION}</div>
                <h1 data-ui="job-title">Software Engineer</h1>
                <div data-ui="company-name">Acme Corp</div>
            `
        );

        expect(extractor.detectJobBoard()).toBe('workable');

        const data = extractor.extractJobDescription();
        expect(data).not.toBeNull();
        expect(data.jobBoard).toBe('workable');
        expect(data.atsType).toBe('workable');
        expect(data.title).toBe('Software Engineer');
        expect(data.company).toBe('Acme Corp');
    });

    it('falls back to generic extraction on unrecognized hosts', () => {
        const { extractor } = loadExtractor('https://careers.some-unknown-ats.example/job/1');
        expect(extractor.detectJobBoard()).toBe('generic');
    });
});
