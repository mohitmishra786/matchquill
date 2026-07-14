import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProfileHeader } from '../ProfileHeader';
import { ProfileTabs } from '../ProfileTabs';
import { ExperienceList, ProjectList, SkillList, EducationList } from '../ProfileLists';
import type { UserProfile, Experience, Project, Skill, Education } from '@/types';

// Mock the logger
vi.mock('@/lib/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
    }),
}));

describe('ProfileHeader', () => {
    const mockProfile: UserProfile = {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        experiences: [],
        projects: [],
        skills: [],
        educations: [],
        publications: [],
    };

    it('renders profile name and email', () => {
        render(
            <ProfileHeader
                profile={mockProfile}
                userEmail="john@example.com"
                onUploadResume={vi.fn()}
                onEditProfile={vi.fn()}
            />
        );

        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    it('calls onUploadResume when upload button clicked', () => {
        const onUploadResume = vi.fn();
        render(
            <ProfileHeader
                profile={mockProfile}
                userEmail="john@example.com"
                onUploadResume={onUploadResume}
                onEditProfile={vi.fn()}
            />
        );

        fireEvent.click(screen.getByText('Upload Resume'));
        expect(onUploadResume).toHaveBeenCalledTimes(1);
    });

    it('calls onEditProfile when edit button clicked', () => {
        const onEditProfile = vi.fn();
        render(
            <ProfileHeader
                profile={mockProfile}
                userEmail="john@example.com"
                onUploadResume={vi.fn()}
                onEditProfile={onEditProfile}
            />
        );

        fireEvent.click(screen.getByText('Edit Profile'));
        expect(onEditProfile).toHaveBeenCalledTimes(1);
    });
});

describe('ProfileTabs', () => {
    const tabs = [
        { id: 'experiences', label: 'Experience', count: 2 },
        { id: 'projects', label: 'Projects', count: 3 },
    ];

    it('renders all tabs', () => {
        render(
            <ProfileTabs
                tabs={tabs}
                activeTab="experiences"
                onTabChange={vi.fn()}
            />
        );

        expect(screen.getByText('Experience')).toBeInTheDocument();
        expect(screen.getByText('Projects')).toBeInTheDocument();
    });

    it('calls onTabChange when tab clicked', () => {
        const onTabChange = vi.fn();
        render(
            <ProfileTabs
                tabs={tabs}
                activeTab="experiences"
                onTabChange={onTabChange}
            />
        );

        fireEvent.click(screen.getByText('Projects'));
        expect(onTabChange).toHaveBeenCalledWith('projects');
    });
});

describe('ExperienceList', () => {
    const mockExperiences: Experience[] = [
        {
            id: '1',
            title: 'Software Engineer',
            company: 'Tech Corp',
            startDate: '2020-01-01',
            endDate: '2023-12-31',
            current: false,
            location: 'Remote',
            description: 'Developed web applications',
            highlights: ['Built API', 'Led team'],
            keywords: ['React', 'TypeScript'],
        },
    ];

    it('renders empty state when no experiences', () => {
        render(
            <ExperienceList
                experiences={[]}
                onAdd={vi.fn()}
                onEdit={vi.fn()}
            />
        );

        expect(screen.getByText('No work experience yet')).toBeInTheDocument();
    });

    it('renders experience items', () => {
        render(
            <ExperienceList
                experiences={mockExperiences}
                onAdd={vi.fn()}
                onEdit={vi.fn()}
            />
        );

        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
        expect(screen.getByText('Tech Corp')).toBeInTheDocument();
    });

    it('calls onEdit when experience item clicked', () => {
        const onEdit = vi.fn();
        render(
            <ExperienceList
                experiences={mockExperiences}
                onAdd={vi.fn()}
                onEdit={onEdit}
            />
        );

        fireEvent.click(screen.getByText('Software Engineer'));
        expect(onEdit).toHaveBeenCalledWith(mockExperiences[0]);
    });
});

describe('ProjectList', () => {
    const mockProjects: Project[] = [
        {
            id: '1',
            name: 'My Project',
            description: 'A cool project',
            url: 'https://example.com',
            technologies: ['React', 'TypeScript'],
            highlights: ['Feature 1', 'Feature 2'],
            startDate: '2023-01-01',
        },
    ];

    it('renders empty state when no projects', () => {
        render(
            <ProjectList
                projects={[]}
                onAdd={vi.fn()}
                onEdit={vi.fn()}
                onImportGitHub={vi.fn()}
            />
        );

        expect(screen.getByText('No projects yet')).toBeInTheDocument();
    });

    it('renders project items', () => {
        render(
            <ProjectList
                projects={mockProjects}
                onAdd={vi.fn()}
                onEdit={vi.fn()}
                onImportGitHub={vi.fn()}
            />
        );

        expect(screen.getByText('My Project')).toBeInTheDocument();
    });
});

describe('SkillList', () => {
    const mockSkills: Skill[] = [
        {
            id: '1',
            name: 'JavaScript',
            category: 'Programming',
            proficiency: 'Expert',
        },
        {
            id: '2',
            name: 'Python',
            category: 'Programming',
            proficiency: 'Intermediate',
        },
    ];

    it('renders empty state when no skills', () => {
        render(
            <SkillList
                skills={[]}
                onAdd={vi.fn()}
                onEdit={vi.fn()}
            />
        );

        expect(screen.getByText('No skills added')).toBeInTheDocument();
    });

    it('renders skills grouped by category', () => {
        render(
            <SkillList
                skills={mockSkills}
                onAdd={vi.fn()}
                onEdit={vi.fn()}
            />
        );

        // The category heading is visually uppercased via CSS
        // (`uppercase` class), but the underlying DOM text content is
        // rendered as-is from the `category` field ("Programming").
        expect(screen.getByText('Programming')).toBeInTheDocument();
        expect(screen.getByText('JavaScript')).toBeInTheDocument();
        expect(screen.getByText('Python')).toBeInTheDocument();
    });
});

describe('EducationList', () => {
    const mockEducations: Education[] = [
        {
            id: '1',
            degree: 'Bachelor of Science',
            field: 'Computer Science',
            institution: 'University of Example',
            startDate: '2016-09-01',
            endDate: '2020-06-01',
            gpa: 3.8,
            honors: ['Dean\'s List', ' magna cum laude'],
        },
    ];

    it('renders empty state when no educations', () => {
        render(
            <EducationList
                educations={[]}
                onAdd={vi.fn()}
                onEdit={vi.fn()}
            />
        );

        expect(screen.getByText('No education added')).toBeInTheDocument();
    });

    it('renders education items', () => {
        render(
            <EducationList
                educations={mockEducations}
                onAdd={vi.fn()}
                onEdit={vi.fn()}
            />
        );

        expect(screen.getByText('Bachelor of Science in Computer Science')).toBeInTheDocument();
        expect(screen.getByText('University of Example')).toBeInTheDocument();
    });
});
