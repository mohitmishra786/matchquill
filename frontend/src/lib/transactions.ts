/**
 * Database Transaction Utilities
 * Provides transaction handling for multi-table operations to ensure data consistency
 */

import prisma from './prisma';
import { PrismaClient, Prisma } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

/**
 * Transaction callback function type
 */
export type TransactionCallback<T> = (
    tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
) => Promise<T>;

/**
 * Transaction options
 */
export interface TransactionOptions {
    maxWait?: number; // Maximum time to wait for a transaction slot
    timeout?: number; // Maximum time for the transaction to complete
    isolationLevel?: Prisma.TransactionIsolationLevel;
}

// ============================================================================
// Transaction Wrapper
// ============================================================================

/**
 * Execute a function within a database transaction
 * Automatically rolls back on error
 * 
 * @example
 * const result = await withTransaction(async (tx) => {
 *   const user = await tx.user.create({ data: { name: 'John' } });
 *   const profile = await tx.profile.create({ data: { userId: user.id } });
 *   return { user, profile };
 * });
 */
export async function withTransaction<T>(
    callback: TransactionCallback<T>,
    options?: TransactionOptions
): Promise<T> {
    return prisma.$transaction(async (tx) => {
        return callback(tx);
    }, options);
}

/**
 * Execute a function within a transaction with automatic retry on deadlock
 * 
 * @example
 * const result = await withRetryTransaction(async (tx) => {
 *   // Your transaction logic here
 * }, { retries: 3 });
 */
export async function withRetryTransaction<T>(
    callback: TransactionCallback<T>,
    options: TransactionOptions & { retries?: number; delay?: number } = {}
): Promise<T> {
    const { retries = 3, delay = 100, ...transactionOptions } = options;
    
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await withTransaction(callback, transactionOptions);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            
            // Check if it's a deadlock error (PostgreSQL error code 40P01)
            const isDeadlock = lastError.message?.includes('40P01') || 
                              lastError.message?.toLowerCase().includes('deadlock');
            
            if (!isDeadlock || attempt === retries - 1) {
                throw lastError;
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
        }
    }
    
    throw lastError || new Error('Transaction failed after retries');
}

// ============================================================================
// Profile Operations with Transactions
// ============================================================================

/**
 * Update user profile with settings in a single transaction
 * Ensures both operations succeed or both fail
 */
export async function updateProfileWithSettings(
    userId: string,
    profileData: {
        name?: string;
        image?: string | null;
    },
    settingsData?: {
        selectedTemplate?: string;
        resumePreferences?: Record<string, unknown>;
    }
) {
    return withTransaction(async (tx) => {
        // Update user profile
        const user = await tx.user.update({
            where: { id: userId },
            data: {
                ...(profileData.name !== undefined && { name: profileData.name }),
                ...(profileData.image !== undefined && { image: profileData.image }),
            },
        });

        // Update settings if provided
        let settings = null;
        if (settingsData) {
            settings = await tx.userSettings.upsert({
                where: { userId },
                create: {
                    userId,
                    selectedTemplate: settingsData.selectedTemplate || 'experience-skills-projects',
                    resumePreferences: (settingsData.resumePreferences as Prisma.InputJsonValue) || Prisma.JsonNull,
                },
                update: {
                    ...(settingsData.selectedTemplate && { selectedTemplate: settingsData.selectedTemplate }),
                    ...(settingsData.resumePreferences !== undefined && { 
                        resumePreferences: (settingsData.resumePreferences as Prisma.InputJsonValue) || Prisma.JsonNull 
                    }),
                },
            });
        }

        return { user, settings };
    });
}

/**
 * Create multiple experiences in a single transaction.
 * Uses createManyAndReturn to avoid N+1 round-trips (one query, not N).
 */
export async function createExperiencesBatch(
    userId: string,
    experiences: Array<{
        company: string;
        title: string;
        location?: string;
        startDate: Date;
        endDate?: Date | null;
        current?: boolean;
        description: string;
        highlights?: string[];
        keywords?: string[];
    }>
) {
    if (experiences.length === 0) {
        return [];
    }

    return withTransaction(async (tx) => {
        // Single batched insert — avoids N sequential create() round-trips
        return tx.experience.createManyAndReturn({
            data: experiences.map((exp) => ({
                userId,
                company: exp.company,
                title: exp.title,
                location: exp.location || null,
                startDate: exp.startDate,
                endDate: exp.endDate || null,
                current: exp.current || false,
                description: exp.description,
                highlights: exp.highlights || [],
                keywords: exp.keywords || [],
            })),
        });
    });
}

