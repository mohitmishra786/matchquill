'use client';

/**
 * Profile Page
 * Main dashboard for managing career profile
 * Refactored to use smaller, focused components
 */

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { UserProfile, Experience, Project, Skill, Education } from '@/types';
import { createLogger } from '@/lib/logger';
import { useToast } from '@/components/ui/ToastProvider';
import Modal from '@/components/ui/Modal';
import ProfileSkeleton from '@/components/skeletons/ProfileSkeleton';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { ExperienceList, ProjectList, SkillList, EducationList } from '@/components/profile/ProfileLists';
import { applyOptimisticItemUpdate } from '@/lib/profile-optimistic';

// Heavy form/modal trees are only needed after interaction — keep initial paint light.
const ExperienceForm = dynamic(() => import('@/components/forms/ExperienceForm'), { ssr: false });
const ProjectForm = dynamic(() => import('@/components/forms/ProjectForm'), { ssr: false });
const SkillForm = dynamic(() => import('@/components/forms/SkillForm'), { ssr: false });
const EducationForm = dynamic(() => import('@/components/forms/EducationForm'), { ssr: false });
const ProfileEditForm = dynamic(() => import('@/components/forms/ProfileEditForm'), { ssr: false });
const CoverLetterSection = dynamic(() => import('@/components/CoverLetterSection'), { ssr: false });
const ResumeUpload = dynamic(() => import('@/components/ResumeUpload'), { ssr: false });
const ShareProfileModal = dynamic(() => import('@/components/ui/ShareProfileModal'), { ssr: false });
const GitHubImportModal = dynamic(() => import('@/components/GitHubImportModal'), { ssr: false });

const logger = createLogger({ component: 'ProfilePage' });

type ModalType = 'profile' | 'experience' | 'project' | 'skill' | 'education' | 'upload' | null;

type ProfileCollectionKey = 'experiences' | 'projects' | 'skills' | 'educations';

