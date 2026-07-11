/**
 * Sanitization Utility Tests
 */

import { describe, it, expect } from 'vitest';
import {
    sanitizeText,
    sanitizeRichText,
    sanitizeUrl,
    sanitizeEmail,
    sanitizeStringArray,
    sanitizeNumber,
    sanitizeBoolean,
    sanitizeExperienceData,
    sanitizeProjectData,
    sanitizeEducationData,
    sanitizeSkillData,
    sanitizeCoverLetterData,
    sanitizeProfileData,
    sanitizeFeedbackData,
    sanitizeRequestBody,
    getSecurityHeaders,
} from '../sanitization';

describe('sanitizeText', () => {
    it('should remove HTML tags from text', () => {
        // DOMPurify strips script elements (and their contents) entirely
        expect(sanitizeText('<script>alert("xss")</script>Hello')).toBe('Hello');
        expect(sanitizeText('<p>Hello</p>')).toBe('Hello');
        expect(sanitizeText('<div>Test</div>')).toBe('Test');
        expect(sanitizeText('<b>Bold</b> text')).toBe('Bold text');
    });

    it('should handle null and undefined', () => {
        expect(sanitizeText(null)).toBe('');
        expect(sanitizeText(undefined)).toBe('');
    });

    it('should normalize whitespace', () => {
        expect(sanitizeText('  hello   world  ')).toBe('hello world');
        expect(sanitizeText('test\n\n\nvalue')).toBe('test value');
    });

    it('should handle XSS attempts', () => {
        expect(sanitizeText('<img src=x onerror=alert(1)>')).toBe('');
        expect(sanitizeText('javascript:alert(1)')).toBe('javascript:alert(1)'); // Text sanitization doesn't validate URLs
        expect(sanitizeText('<svg onload=alert(1)>')).toBe('');
    });
});

describe('sanitizeRichText', () => {
    it('should allow safe HTML tags', () => {
        expect(sanitizeRichText('<b>Bold</b>')).toBe('<b>Bold</b>');
        expect(sanitizeRichText('<i>Italic</i>')).toBe('<i>Italic</i>');
        expect(sanitizeRichText('<p>Paragraph</p>')).toBe('<p>Paragraph</p>');
    });

    it('should remove dangerous tags', () => {
        expect(sanitizeRichText('<script>alert(1)</script>')).toBe('');
        expect(sanitizeRichText('<iframe src="evil.com"></iframe>')).toBe('');
        expect(sanitizeRichText('<object data="evil.swf"></object>')).toBe('');
    });

    it('should strip event handlers and javascript URLs from anchors', () => {
        const result = sanitizeRichText(
            '<a href="javascript:alert(1)" onclick="evil()">click</a>'
        );
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('onclick');
    });

    it('should strip event handlers without leaving raw script leakage', () => {
        const dirty = '<img src=x onerror=alert(1)><b>ok</b>';
        const result = sanitizeRichText(dirty);
        expect(result).toContain('<b>ok</b>');
        expect(result).not.toContain('onerror');
        expect(result).not.toContain('<img');
    });

    it('should handle null and undefined', () => {
        expect(sanitizeRichText(null)).toBe('');
        expect(sanitizeRichText(undefined)).toBe('');
    });
});

describe('sanitizeUrl', () => {
    it('should return null for dangerous protocols', () => {
        expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
        expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
        expect(sanitizeUrl('vbscript:msgbox(1)')).toBeNull();
        expect(sanitizeUrl('file:///etc/passwd')).toBeNull();
    });

    it('should allow safe URLs', () => {
        expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
        expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
        expect(sanitizeUrl('mailto:test@example.com')).toBe('mailto:test@example.com');
    });

    it('should add https:// to URLs without protocol', () => {
        expect(sanitizeUrl('example.com')).toBe('https://example.com');
        expect(sanitizeUrl('www.example.com')).toBe('https://www.example.com');
    });

    it('should handle null and undefined', () => {
        expect(sanitizeUrl(null)).toBeNull();
        expect(sanitizeUrl(undefined)).toBeNull();
    });
});

