/**
 * Database Transaction Utility Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    withTransaction,
    withRetryTransaction,
    updateProfileWithSettings,
    createExperiencesBatch,
    createSkillsBatch,
    createEducationsBatch,
    createProjectsBatch,
    deleteUserWithAllData,
    importCompleteProfile,
} from '../transactions';
import prisma from '../prisma';

// Mock prisma
vi.mock('../prisma', () => ({
    default: {
        $transaction: vi.fn(),
        user: {
            update: vi.fn(),
            delete: vi.fn(),
        },
        userSettings: {
            upsert: vi.fn(),
            deleteMany: vi.fn(),
        },
        experience: {
            create: vi.fn(),
            deleteMany: vi.fn(),
        },
        skill: {
            create: vi.fn(),
            findMany: vi.fn(),
            deleteMany: vi.fn(),
        },
        education: {
            create: vi.fn(),
            deleteMany: vi.fn(),
        },
        project: {
            create: vi.fn(),
            deleteMany: vi.fn(),
        },
        coverLetter: {
            deleteMany: vi.fn(),
        },
        publication: {
            deleteMany: vi.fn(),
        },
        account: {
            deleteMany: vi.fn(),
        },
        session: {
            deleteMany: vi.fn(),
        },
        feedback: {
            deleteMany: vi.fn(),
        },
    },
}));

describe('withTransaction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should execute callback within transaction', async () => {
        const mockTx = {
            user: { create: vi.fn().mockResolvedValue({ id: 'user-1' }) },
        };
        
        (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
            return callback(mockTx);
        });

        const result = await withTransaction(async (tx) => {
            return tx.user.create({ data: { name: 'Test', email: 'test@example.com' } });
        });

        expect(result).toEqual({ id: 'user-1' });
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors', async () => {
        (prisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Transaction failed'));

        await expect(
            withTransaction(async () => {
                return 'success';
            })
        ).rejects.toThrow('Transaction failed');
    });
});

describe('withRetryTransaction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should succeed on first attempt', async () => {
        (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue('success');

        const result = await withRetryTransaction(async () => 'success', { retries: 3 });

        expect(result).toBe('success');
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should retry on deadlock error', async () => {
        const error = new Error('Deadlock detected (40P01)');
        (prisma.$transaction as ReturnType<typeof vi.fn>)
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce('success');

        const result = await withRetryTransaction(async () => 'success', { retries: 3, delay: 0 });

        expect(result).toBe('success');
        expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
        const error = new Error('Deadlock detected (40P01)');
        (prisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValue(error);

        await expect(
            withRetryTransaction(async () => 'success', { retries: 2, delay: 0 })
        ).rejects.toThrow('Deadlock detected');

        expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-deadlock errors', async () => {
        const error = new Error('Some other error');
        (prisma.$transaction as ReturnType<typeof vi.fn>).mockRejectedValue(error);

        await expect(
            withRetryTransaction(async () => 'success', { retries: 3 })
        ).rejects.toThrow('Some other error');

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
});

describe('updateProfileWithSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should update profile and settings in transaction', async () => {
        const mockUser = { id: 'user-1', name: 'John' };
        const mockSettings = { id: 'settings-1', userId: 'user-1', selectedTemplate: 'modern' };

        const mockTx = {
            user: {
                update: vi.fn().mockResolvedValue(mockUser),
            },
            userSettings: {
                upsert: vi.fn().mockResolvedValue(mockSettings),
            },
        };

        (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
            return callback(mockTx);
        });

        const result = await updateProfileWithSettings(
            'user-1',
            { name: 'John' },
            { selectedTemplate: 'modern' }
        );

        expect(result.user).toEqual(mockUser);
        expect(result.settings).toEqual(mockSettings);
        expect(mockTx.user.update).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            data: { name: 'John' },
        });
    });

    it('should update only profile when settings not provided', async () => {
        const mockUser = { id: 'user-1', name: 'John' };

        const mockTx = {
            user: {
                update: vi.fn().mockResolvedValue(mockUser),
            },
            userSettings: {
                upsert: vi.fn(),
            },
        };

        (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
            return callback(mockTx);
        });

        const result = await updateProfileWithSettings('user-1', { name: 'John' });

        expect(result.user).toEqual(mockUser);
        expect(result.settings).toBeNull();
        expect(mockTx.userSettings.upsert).not.toHaveBeenCalled();
    });
});

describe('createExperiencesBatch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should batch-create multiple experiences with createManyAndReturn', async () => {
        const experiences = [
            { company: 'Acme', title: 'Dev', description: 'Worked', startDate: new Date('2020-01-01') },
            { company: 'TechCorp', title: 'Senior Dev', description: 'Led team', startDate: new Date('2022-01-01') },
        ];

        const mockTx = {
            experience: {
                createManyAndReturn: vi.fn().mockResolvedValue([
                    { id: 'exp-1', ...experiences[0] },
                    { id: 'exp-2', ...experiences[1] },
                ]),
                create: vi.fn(),
            },
        };

        (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
            return callback(mockTx);
        });

        const result = await createExperiencesBatch('user-1', experiences);

        expect(result).toHaveLength(2);
        // One batched call instead of N create() round-trips
        expect(mockTx.experience.createManyAndReturn).toHaveBeenCalledTimes(1);
        expect(mockTx.experience.create).not.toHaveBeenCalled();
        expect(mockTx.experience.createManyAndReturn).toHaveBeenCalledWith({
            data: expect.arrayContaining([
                expect.objectContaining({ userId: 'user-1', company: 'Acme' }),
                expect.objectContaining({ userId: 'user-1', company: 'TechCorp' }),
            ]),
        });
    });

    it('should short-circuit on empty input without a DB write', async () => {
        const result = await createExperiencesBatch('user-1', []);
        expect(result).toEqual([]);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});

describe('createSkillsBatch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should batch-create skills and handle duplicates', async () => {
        const skills = [
            { name: 'JavaScript', category: 'Programming' },
            { name: 'Python', category: 'Programming' },
        ];

        const mockTx = {
            skill: {
                findMany: vi.fn().mockResolvedValue([]),
                createManyAndReturn: vi.fn().mockResolvedValue([
                    { id: 'skill-1', ...skills[0] },
                    { id: 'skill-2', ...skills[1] },
                ]),
                create: vi.fn(),
            },
        };

        (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
            return callback(mockTx);
        });

        const result = await createSkillsBatch('user-1', skills);

        expect(result.created).toHaveLength(2);
        expect(result.duplicates).toHaveLength(0);
        expect(mockTx.skill.createManyAndReturn).toHaveBeenCalledTimes(1);
        expect(mockTx.skill.create).not.toHaveBeenCalled();
    });

    it('should skip existing skills', async () => {
        const skills = [
            { name: 'JavaScript', category: 'Programming' },
            { name: 'Python', category: 'Programming' },
        ];

        const mockTx = {
            skill: {
                findMany: vi.fn().mockResolvedValue([{ name: 'javascript' }]),
                createManyAndReturn: vi.fn().mockResolvedValue([
                    { id: 'skill-2', name: 'Python', category: 'Programming' },
                ]),
                create: vi.fn(),
            },
        };

        (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
            return callback(mockTx);
        });

        const result = await createSkillsBatch('user-1', skills);

        expect(result.created).toHaveLength(1);
        expect(result.duplicates).toContain('JavaScript');
        expect(mockTx.skill.createManyAndReturn).toHaveBeenCalledWith({
            data: [expect.objectContaining({ name: 'Python' })],
        });
    });
});

describe('createEducationsBatch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should batch-create multiple educations with createManyAndReturn', async () => {
        const educations = [
            { institution: 'MIT', degree: 'BS', field: 'CS', startDate: new Date('2016-09-01') },
            { institution: 'Stanford', degree: 'MS', field: 'AI', startDate: new Date('2020-09-01') },
        ];

        const mockTx = {
            education: {
                createManyAndReturn: vi.fn().mockResolvedValue([
                    { id: 'edu-1', ...educations[0] },
                    { id: 'edu-2', ...educations[1] },
                ]),
                create: vi.fn(),
            },
        };

        (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
            return callback(mockTx);
        });

        const result = await createEducationsBatch('user-1', educations);

        expect(result).toHaveLength(2);
        expect(mockTx.education.createManyAndReturn).toHaveBeenCalledTimes(1);
        expect(mockTx.education.create).not.toHaveBeenCalled();
    });
});

describe('createProjectsBatch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should batch-create multiple projects with createManyAndReturn', async () => {
        const projects = [
            { name: 'Project A', description: 'Description A' },
            { name: 'Project B', description: 'Description B' },
        ];

        const mockTx = {
            project: {
                createManyAndReturn: vi.fn().mockResolvedValue([
                    { id: 'proj-1', ...projects[0] },
                    { id: 'proj-2', ...projects[1] },
                ]),
                create: vi.fn(),
            },
        };

        (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
            return callback(mockTx);
        });

        const result = await createProjectsBatch('user-1', projects);

        expect(result).toHaveLength(2);
        expect(mockTx.project.createManyAndReturn).toHaveBeenCalledTimes(1);
        expect(mockTx.project.create).not.toHaveBeenCalled();
    });
});

describe('deleteUserWithAllData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should delete user and all related data in transaction', async () => {
        const mockTx = {
            coverLetter: { deleteMany: vi.fn().mockResolvedValue({ count: 5 }) },
            skill: { deleteMany: vi.fn().mockResolvedValue({ count: 10 }) },
            experience: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
            education: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
            project: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
            publication: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
            userSettings: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
            feedback: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
            account: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
            session: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
            user: { delete: vi.fn().mockResolvedValue({ id: 'user-1' }) },
        };

        (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
            return callback(mockTx);
        });

        const result = await deleteUserWithAllData('user-1');

        expect(result.deleted).toBe(true);
        expect(result.userId).toBe('user-1');
        expect(mockTx.coverLetter.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
        expect(mockTx.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });
});

describe('importCompleteProfile', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should import complete profile data using batched inserts', async () => {
        const mockTx = {
            user: {
                update: vi.fn().mockResolvedValue({ id: 'user-1', name: 'John' }),
            },
            userSettings: {
                upsert: vi.fn().mockResolvedValue({ id: 'settings-1', selectedTemplate: 'modern' }),
            },
            experience: {
                createManyAndReturn: vi.fn().mockResolvedValue([{ id: 'exp-1' }]),
                create: vi.fn(),
            },
            education: {
                createManyAndReturn: vi.fn().mockResolvedValue([{ id: 'edu-1' }]),
                create: vi.fn(),
            },
            skill: {
                findMany: vi.fn().mockResolvedValue([]),
                createManyAndReturn: vi.fn().mockResolvedValue([{ id: 'skill-1' }]),
                create: vi.fn(),
            },
            project: {
                createManyAndReturn: vi.fn().mockResolvedValue([{ id: 'proj-1' }]),
                create: vi.fn(),
            },
        };

        (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
            return callback(mockTx);
        });

        const result = await importCompleteProfile('user-1', {
            profile: { name: 'John' },
            settings: { selectedTemplate: 'modern' },
            experiences: [{ company: 'Acme', title: 'Dev', description: 'Worked', startDate: new Date() }],
            educations: [{ institution: 'MIT', degree: 'BS', field: 'CS', startDate: new Date() }],
            skills: [{ name: 'JavaScript', category: 'Programming' }],
            projects: [{ name: 'Project A', description: 'Description' }],
        });

        expect(result.profile).toBeDefined();
        expect(result.settings).toBeDefined();
        expect(result.experiences).toHaveLength(1);
        expect(result.educations).toHaveLength(1);
        expect(result.skills.created).toHaveLength(1);
        expect(result.projects).toHaveLength(1);
        // Ensure N+1 create() is not used
        expect(mockTx.experience.create).not.toHaveBeenCalled();
        expect(mockTx.education.create).not.toHaveBeenCalled();
        expect(mockTx.skill.create).not.toHaveBeenCalled();
        expect(mockTx.project.create).not.toHaveBeenCalled();
        expect(mockTx.experience.createManyAndReturn).toHaveBeenCalledTimes(1);
    });

    it('should handle partial imports', async () => {
        const mockTx = {
            user: {
                update: vi.fn().mockResolvedValue({ id: 'user-1', name: 'John' }),
            },
            userSettings: {
                upsert: vi.fn(),
            },
            experience: {
                createManyAndReturn: vi.fn(),
                create: vi.fn(),
            },
            education: {
                createManyAndReturn: vi.fn(),
                create: vi.fn(),
            },
            skill: {
                findMany: vi.fn().mockResolvedValue([]),
                createManyAndReturn: vi.fn(),
                create: vi.fn(),
            },
            project: {
                createManyAndReturn: vi.fn(),
                create: vi.fn(),
            },
        };

        (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (callback) => {
            return callback(mockTx);
        });

        const result = await importCompleteProfile('user-1', {
            profile: { name: 'John' },
        });

        expect(result.profile).toBeDefined();
        expect(result.settings).toBeNull();
        expect(result.experiences).toHaveLength(0);
        expect(mockTx.experience.createManyAndReturn).not.toHaveBeenCalled();
        expect(mockTx.experience.create).not.toHaveBeenCalled();
    });
});