/**
 * Create multiple skills in a single transaction.
 * Checks for duplicates within the transaction, then batch-inserts new skills.
 */
export async function createSkillsBatch(
    userId: string,
    skills: Array<{
        name: string;
        category: string;
        proficiency?: string;
        yearsExp?: number;
    }>
) {
    // Avoid opening a transaction for empty batch imports
    if (skills.length === 0) {
        return { created: [], duplicates: [] as string[] };
    }

    return withTransaction(async (tx) => {
        // Get existing skills for this user (one query)
        const existingSkills = await tx.skill.findMany({
            where: { userId },
            select: { name: true },
        });
        const existingNames = new Set(existingSkills.map((s) => s.name.toLowerCase()));

        const duplicates: string[] = [];
        const toCreate: Array<{
            userId: string;
            name: string;
            category: string;
            proficiency: string | null;
            yearsExp: number | null;
        }> = [];
        // De-dupe within the payload itself (case-insensitive)
        const seenInBatch = new Set<string>();

        for (const skill of skills) {
            const key = skill.name.toLowerCase();
            if (existingNames.has(key) || seenInBatch.has(key)) {
                duplicates.push(skill.name);
                continue;
            }
            seenInBatch.add(key);
            toCreate.push({
                userId,
                name: skill.name,
                category: skill.category,
                proficiency: skill.proficiency || null,
                yearsExp: skill.yearsExp ?? null,
            });
        }

        const created =
            toCreate.length === 0
                ? []
                : await tx.skill.createManyAndReturn({ data: toCreate });

        return { created, duplicates };
    });
}

/**
 * Create multiple educations in a single transaction (batched insert).
 */
export async function createEducationsBatch(
    userId: string,
    educations: Array<{
        institution: string;
        degree: string;
        field: string;
        startDate: Date;
        endDate?: Date | null;
        gpa?: number | null;
        honors?: string[];
    }>
) {
    if (educations.length === 0) {
        return [];
    }

    return withTransaction(async (tx) => {
        return tx.education.createManyAndReturn({
            data: educations.map((edu) => ({
                userId,
                institution: edu.institution,
                degree: edu.degree,
                field: edu.field,
                startDate: edu.startDate,
                endDate: edu.endDate || null,
                gpa: edu.gpa ?? null,
                honors: edu.honors || [],
            })),
        });
    });
}

/**
 * Create multiple projects in a single transaction (batched insert).
 */
export async function createProjectsBatch(
    userId: string,
    projects: Array<{
        name: string;
        description: string;
        url?: string | null;
        startDate?: Date | null;
        endDate?: Date | null;
        technologies?: string[];
        highlights?: string[];
    }>
) {
    if (projects.length === 0) {
        return [];
    }

    return withTransaction(async (tx) => {
        return tx.project.createManyAndReturn({
            data: projects.map((proj) => ({
                userId,
                name: proj.name,
                description: proj.description,
                url: proj.url || null,
                startDate: proj.startDate || null,
                endDate: proj.endDate || null,
                technologies: proj.technologies || [],
                highlights: proj.highlights || [],
            })),
        });
    });
}

/**
 * Delete a user and all related data in a single transaction
 * Ensures complete cleanup on user deletion
 */
export async function deleteUserWithAllData(userId: string) {
    return withTransaction(async (tx) => {
        // Delete in order of dependencies (child tables first)
        await tx.coverLetter.deleteMany({ where: { userId } });
        await tx.skill.deleteMany({ where: { userId } });
        await tx.experience.deleteMany({ where: { userId } });
        await tx.education.deleteMany({ where: { userId } });
        await tx.project.deleteMany({ where: { userId } });
        await tx.publication.deleteMany({ where: { userId } });
        await tx.userSettings.deleteMany({ where: { userId } });
        await tx.feedback.deleteMany({ where: { userId } });
        await tx.account.deleteMany({ where: { userId } });
        await tx.session.deleteMany({ where: { userId } });
        
        // Finally delete the user
        const user = await tx.user.delete({
            where: { id: userId },
        });
        
        return { deleted: true, userId: user.id };
    });
}

/**
 * Import complete profile data in a single transaction
 * Used for bulk imports (e.g., from LinkedIn or resume parsing)
 */