describe('sanitizeEmail', () => {
    it('should sanitize valid emails', () => {
        expect(sanitizeEmail('test@example.com')).toBe('test@example.com');
        expect(sanitizeEmail('  Test@Example.COM  ')).toBe('test@example.com');
    });

    it('should return empty string for invalid emails', () => {
        expect(sanitizeEmail('not-an-email')).toBe('');
        expect(sanitizeEmail('@example.com')).toBe('');
        expect(sanitizeEmail('test@')).toBe('');
    });

    it('should handle null and undefined', () => {
        expect(sanitizeEmail(null)).toBe('');
        expect(sanitizeEmail(undefined)).toBe('');
    });

    it('should remove HTML from emails', () => {
        expect(sanitizeEmail('<script>alert(1)</script>test@example.com')).toBe('test@example.com');
    });
});

describe('sanitizeStringArray', () => {
    it('should sanitize all strings in array', () => {
        expect(sanitizeStringArray(['<b>test</b>', 'hello'])).toEqual(['test', 'hello']);
    });

    it('should filter out empty strings', () => {
        expect(sanitizeStringArray(['test', '', '  ', 'hello'])).toEqual(['test', 'hello']);
    });

    it('should handle null and undefined', () => {
        expect(sanitizeStringArray(null)).toEqual([]);
        expect(sanitizeStringArray(undefined)).toEqual([]);
    });

    it('should handle mixed types', () => {
        expect(sanitizeStringArray(['test', null, undefined, 'hello'])).toEqual(['test', 'hello']);
    });
});

describe('sanitizeNumber', () => {
    it('should return number within range', () => {
        expect(sanitizeNumber(5, 0, 10, 0)).toBe(5);
        expect(sanitizeNumber('5', 0, 10, 0)).toBe(5);
    });

    it('should clamp to min/max', () => {
        expect(sanitizeNumber(-5, 0, 10, 0)).toBe(0);
        expect(sanitizeNumber(15, 0, 10, 0)).toBe(10);
    });

    it('should return default for invalid input', () => {
        expect(sanitizeNumber('not-a-number', 0, 10, 5)).toBe(5);
        expect(sanitizeNumber(null, 0, 10, 5)).toBe(5);
        expect(sanitizeNumber(undefined, 0, 10, 5)).toBe(5);
        expect(sanitizeNumber(NaN, 0, 10, 5)).toBe(5);
    });
});

describe('sanitizeBoolean', () => {
    it('should return boolean values as-is', () => {
        expect(sanitizeBoolean(true)).toBe(true);
        expect(sanitizeBoolean(false)).toBe(false);
    });

    it('should convert string to boolean', () => {
        expect(sanitizeBoolean('true')).toBe(true);
        expect(sanitizeBoolean('TRUE')).toBe(true);
        expect(sanitizeBoolean('1')).toBe(true);
        expect(sanitizeBoolean('yes')).toBe(true);
        expect(sanitizeBoolean('false')).toBe(false);
        expect(sanitizeBoolean('0')).toBe(false);
        expect(sanitizeBoolean('no')).toBe(false);
    });

    it('should convert number to boolean', () => {
        expect(sanitizeBoolean(1)).toBe(true);
        expect(sanitizeBoolean(0)).toBe(false);
        expect(sanitizeBoolean(42)).toBe(true);
    });

    it('should return default for null/undefined', () => {
        expect(sanitizeBoolean(null, true)).toBe(true);
        expect(sanitizeBoolean(undefined, false)).toBe(false);
    });
});

describe('sanitizeExperienceData', () => {
    it('should sanitize all fields', () => {
        const input = {
            company: '<b>Acme Corp</b>',
            title: 'Developer',
            location: 'NYC',
            description: '<script>alert(1)</script>Worked on projects',
            highlights: ['<b>Achievement</b>', ''],
            keywords: ['javascript', '<i>react</i>'],
            startDate: '2020-01-01',
            endDate: null,
            current: true,
        };

        const result = sanitizeExperienceData(input);

        expect(result.company).toBe('Acme Corp');
        expect(result.title).toBe('Developer');
        expect(result.description).toBe('Worked on projects');
        expect(result.highlights).toEqual(['Achievement']);
        expect(result.keywords).toEqual(['javascript', 'react']);
        expect(result.current).toBe(true);
    });
});

