/**
 * Public profile privacy unit tests
 */

import { describe, it, expect } from 'vitest';
import {
    parsePublicPreferences,
    buildPublicProfile,
    DEFAULT_PUBLIC_PREFERENCES,
    type PublicProfileInput,
} from '../publicProfile';

function baseUser(overrides: Partial<PublicProfileInput> = {}): PublicProfileInput {
    return {
        name: 'Jane Doe',
        image: 'https://cdn.example.com/avatar.png',
        email: 'jane@example.com',
        experiences: [
            {
                id: 'exp-1',
                userId: 'user-1',
                company: 'Acme',
                title: 'Engineer',
                location: 'NYC',
                startDate: '2020-01-01',
                endDate: null,
                current: true,
                description: 'Built things <script>alert(1)</script>',
                highlights: ['Shipped product'],
                keywords: ['secret-keyword'],
            },
        ],
        projects: [
            {
                id: 'proj-1',
                userId: 'user-1',
                name: 'Cool App',
                description: 'A project',
                url: 'https://example.com',
                technologies: ['React'],
                highlights: ['Feature'],
            },
        ],
        educations: [
            {
                id: 'edu-1',
                userId: 'user-1',
                institution: 'State U',
                degree: 'BS',
                field: 'CS',
                startDate: '2016-01-01',
                endDate: '2020-01-01',
                gpa: 3.9,
                honors: ['Dean List'],
            },
        ],
        skills: [
            {
                id: 'skill-1',
                userId: 'user-1',
                name: 'TypeScript',
                category: 'Languages',
                proficiency: 'Expert',
                yearsExp: 5,
            },
        ],
        publications: [
            {
                id: 'pub-1',
                userId: 'user-1',
                title: 'Paper',
                venue: 'Conf',
                authors: ['Jane'],
                date: '2021-01-01',
                url: 'https://doi.org/x',
                abstract: 'Long abstract',
            },
        ],
        settings: {
            resumePreferences: { isPublic: true },
        },
        ...overrides,
    };
}

describe('parsePublicPreferences', () => {
    it('returns defaults when preferences are missing', () => {
        expect(parsePublicPreferences(null)).toEqual(DEFAULT_PUBLIC_PREFERENCES);
        expect(parsePublicPreferences(undefined)).toEqual(DEFAULT_PUBLIC_PREFERENCES);
    });

    it('reads top-level isPublic for backwards compatibility', () => {
        const prefs = parsePublicPreferences({ isPublic: true });
        expect(prefs.isPublic).toBe(true);
        expect(prefs.showSkills).toBe(true);
        expect(prefs.showExperiences).toBe(true);
        expect(prefs.showProjects).toBe(false);
    });

    it('merges nested publicPreferences', () => {
        const prefs = parsePublicPreferences({
            isPublic: true,
            publicPreferences: {
                showProjects: true,
                showContact: true,
                showSkills: false,
            },
        });
        expect(prefs.isPublic).toBe(true);
        expect(prefs.showProjects).toBe(true);
        expect(prefs.showContact).toBe(true);
        expect(prefs.showSkills).toBe(false);
    });
});