export default function ProfilePage() {
    const { data: session, status } = useSession();
    const { success, error: toastError } = useToast();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('experiences');
    const [modalType, setModalType] = useState<ModalType>(null);
    const [editingItem, setEditingItem] = useState<Experience | Project | Skill | Education | null>(null);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [githubModalOpen, setGithubModalOpen] = useState(false);

    // Memoized tabs configuration
    const tabs = useMemo(() => [
        { id: 'experiences', label: 'Experience', count: profile?.experiences?.length || 0 },
        { id: 'projects', label: 'Projects', count: profile?.projects?.length || 0 },
        { id: 'skills', label: 'Skills', count: profile?.skills?.length || 0 },
        { id: 'education', label: 'Education', count: profile?.educations?.length || 0 },
        { id: 'cover-letters', label: 'Cover Letters', count: 0 },
    ], [profile]);

    const fetchProfile = useCallback(async () => {
        logger.startOperation('ProfilePage:fetchProfile');
        try {
            const response = await fetch('/api/profile');
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                logger.failOperation('ProfilePage:fetchProfile', errorBody);
                toastError(errorBody?.message ?? 'Failed to load profile data');
                return;
            }
            const data = await response.json();
            setProfile(data);
            logger.info('[ProfilePage] Profile fetched', {
                experiencesCount: data.experiences?.length,
                projectsCount: data.projects?.length,
                skillsCount: data.skills?.length,
                educationsCount: data.educations?.length,
            });
            logger.endOperation('ProfilePage:fetchProfile');
        } catch (error) {
            logger.failOperation('ProfilePage:fetchProfile', error);
            toastError('Failed to load profile data');
        } finally {
            setLoading(false);
        }
    }, [toastError]);

    useEffect(() => {
        if (status === 'authenticated') {
            logger.info('[ProfilePage] User authenticated, fetching profile');
            fetchProfile();
        } else if (status === 'unauthenticated') {
            setLoading(false);
        }
    }, [status, fetchProfile]);

    const openModal = useCallback((type: ModalType, item?: Experience | Project | Skill | Education) => {
        logger.info('[ProfilePage] Opening modal', { type, hasItem: !!item });
        setModalType(type);
        setEditingItem(item || null);
    }, []);

    const closeModal = useCallback(() => {
        logger.debug('[ProfilePage] Closing modal');
        setModalType(null);
        setEditingItem(null);
    }, []);

    /**
     * Generic save handler: optimistically merges the API response into local state.
     * Refetches only when the response payload is missing or unusable.
     */
    const createSaveHandler = useCallback((
        endpoint: string,
        collectionKey: ProfileCollectionKey,
        operationName: string,
        successMessage: string,
        updateMessage: string
    ) => {
        return async (data: Record<string, unknown>) => {
            logger.startOperation(`ProfilePage:${operationName}`);
            try {
                const editingId = editingItem?.id;
                const method = editingId ? 'PUT' : 'POST';
                const url = editingId
                    ? `/api/profile/${endpoint}?id=${editingId}`
                    : `/api/profile/${endpoint}`;

                const response = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });

                if (!response.ok) {
                    throw new Error(`Failed to save ${operationName.toLowerCase()}`);
                }

                const body = await response.json().catch(() => ({}));
                const saved = (body?.data ?? body) as { id?: string } | undefined;

                if (saved && typeof saved === 'object' && saved.id) {
                    setProfile((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            [collectionKey]: applyOptimisticItemUpdate(
                                prev[collectionKey] as Array<{ id: string }>,
                                saved as { id: string },
                                editingId
                            ),
                        };
                    });
                    logger.info(`[ProfilePage] ${operationName} saved optimistically`, { id: saved.id });
                } else {
                    // Fallback when API does not return the entity
                    logger.warn(`[ProfilePage] ${operationName} missing entity in response; refetching`);
                    await fetchProfile();
                }

                logger.endOperation(`ProfilePage:${operationName}`);
                success(editingId ? updateMessage : successMessage);
                closeModal();
            } catch (error) {
                logger.failOperation(`ProfilePage:${operationName}`, error);
                toastError(`Failed to save ${operationName.toLowerCase()}. Please try again.`);
                // Re-sync after failure so UI matches server
                try {
                    await fetchProfile();
                } catch {
                    /* already logged via toast */
                }
                throw error;
            }
        };
    }, [editingItem, success, closeModal, fetchProfile, toastError]);

    // Handlers using the factory
    const handleExperienceSubmit = useMemo(() =>
        createSaveHandler('experiences', 'experiences', 'saveExperience', 'Experience added successfully', 'Experience updated successfully'),
    [createSaveHandler]);

    const handleProjectSubmit = useMemo(() =>
        createSaveHandler('projects', 'projects', 'saveProject', 'Project added successfully', 'Project updated successfully'),
    [createSaveHandler]);

    const handleSkillSubmit = useMemo(() =>
        createSaveHandler('skills', 'skills', 'saveSkill', 'Skill added successfully', 'Skill updated successfully'),
    [createSaveHandler]);

    const handleEducationSubmit = useMemo(() =>
        createSaveHandler('educations', 'educations', 'saveEducation', 'Education added successfully', 'Education updated successfully'),
    [createSaveHandler]);

    const handleProfileSubmit = useCallback(async (data: { name: string; image?: string }) => {
        logger.startOperation('ProfilePage:saveProfile');
        try {
            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error('Failed to update profile');
            }

            // Optimistic local update — no full refetch needed
            setProfile((prev) =>
                prev
                    ? {
                          ...prev,
                          name: data.name,
                          image: data.image ?? prev.image,
                      }
                    : prev
            );

            logger.info('[ProfilePage] Profile updated optimistically');
            logger.endOperation('ProfilePage:saveProfile');
            success('Profile updated successfully');
            closeModal();
        } catch (error) {
            logger.failOperation('ProfilePage:saveProfile', error);
            toastError('Failed to update profile. Please try again.');
            try {
                await fetchProfile();
            } catch {
                /* already toasted */
            }
            throw error;
        }
    }, [success, closeModal, fetchProfile, toastError]);

    const handleResumeDataExtracted = useCallback(async (data: Record<string, unknown>) => {
        logger.info('[ProfilePage] Resume data extracted', {
            hasName: !!data.name,
            experiencesCount: (data.experiences as unknown[])?.length,
            skillsCount: (data.skills as unknown[])?.length,
            educationCount: (data.education as unknown[])?.length,
            projectsCount: (data.projects as unknown[])?.length,
            extractionMethod: data.extraction_method,
        });
        success('Resume uploaded and parsed successfully!');
        closeModal();
        // Resume upload mutates many collections server-side; full refetch is necessary
        await fetchProfile();
    }, [success, closeModal, fetchProfile]);

    const handleGitHubImport = useCallback(async (projects: Partial<Project>[]) => {
        logger.startOperation('ProfilePage:importGitHub');
        try {
            // allSettled keeps successful imports when individual POSTs fail
            const settled = await Promise.allSettled(
                projects.map(async (project) => {
                    const response = await fetch('/api/profile/projects', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(project),
                    });
                    if (!response.ok) {
                        throw new Error(`Failed to import project (${response.status})`);
                    }
                    const body = await response.json().catch(() => ({}));
                    return (body?.data ?? body) as Project | undefined;
                })
            );

            const imported = settled
                .filter((r): r is PromiseFulfilledResult<Project | undefined> => r.status === 'fulfilled')
                .map((r) => r.value)
                .filter((p): p is Project => !!p && typeof p === 'object' && !!p.id);

            const failedCount = settled.filter((r) => r.status === 'rejected').length;

            if (imported.length > 0) {
                setProfile((prev) => {
                    if (!prev) return prev;
                    const existing = prev.projects ?? [];
                    const existingIds = new Set(existing.map((p) => p.id));
                    const newOnes = imported.filter((p) => !existingIds.has(p.id));
                    return {
                        ...prev,
                        projects: [...newOnes, ...existing],
                    };
                });
            } else {
                // Nothing imported successfully — re-sync from server
                await fetchProfile();
            }

            logger.info('[ProfilePage] GitHub projects imported', {
                count: imported.length,
                failed: failedCount,
            });
            logger.endOperation('ProfilePage:importGitHub');
            if (failedCount === 0) {
                success(`${imported.length} projects imported successfully`);
            } else if (imported.length > 0) {
                success(`${imported.length} imported; ${failedCount} failed`);
            } else {
                toastError('Failed to import projects');
            }
        } catch (error) {
            logger.failOperation('ProfilePage:importGitHub', error);
            toastError('Failed to import some projects');
            try {
                await fetchProfile();
            } catch {
                /* already toasted */
            }
        }
    }, [success, fetchProfile, toastError]);

    // Memoized tab content renderer
    const renderTabContent = useMemo(() => {
        switch (activeTab) {
            case 'experiences':
                return (
                    <ExperienceList
                        experiences={profile?.experiences || []}
                        onAdd={() => openModal('experience')}
                        onEdit={(exp) => openModal('experience', exp)}
                    />
                );
            case 'projects':
                return (
                    <ProjectList
                        projects={profile?.projects || []}
                        onAdd={() => openModal('project')}
                        onEdit={(proj) => openModal('project', proj)}
                        onImportGitHub={() => setGithubModalOpen(true)}
                    />
                );
            case 'skills':
                return (
                    <SkillList
                        skills={profile?.skills || []}
                        onAdd={() => openModal('skill')}
                        onEdit={(skill) => openModal('skill', skill)}
                    />
                );
            case 'education':
                return (
                    <EducationList
                        educations={profile?.educations || []}
                        onAdd={() => openModal('education')}
                        onEdit={(edu) => openModal('education', edu)}
                    />
                );
            case 'cover-letters':
                return <CoverLetterSection />;
            default:
                return null;
        }
    }, [activeTab, profile, openModal]);

    if (status === 'loading' || loading) {
        return <ProfileSkeleton />;
    }

    return (
        <div className="min-h-screen" style={{ background: 'var(--background)' }}>
            <main className="max-w-6xl mx-auto px-4 py-8">
                <ProfileHeader
                    profile={profile}
                    userEmail={session?.user?.email}
                    onUploadResume={() => openModal('upload')}
                    onEditProfile={() => openModal('profile')}
                />

                <ProfileTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />

                <div className="rounded-2xl border mt-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <div className="p-6">
                        {renderTabContent}
                    </div>
                </div>
            </main>

            {/* Modals */}
            <Modal isOpen={modalType === 'profile'} onClose={closeModal} title="Edit Profile">
                <ProfileEditForm
                    currentName={profile?.name || ''}
                    currentImage={profile?.image || ''}
                    onSubmit={handleProfileSubmit}
                    onCancel={closeModal}
                />
            </Modal>

            <Modal isOpen={modalType === 'experience'} onClose={closeModal} title={editingItem ? 'Edit Experience' : 'Add Experience'} size="lg">
                <ExperienceForm
                    experience={editingItem as Experience | undefined}
                    onSubmit={handleExperienceSubmit}
                    onCancel={closeModal}
                />
            </Modal>

            <Modal isOpen={modalType === 'project'} onClose={closeModal} title={editingItem ? 'Edit Project' : 'Add Project'} size="lg">
                <ProjectForm
                    project={editingItem as Project | undefined}
                    onSubmit={handleProjectSubmit}
                    onCancel={closeModal}
                />
            </Modal>

            <Modal isOpen={modalType === 'skill'} onClose={closeModal} title={editingItem ? 'Edit Skill' : 'Add Skill'}>
                <SkillForm
                    skill={editingItem as Skill | undefined}
                    onSubmit={handleSkillSubmit}
                    onCancel={closeModal}
                />
            </Modal>

            <Modal isOpen={modalType === 'education'} onClose={closeModal} title={editingItem ? 'Edit Education' : 'Add Education'} size="lg">
                <EducationForm
                    education={editingItem as Education | undefined}
                    onSubmit={handleEducationSubmit}
                    onCancel={closeModal}
                />
            </Modal>

            <Modal isOpen={modalType === 'upload'} onClose={closeModal} title="Upload Resume" size="lg">
                <div className="space-y-4">
                    <p className="text-gray-600">
                        Upload your existing resume to automatically extract your experience, education, and skills.
                    </p>
                    <ResumeUpload onDataExtracted={handleResumeDataExtracted} />
                </div>
            </Modal>

            {profile && (
                <ShareProfileModal
                    isOpen={shareModalOpen}
                    onClose={() => setShareModalOpen(false)}
                    userId={profile.id}
                    isPublicInitial={(profile.settings?.resumePreferences as { isPublic?: boolean })?.isPublic || false}
                    onUpdate={(isPublic) => {
                        if (profile.settings) {
                            setProfile({
                                ...profile,
                                settings: {
                                    ...profile.settings,
                                    resumePreferences: {
                                        ...(profile.settings.resumePreferences || {}),
                                        isPublic
                                    }
                                }
                            });
                        }
                    }}
                />
            )}

            <GitHubImportModal
                isOpen={githubModalOpen}
                onClose={() => setGithubModalOpen(false)}
                onImport={handleGitHubImport}
            />
        </div>
    );
}
