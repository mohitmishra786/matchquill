/**
 * Interactive Onboarding Tour Component
 * Guides users through key features with step-by-step interactive tour
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

interface OnboardingTourProps {
    /** Force show the tour even if user has seen it before */
    forceShow?: boolean;
    /** Callback when tour is completed or skipped */
    onComplete?: () => void;
}

interface TourStep extends DriveStep {
    /** Whether this step is optional (can be skipped based on page) */
    optional?: boolean;
}

const TOUR_STORAGE_KEY = 'cv_wiz_tour_v2';
const TOUR_VERSION = '2.0';

export default function OnboardingTour({ forceShow = false, onComplete }: OnboardingTourProps) {
    const [isReady, setIsReady] = useState(false);

    const getTourSteps = useCallback((): TourStep[] => {
        return [
            {
                element: '#main-content h1',
                popover: {
                    title: 'Welcome to CV-Wiz! 👋',
                    description: 'Your AI-powered career assistant. Let\'s take a quick tour to show you around the key features.',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: '.relative.w-32.h-32, [data-tour="profile-completeness"]',
                popover: {
                    title: 'Profile Completeness',
                    description: 'This shows how much of your profile is ready for AI generation. Aim for 100% to get the best results!',
                    side: "left",
                    align: 'start'
                },
                optional: true
            },
            {
                element: 'a[href="/profile"], [data-tour="profile-link"]',
                popover: {
                    title: 'Manage Your Profile',
                    description: 'Add your experience, skills, education, and projects here. You can also import them from GitHub.',
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: 'a[href="/templates"], [data-tour="templates-link"]',
                popover: {
                    title: 'Resume Templates',
                    description: 'Choose from professionally designed templates for your resume. Preview them with your actual data!',
                    side: "bottom",
                    align: 'start'
                },
                optional: true
            },
            {
                element: 'a[href="/interview-prep"], [data-tour="interview-link"]',
                popover: {
                    title: 'AI Interview Prep',
                    description: 'Ready for an interview? Generate practice questions tailored to your background and target role.',
                    side: "bottom",
                    align: 'start'
                },
                optional: true
            },
            {
                element: '[data-tour="activity-tracking"], .lg\\:col-span-2.bg-white.p-6',
                popover: {
                    title: 'Activity Tracking',
                    description: 'Keep track of your application activity, resume generations, and cover letters created.',
                    side: "top",
                    align: 'start'
                },
                optional: true
            },
            {
                element: '[data-tour="chrome-extension"], a[href*="chrome"]',
                popover: {
                    title: 'Chrome Extension',
                    description: 'Install our Chrome extension to extract job details directly from job postings with one click!',
                    side: "bottom",
                    align: 'start'
                },
                optional: true
            },
            {
                popover: {
                    title: 'You\'re All Set! 🎉',
                    description: 'You\'re ready to build amazing resumes and ace your interviews. Need help? Press "?" anytime for keyboard shortcuts.',
                    align: 'center'
                }
            }
        ];
    }, []);

    const startTour = useCallback(() => {
        const steps = getTourSteps();
        
        // Filter out optional steps where elements don't exist
        const validSteps = steps.filter(step => {
            if (!step.element) return true; // Modal-only steps are always valid
            if (step.optional) {
                const element = document.querySelector(step.element as string);
                return !!element;
            }
            return true;
        });

        const driverObj = driver({
            showProgress: true,
            progressText: '{{current}} of {{total}}',
            showButtons: ['next', 'previous', 'close'],
            nextBtnText: 'Next →',
            prevBtnText: '← Previous',
            doneBtnText: 'Finish',
            steps: validSteps,
            onDestroyed: () => {
                // Mark tour as completed
                localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify({
                    completed: true,
                    version: TOUR_VERSION,
                    completedAt: new Date().toISOString()
                }));
                onComplete?.();
            },
            onHighlighted: (element) => {
                // Add custom styling to highlighted element
                element?.classList.add('tour-highlight');
            },
            onDeselected: (element) => {
                // Remove custom styling
                element?.classList.remove('tour-highlight');
            }
        });

        driverObj.drive();
    }, [getTourSteps, onComplete]);

    useEffect(() => {
        // Check if tour should be shown
        const checkAndStartTour = () => {
            if (forceShow) {
                setIsReady(true);
                return;
            }

            const tourData = localStorage.getItem(TOUR_STORAGE_KEY);
            if (tourData) {
                try {
                    const parsed = JSON.parse(tourData);
                    // Show tour if version changed or never completed
                    if (parsed.version !== TOUR_VERSION || !parsed.completed) {
                        setIsReady(true);
                    }
                } catch {
                    // Invalid data, show tour
                    setIsReady(true);
                }
            } else {
                // No tour data, show tour
                setIsReady(true);
            }
        };

        // Delay to ensure DOM is ready
        const timer = setTimeout(checkAndStartTour, 500);
        return () => clearTimeout(timer);
    }, [forceShow]);

    useEffect(() => {
        if (isReady) {
            // Small delay to ensure everything is rendered
            const timer = setTimeout(startTour, 1000);
            return () => clearTimeout(timer);
        }
    }, [isReady, startTour]);

    return null;
}

/**
 * Hook to control the onboarding tour
 */
function getHasCompletedTour(): boolean {
    if (typeof window === 'undefined') return false;
    const tourData = localStorage.getItem(TOUR_STORAGE_KEY);
    if (tourData) {
        try {
            const parsed = JSON.parse(tourData);
            return parsed.completed === true;
        } catch {
            return false;
        }
    }
    return false;
}

export function useOnboardingTour() {
    const [hasCompletedTour, setHasCompletedTour] = useState<boolean>(getHasCompletedTour);

    const restartTour = useCallback(() => {
        // Clear tour data to force showing
        localStorage.removeItem(TOUR_STORAGE_KEY);
        // Reload page to trigger tour
        window.location.reload();
    }, []);

    const markTourCompleted = useCallback(() => {
        localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify({
            completed: true,
            version: TOUR_VERSION,
            completedAt: new Date().toISOString()
        }));
        setHasCompletedTour(true);
    }, []);

    const resetTour = useCallback(() => {
        localStorage.removeItem(TOUR_STORAGE_KEY);
        setHasCompletedTour(false);
    }, []);

    return {
        hasCompletedTour,
        restartTour,
        markTourCompleted,
        resetTour,
        TourComponent: OnboardingTour
    };
}

/**
 * Button component to restart the tour
 */
export function RestartTourButton({ className = '' }: { className?: string }) {
    const { restartTour, hasCompletedTour } = useOnboardingTour();

    if (hasCompletedTour === null) return null;

    return (
        <button
            onClick={restartTour}
            className={`
                inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                text-[var(--primary)] bg-[var(--primary)]/10
                hover:bg-[var(--primary)]/20
                rounded-lg transition-colors
                ${className}
            `}
        >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Restart Tour
        </button>
    );
}
