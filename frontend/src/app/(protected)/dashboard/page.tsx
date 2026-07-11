'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { createLogger } from '@/lib/logger';
import DashboardSkeleton from '@/components/skeletons/DashboardSkeleton';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import HelpFAQ from '@/components/ui/HelpFAQ';
import FeedbackForm from '@/components/forms/FeedbackForm';
import OnboardingTour from '@/components/OnboardingTour';
import { useAnalytics } from '@/lib/hooks/useAnalytics';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';

const logger = createLogger({ component: 'DashboardPage' });

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const { t } = useLanguage();

    // Use SWR for cached data fetching - much faster on repeat visits
    const { data, isLoading, error } = useAnalytics();

    // Log errors in useEffect to avoid re-render logging
    React.useEffect(() => {
        if (error || (!isLoading && !data)) {
            logger.error('Failed to load dashboard', { error, hasData: !!data });
        }
    }, [error, data, isLoading]);

    // Show skeleton while loading or waiting for session
    if (isLoading || status === 'loading') {
        return <DashboardSkeleton />;
    }

    // Handle errors and missing data
    if (error || !data) {
        // Check if it's an auth error (401/403)
        const errorWithStatus = error as { status?: number } | undefined;
        const isAuthError = errorWithStatus?.status === 401 || errorWithStatus?.status === 403;

        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
                <div className="text-center p-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--destructive) 10%, transparent)' }}>
                        <svg className="w-8 h-8" style={{ color: 'var(--destructive)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                        {isAuthError ? 'Authentication Required' : 'Failed to load dashboard'}
                    </h2>
                    <p className="mb-4" style={{ color: 'var(--muted-foreground)' }}>
                        {isAuthError ? 'Please sign in to continue.' : 'An error occurred. Please try again.'}
                    </p>
                    <div className="flex gap-3 justify-center">
                        {isAuthError ? (
                            <Link
                                href="/login"
                                className="inline-block px-6 py-3 rounded-xl font-medium"
                                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                            >
                                Sign In
                            </Link>
                        ) : (
                            <>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="inline-block px-6 py-3 rounded-xl font-medium"
                                    style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                                >
                                    Try Again
                                </button>
                                <Link
                                    href="/login"
                                    className="inline-block px-6 py-3 rounded-xl font-medium"
                                    style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
                                >
                                    Sign In
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const applicationsTrend = data.weeklyApplicationsCount > 0
        ? `+${data.weeklyApplicationsCount} this week`
        : 'No apps this week';

    return (
        <div className="min-h-screen" style={{ background: 'var(--background)' }}>
            <OnboardingTour />
            {/* Using global Navbar - no duplicate header */}
            <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
                {/* Welcome & Completeness */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-gradient-to-r from-indigo-600 to-purple-700 rounded-3xl p-8 text-white shadow-lg">
                    <div className="mb-6 md:mb-0">
                        <h1 className="text-3xl font-bold mb-2">{t('dashboard.welcome')}, {session?.user?.name?.split(' ')[0] || 'There'}! 👋</h1>
                        <p className="text-indigo-100 opacity-90 max-w-lg">
                            {t('dashboard.completeness', { percent: data.completeness })}
                            {data.completeness < 100
                                ? ` ${t('dashboard.complete_now')}`
                                : ` ${t('dashboard.ready')}`}
                        </p>
                        <div className="mt-6 flex gap-3">
                            <Link href="/profile" className="px-5 py-2.5 bg-white text-indigo-700 font-semibold rounded-xl hover:bg-indigo-50 transition-colors shadow-sm">
                                {t('profile.edit')}
                            </Link>
                            <Link href="/templates" className="px-5 py-2.5 bg-indigo-500/30 text-white font-semibold rounded-xl hover:bg-indigo-500/40 transition-colors backdrop-blur-sm border border-white/20">
                                {t('common.templates')}
                            </Link>
                        </div>
                    </div>

                    {/* Radial Progress */}
                    <div className="relative w-32 h-32 flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="64"
                                cy="64"
                                r="56"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="transparent"
                                className="text-indigo-800"
                            />
                            <circle
                                cx="64"
                                cy="64"
                                r="56"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="transparent"
                                strokeDasharray={351.86}
                                strokeDashoffset={351.86 - (351.86 * data.completeness) / 100}
                                className="text-white transition-all duration-1000 ease-out"
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
                            {data.completeness}%
                        </div>
                    </div>
                </div>

                {/* Overview Stats */}
                <SectionErrorBoundary sectionName="Dashboard stats">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                        <StatCard
                            title="Applications"
                            value={data.coverLetterCount}
                            icon={
                                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            }
                            color="bg-blue-50"
                            trend={applicationsTrend}
                        />
                        <StatCard
                            title="Skills"
                            value={data.skillCount}
                            icon={
                                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            }
                            color="bg-emerald-50"
                        />
                        <StatCard
                            title="Projects"
                            value={data.projectCount}
                            icon={
                                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            }
                            color="bg-purple-50"
                        />
                        <StatCard
                            title="Experience"
                            value={data.experienceCount}
                            icon={
                                <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            }
                            color="bg-orange-50"
                        />
                    </div>
                </SectionErrorBoundary>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Activity Chart */}
                    <SectionErrorBoundary sectionName="Application activity">
                        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Application Activity</h3>
                                    <p className="text-sm text-gray-600">Resumes generated over last 7 days</p>
                                </div>
                            </div>

                            <div className="h-64 flex items-end justify-between gap-2 sm:gap-4">
                                {data.activity && data.activity.length > 0 ? (
                                    data.activity.map((item, index) => (
                                        <div key={index} className="flex flex-col items-center w-full group">
                                            <div className="relative w-full flex items-end justify-center h-48">
                                                <div
                                                    className="w-full max-w-[40px] bg-indigo-500 rounded-t-lg transition-all duration-500 hover:bg-indigo-600 relative group-hover:scale-105"
                                                    style={{ height: `${Math.min(Math.max(item.applications * 20, 5), 100)}%` }}
                                                >
                                                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                        {item.applications} Apps
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-3 text-xs sm:text-sm font-medium text-gray-600">{item.name}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="w-full text-center py-12 text-gray-600">
                                        <p>No activity data yet.</p>
                                        <p className="text-sm mt-1">Start creating resumes to see your activity!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </SectionErrorBoundary>

                    {/* Recent Activity List */}
                    <SectionErrorBoundary sectionName="Recent activity">
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-900 mb-6">Recent Activity</h3>

                            {data.recentActivity.length > 0 ? (
                                <div className="space-y-6">
                                    {data.recentActivity.map((activity) => (
                                        <div key={activity.id} className="flex gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                                                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 truncate">{activity.title}</p>
                                                <p className="text-xs text-gray-600 truncate">{activity.company}</p>
                                            </div>
                                            <div className="text-xs text-gray-600 whitespace-nowrap">
                                                {new Date(activity.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-600">
                                    <p>No recent activity.</p>
                                    <p className="text-sm">Generate your first resume to see it here!</p>
                                </div>
                            )}

                            <div className="mt-8 pt-6 border-t border-gray-100">
                                <Link href="/profile" className="block w-full py-2.5 text-center text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors">
                                    View Full History
                                </Link>
                            </div>
                        </div>
                    </SectionErrorBoundary>
                </div>

                {/* Help & Support */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <SectionErrorBoundary sectionName="Help FAQ">
                        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                            <HelpFAQ />
                        </div>
                    </SectionErrorBoundary>
                    <SectionErrorBoundary sectionName="Feedback form">
                        <div>
                            <FeedbackForm />
                        </div>
                    </SectionErrorBoundary>
                </div>
            </main>
        </div>
    );
}

function StatCard({ title, value, icon, color, trend }: { title: string, value: number, icon: React.ReactNode, color: string, trend?: string }) {
    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition-transform hover:scale-[1.02]">
            <div className="flex justify-between items-start mb-4">
                <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
                    {icon}
                </div>
                {trend && (
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        {trend}
                    </span>
                )}
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
            <div className="text-sm text-gray-500 font-medium">{title}</div>
        </div>
    );
}