describe('sanitizeProjectData', () => {
    it('should sanitize all fields', () => {
        const input = {
            name: '<b>Project</b>',
            description: '<script>alert(1)</script>Description',
            url: 'javascript:alert(1)',
            technologies: ['<b>React</b>', 'Node.js'],
            highlights: ['Feature 1'],
            startDate: '2020-01-01',
            endDate: null,
        };

        const result = sanitizeProjectData(input);

        expect(result.name).toBe('Project');
        expect(result.description).toBe('Description');
        expect(result.url).toBeNull();
        expect(result.technologies).toEqual(['React', 'Node.js']);
    });
});

describe('sanitizeEducationData', () => {
    it('should sanitize all fields', () => {
        const input = {
            institution: '<b>University</b>',
            degree: 'BS',
            field: '<b>CS</b>',
            gpa: '3.5',
            honors: ['<b>Dean List</b>'],
            startDate: '2016-09-01',
            endDate: '2020-05-01',
        };

        const result = sanitizeEducationData(input);

        expect(result.institution).toBe('University');
        expect(result.degree).toBe('BS');
        expect(result.field).toBe('CS');
        expect(result.gpa).toBe(3.5);
        expect(result.honors).toEqual(['Dean List']);
    });
});

describe('sanitizeSkillData', () => {
    it('should sanitize all fields', () => {
        const input = {
            name: '<b>JavaScript</b>',
            category: '<i>Programming</i>',
            proficiency: 'Expert',
            yearsExp: '5',
        };

        const result = sanitizeSkillData(input);

        expect(result.name).toBe('JavaScript');
        expect(result.category).toBe('Programming');
        expect(result.proficiency).toBe('Expert');
        expect(result.yearsExp).toBe(5);
    });
});

describe('sanitizeCoverLetterData', () => {
    it('should sanitize all fields', () => {
        const input = {
            content: '<script>alert(1)</script><b>Cover</b> letter',
            jobTitle: '<b>Developer</b>',
            companyName: '<b>Acme</b>',
        };

        const result = sanitizeCoverLetterData(input);

        expect(result.content).toBe('<b>Cover</b> letter');
        expect(result.jobTitle).toBe('Developer');
        expect(result.companyName).toBe('Acme');
    });
});

describe('sanitizeProfileData', () => {
    it('should sanitize all fields', () => {
        const input = {
            name: '<b>John Doe</b>',
            image: 'javascript:alert(1)',
        };

        const result = sanitizeProfileData(input);

        expect(result.name).toBe('John Doe');
        expect(result.image).toBeNull();
    });
});

describe('sanitizeFeedbackData', () => {
    it('should sanitize all fields', () => {
        const input = {
            rating: '4',
            comment: '<script>alert(1)</script>Great!',
            category: '<b>UI</b>',
        };

        const result = sanitizeFeedbackData(input);

        expect(result.rating).toBe(4);
        expect(result.comment).toBe('Great!');
        expect(result.category).toBe('UI');
    });
});

describe('sanitizeRequestBody', () => {
    it('should sanitize all string fields', () => {
        const input = {
            name: '<b>John</b>',
            description: '<script>alert(1)</script>Description',
            count: 5,
            nested: {
                title: '<i>Title</i>',
            },
        };

        const result = sanitizeRequestBody(input);

        expect(result.name).toBe('John');
        expect(result.description).toBe('Description');
        expect(result.count).toBe(5);
        expect((result.nested as { title: string }).title).toBe('Title');
    });

    it('should sanitize arrays of strings', () => {
        const input = {
            items: ['<b>Item 1</b>', '<i>Item 2</i>', '<script>evil</script>safe'],
        };

        const result = sanitizeRequestBody(input);

        expect(result.items).toEqual(['Item 1', 'Item 2', 'safe']);
    });
});

describe('getSecurityHeaders', () => {
    it('should return security headers', () => {
        const headers = getSecurityHeaders();

        expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
        expect(headers['X-Content-Type-Options']).toBe('nosniff');
        expect(headers['X-Frame-Options']).toBe('DENY');
        expect(headers['X-XSS-Protection']).toBe('1; mode=block');
        expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });
});
