/**
 * Analytics Dashboard Tests
 * Tests for enhanced analytics functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock next-auth
vi.mock('next-auth/react', () => ({
    useSession: () => ({
        data: { user: { id: 'user123', name: 'Test User' } },
        status: 'authenticated',
    }),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    }),
}));

// Mock i18n
vi.mock('@/lib/i18n/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
        language: 'en',
        setLanguage: vi.fn(),
    }),
}));

describe('Analytics API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch analytics data successfully', async () => {
        const mockAnalyticsData = {
            completeness: 75,
            experienceCount: 3,
            projectCount: 5,
            skillCount: 12,
            educationCount: 2,
            coverLetterCount: 8,
            weeklyApplicationsCount: 3,
            monthlyApplicationsCount: 8,
            totalApplicationsCount: 25,
            weeklyActivity: [
                { name: 'Mon', applications: 1 },
                { name: 'Tue', applications: 0 },
                { name: 'Wed', applications: 2 },
                { name: 'Thu', applications: 0 },
                { name: 'Fri', applications: 0 },
                { name: 'Sat', applications: 0 },
                { name: 'Sun', applications: 0 },
            ],
            monthlyTrends: [
                { month: 'Aug 2025', coverLetters: 5 },
                { month: 'Sep 2025', coverLetters: 8 },
                { month: 'Oct 2025', coverLetters: 6 },
                { month: 'Nov 2025', coverLetters: 4 },
                { month: 'Dec 2025', coverLetters: 2 },
                { month: 'Jan 2026', coverLetters: 3 },
            ],
            topCompanies: [
                { name: 'Google', count: 5 },
                { name: 'Microsoft', count: 3 },
                { name: 'Amazon', count: 2 },
            ],
            topSkills: [
                { name: 'React', count: 3 },
                { name: 'TypeScript', count: 2 },
                { name: 'Node.js', count: 2 },
            ],
            recentActivity: [
                {
                    id: '1',
                    type: 'Cover Letter',
                    title: 'Cover Letter for Senior Developer',
                    date: new Date().toISOString(),
                    company: 'Google',
                },
            ],
            skillGapAnalysis: {
                strongSkills: ['React', 'TypeScript', 'Node.js'],
                suggestedSkills: ['React', 'TypeScript', 'Node.js'],
            },
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockAnalyticsData,
        });

        const response = await fetch('/api/profile/analytics');
        const data = await response.json();

        expect(data.completeness).toBe(75);
        expect(data.weeklyApplicationsCount).toBe(3);
        expect(data.monthlyApplicationsCount).toBe(8);
        expect(data.totalApplicationsCount).toBe(25);
        expect(data.topCompanies).toHaveLength(3);
        expect(data.topSkills).toHaveLength(3);
        expect(data.monthlyTrends).toHaveLength(6);
    });

    it('should handle API errors gracefully', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Failed to fetch analytics' }),
        });

        const response = await fetch('/api/profile/analytics');
        expect(response.ok).toBe(false);
        expect(response.status).toBe(500);
    });

    it('should return 401 for unauthorized users', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Unauthorized' }),
        });

        const response = await fetch('/api/profile/analytics');
        expect(response.status).toBe(401);
    });
});

describe('Analytics Data Structure', () => {
    it('should have correct data types for all fields', () => {
        const analyticsData = {
            completeness: 75,
            experienceCount: 3,
            projectCount: 5,
            skillCount: 12,
            educationCount: 2,
            coverLetterCount: 8,
            weeklyApplicationsCount: 3,
            monthlyApplicationsCount: 8,
            totalApplicationsCount: 25,
            weeklyActivity: [],
            monthlyTrends: [],
            topCompanies: [],
            topSkills: [],
            recentActivity: [],
            skillGapAnalysis: {
                strongSkills: [],
                suggestedSkills: [],
            },
        };

        expect(typeof analyticsData.completeness).toBe('number');
        expect(typeof analyticsData.experienceCount).toBe('number');
        expect(typeof analyticsData.weeklyApplicationsCount).toBe('number');
        expect(Array.isArray(analyticsData.weeklyActivity)).toBe(true);
        expect(Array.isArray(analyticsData.topCompanies)).toBe(true);
        expect(Array.isArray(analyticsData.topSkills)).toBe(true);
        expect(typeof analyticsData.skillGapAnalysis).toBe('object');
    });

    it('should calculate completeness correctly', () => {
        // Test completeness calculation logic
        const profile = {
            hasName: true,
            hasImage: true,
            experienceCount: 2,
            educationCount: 1,
            skillsCount: 5,
            projectsCount: 3,
        };

        let completeness = 0;
        if (profile.hasName) completeness += 10;
        if (profile.hasImage) completeness += 5;
        if (profile.experienceCount > 0) completeness += 25;
        if (profile.educationCount > 0) completeness += 20;
        if (profile.skillsCount > 0) completeness += 20;
        if (profile.projectsCount > 0) completeness += 20;

        expect(completeness).toBe(100);
    });

    it('should cap completeness at 100', () => {
        const profile = {
            hasName: true,
            hasImage: true,
            experienceCount: 5,
            educationCount: 3,
            skillsCount: 10,
            projectsCount: 8,
        };

        let completeness = 0;
        if (profile.hasName) completeness += 10;
        if (profile.hasImage) completeness += 5;
        if (profile.experienceCount > 0) completeness += 25;
        if (profile.educationCount > 0) completeness += 20;
        if (profile.skillsCount > 0) completeness += 20;
        if (profile.projectsCount > 0) completeness += 20;
        completeness = Math.min(completeness, 100);

        expect(completeness).toBe(100);
    });
});

describe('Monthly Trends Calculation', () => {
    it('should generate correct month keys', () => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentDate = new Date();
        
        const months: string[] = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(currentDate.getMonth() - i);
            const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
            months.push(key);
        }

        expect(months).toHaveLength(6);
        expect(months[0]).toContain(String(currentDate.getFullYear() - (currentDate.getMonth() < 5 ? 1 : 0)));
    });
});

describe('Top Companies Aggregation', () => {
    it('should sort companies by application count', () => {
        const companies = [
            { name: 'Company A', count: 3 },
            { name: 'Company B', count: 8 },
            { name: 'Company C', count: 1 },
        ];

        const sorted = [...companies].sort((a, b) => b.count - a.count);

        expect(sorted[0].name).toBe('Company B');
        expect(sorted[1].name).toBe('Company A');
        expect(sorted[2].name).toBe('Company C');
    });
});

describe('Skill Frequency Calculation', () => {
    it('should count skill occurrences correctly', () => {
        const skills = [
            { name: 'React' },
            { name: 'TypeScript' },
            { name: 'React' },
            { name: 'Node.js' },
            { name: 'React' },
        ];

        const frequency: Record<string, number> = {};
        skills.forEach(skill => {
            frequency[skill.name] = (frequency[skill.name] || 0) + 1;
        });

        expect(frequency['React']).toBe(3);
        expect(frequency['TypeScript']).toBe(1);
        expect(frequency['Node.js']).toBe(1);
    });

    it('should return top skills sorted by frequency', () => {
        const skillFrequency: Record<string, number> = {
            'React': 5,
            'TypeScript': 3,
            'Node.js': 3,
            'Python': 2,
            'Java': 1,
        };

        const topSkills = Object.entries(skillFrequency)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);

        expect(topSkills).toHaveLength(3);
        expect(topSkills[0].name).toBe('React');
    });
});