describe('buildPublicProfile', () => {
    it('returns null when profile is not public', () => {
        expect(buildPublicProfile(baseUser({ settings: { resumePreferences: {} } }))).toBeNull();
        expect(
            buildPublicProfile(
                baseUser({ settings: { resumePreferences: { isPublic: false } } })
            )
        ).toBeNull();
        expect(buildPublicProfile(baseUser({ settings: null }))).toBeNull();
    });

    it('returns safe default subset: name, image, skills, experiences without details', () => {
        const profile = buildPublicProfile(baseUser());
        expect(profile).not.toBeNull();
        expect(profile!.name).toBe('Jane Doe');
        expect(profile!.image).toBe('https://cdn.example.com/avatar.png');

        // Skills: name + category only
        expect(profile!.skills).toHaveLength(1);
        expect(profile!.skills![0]).toEqual({
            name: 'TypeScript',
            category: 'Languages',
        });
        expect(profile!.skills![0]).not.toHaveProperty('proficiency');
        expect(profile!.skills![0]).not.toHaveProperty('yearsExp');
        expect(profile!.skills![0]).not.toHaveProperty('id');
        expect(profile!.skills![0]).not.toHaveProperty('userId');

        // Experiences without detailed notes by default
        expect(profile!.experiences).toHaveLength(1);
        expect(profile!.experiences![0]).toMatchObject({
            company: 'Acme',
            title: 'Engineer',
            location: 'NYC',
            current: true,
        });
        expect(profile!.experiences![0]).not.toHaveProperty('description');
        expect(profile!.experiences![0]).not.toHaveProperty('highlights');
        expect(profile!.experiences![0]).not.toHaveProperty('keywords');
        expect(profile!.experiences![0]).not.toHaveProperty('id');
        expect(profile!.experiences![0]).not.toHaveProperty('userId');

        // Optional sections off by default
        expect(profile!.projects).toBeUndefined();
        expect(profile!.educations).toBeUndefined();
        expect(profile!.publications).toBeUndefined();
        expect(profile!.contact).toBeUndefined();
    });

    it('never includes email unless showContact is enabled', () => {
        const withoutContact = buildPublicProfile(baseUser());
        expect(withoutContact).not.toHaveProperty('email');
        expect(withoutContact!.contact).toBeUndefined();

        const withContact = buildPublicProfile(
            baseUser({
                settings: {
                    resumePreferences: {
                        isPublic: true,
                        publicPreferences: { showContact: true },
                    },
                },
            })
        );
        expect(withContact!.contact).toEqual({ email: 'jane@example.com' });
        expect(withContact).not.toHaveProperty('email');
    });

    it('includes projects/educations/publications when enabled', () => {
        const profile = buildPublicProfile(
            baseUser({
                settings: {
                    resumePreferences: {
                        isPublic: true,
                        publicPreferences: {
                            showProjects: true,
                            showEducations: true,
                            showPublications: true,
                        },
                    },
                },
            })
        );

        expect(profile!.projects).toHaveLength(1);
        expect(profile!.projects![0]).not.toHaveProperty('userId');
        expect(profile!.projects![0]).not.toHaveProperty('id');

        expect(profile!.educations).toHaveLength(1);
        expect(profile!.educations![0]).not.toHaveProperty('userId');

        expect(profile!.publications).toHaveLength(1);
        expect(profile!.publications![0]).not.toHaveProperty('abstract');
        expect(profile!.publications![0]).not.toHaveProperty('userId');
    });

    it('includes experience details only when showExperienceDetails is true', () => {
        const profile = buildPublicProfile(
            baseUser({
                settings: {
                    resumePreferences: {
                        isPublic: true,
                        publicPreferences: { showExperienceDetails: true },
                    },
                },
            })
        );

        expect(profile!.experiences![0]).toHaveProperty('description');
        expect(profile!.experiences![0].description).not.toContain('<script>');
        expect(profile!.experiences![0]).toHaveProperty('highlights');
        expect(profile!.experiences![0]).not.toHaveProperty('keywords');
    });

    it('sanitizes XSS in name and skill fields', () => {
        const profile = buildPublicProfile(
            baseUser({
                name: '<script>alert(1)</script>Jane',
                skills: [
                    {
                        name: '<img src=x onerror=alert(1)>TS',
                        category: '<b>Lang</b>',
                    },
                ],
            })
        );

        expect(profile!.name).not.toContain('<script>');
        expect(profile!.name).toContain('Jane');
        expect(profile!.skills![0].name).not.toContain('<img');
        expect(profile!.skills![0].category).not.toContain('<b>');
    });

    it('omits skills when showSkills is false', () => {
        const profile = buildPublicProfile(
            baseUser({
                settings: {
                    resumePreferences: {
                        isPublic: true,
                        publicPreferences: { showSkills: false },
                    },
                },
            })
        );
        expect(profile!.skills).toBeUndefined();
    });

    it('omits experiences when showExperiences is false', () => {
        const profile = buildPublicProfile(
            baseUser({
                settings: {
                    resumePreferences: {
                        isPublic: true,
                        publicPreferences: { showExperiences: false },
                    },
                },
            })
        );
        expect(profile!.experiences).toBeUndefined();
    });
});