export async function importCompleteProfile(
    userId: string,
    data: {
        profile?: {
            name?: string;
            image?: string;
        };
        settings?: {
            selectedTemplate?: string;
            resumePreferences?: Record<string, unknown>;
        };
        experiences?: Parameters<typeof createExperiencesBatch>[1];
        educations?: Parameters<typeof createEducationsBatch>[1];
        skills?: Parameters<typeof createSkillsBatch>[1];
        projects?: Parameters<typeof createProjectsBatch>[1];
    }
) {
    return withTransaction(async (tx) => {
        const results = {
            profile: null as Record<string, unknown> | null,
            settings: null as Record<string, unknown> | null,
            experiences: [] as Record<string, unknown>[],
            educations: [] as Record<string, unknown>[],
            skills: { created: [] as Record<string, unknown>[], duplicates: [] as string[] },
            projects: [] as Record<string, unknown>[],
        };

        // Update profile
        if (data.profile) {
            results.profile = await tx.user.update({
                where: { id: userId },
                data: {
                    ...(data.profile.name && { name: data.profile.name }),
                    ...(data.profile.image && { image: data.profile.image }),
                },
            });
        }

        // Update settings
        if (data.settings) {
            results.settings = await tx.userSettings.upsert({
                where: { userId },
                create: {
                    userId,
                    selectedTemplate: data.settings.selectedTemplate || 'experience-skills-projects',
                    resumePreferences: (data.settings.resumePreferences as Prisma.InputJsonValue) || Prisma.JsonNull,
                },
                update: {
                    ...(data.settings.selectedTemplate && { selectedTemplate: data.settings.selectedTemplate }),
                    ...(data.settings.resumePreferences !== undefined && { 
                        resumePreferences: (data.settings.resumePreferences as Prisma.InputJsonValue) || Prisma.JsonNull 
                    }),
                },
            });
        }

        // Create experiences (single batched insert)
        if (data.experiences?.length) {
            results.experiences = await tx.experience.createManyAndReturn({
                data: data.experiences.map((exp) => ({
                    userId,
                    company: exp.company,
                    title: exp.title,
                    location: exp.location || null,
                    startDate: exp.startDate,
                    endDate: exp.endDate || null,
                    current: exp.current || false,
                    description: exp.description,
                    highlights: exp.highlights || [],
                    keywords: exp.keywords || [],
                })),
            });
        }

        // Create educations (single batched insert)
        if (data.educations?.length) {
            results.educations = await tx.education.createManyAndReturn({
                data: data.educations.map((edu) => ({
                    userId,
                    institution: edu.institution,
                    degree: edu.degree,
                    field: edu.field,
                    startDate: edu.startDate,
                    endDate: edu.endDate || null,
                    gpa: edu.gpa ?? null,
                    honors: edu.honors || [],
                })),
            });
        }

        // Create skills with duplicate checking, then one batch insert
        if (data.skills?.length) {
            const existingSkills = await tx.skill.findMany({
                where: { userId },
                select: { name: true },
            });
            const existingNames = new Set(existingSkills.map((s) => s.name.toLowerCase()));
            const seenInBatch = new Set<string>();
            const skillsToCreate: Array<{
                userId: string;
                name: string;
                category: string;
                proficiency: string | null;
                yearsExp: number | null;
            }> = [];

            for (const skill of data.skills) {
                const key = skill.name.toLowerCase();
                if (existingNames.has(key) || seenInBatch.has(key)) {
                    results.skills.duplicates.push(skill.name);
                    continue;
                }
                seenInBatch.add(key);
                skillsToCreate.push({
                    userId,
                    name: skill.name,
                    category: skill.category,
                    proficiency: skill.proficiency || null,
                    yearsExp: skill.yearsExp ?? null,
                });
            }

            if (skillsToCreate.length > 0) {
                results.skills.created = await tx.skill.createManyAndReturn({
                    data: skillsToCreate,
                });
            }
        }

        // Create projects (single batched insert)
        if (data.projects?.length) {
            results.projects = await tx.project.createManyAndReturn({
                data: data.projects.map((proj) => ({
                    userId,
                    name: proj.name,
                    description: proj.description,
                    url: proj.url || null,
                    startDate: proj.startDate || null,
                    endDate: proj.endDate || null,
                    technologies: proj.technologies || [],
                    highlights: proj.highlights || [],
                })),
            });
        }

        return results;
    });
}

// ============================================================================
// Transaction-aware Query Helpers
// ============================================================================

/**
 * Check if a transaction is active (for logging/debugging)
 */
export function isInTransaction(): boolean {
    // Note: Prisma doesn't expose this directly, but we can track it manually if needed
    return false;
}

/**
 * Get transaction isolation level
 */
export function getDefaultIsolationLevel(): Prisma.TransactionIsolationLevel {
    return Prisma.TransactionIsolationLevel.Serializable;
}
