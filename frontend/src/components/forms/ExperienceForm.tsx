/**
 * Experience Form Component
 * Form for adding/editing work experience
 *
 * AI Enhance goes through /api/ai/enhance-bullet (server-authenticated proxy).
 * Never mint backend JWTs or call AUTH_SECRET from the browser.
 */

'use client';

import { useState } from 'react';
import type { Experience } from '@/types';
import { createLogger } from '@/lib/logger';
import {
    assertAuthenticatedResponse,
    AuthenticationError,
    isAuthenticationError,
    redirectToLogin,
} from '@/lib/auth-errors';
import { sanitizeExperienceData, sanitizeText, sanitizeRichText } from '@/lib/sanitization';

const logger = createLogger({ component: 'ExperienceForm' });

interface ExperienceFormProps {
    experience?: Partial<Experience>;
    onSubmit: (data: Partial<Experience>) => Promise<void>;
    onCancel: () => void;
}

export default function ExperienceForm({ experience, onSubmit, onCancel }: ExperienceFormProps) {
    interface ExperienceFormState {
        company: string;
        title: string;
        location: string;
        startDate: string;
        endDate: string;
        current: boolean;
        description: string;
        highlights: string;
        keywords: string;
    }

    const [formData, setFormData] = useState<ExperienceFormState>({
        company: experience?.company || '',
        title: experience?.title || '',
        location: experience?.location || '',
        startDate: experience?.startDate?.split('T')[0] || '',
        endDate: experience?.endDate?.split('T')[0] || '',
        current: experience?.current || false,
        description: experience?.description || '',
        highlights: experience?.highlights?.join('\n') || '',
        keywords: experience?.keywords?.join(', ') || '',
    });
    const [targetJD, setTargetJD] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const handleAuthFailure = (err: unknown): void => {
        logger.warn('[ExperienceForm] Authentication failure', {
            message: err instanceof Error ? err.message : String(err),
        });
        setError('Your session has expired. Redirecting to login…');
        redirectToLogin();
    };

    const handleAIEnhance = async () => {
        if (!formData.highlights.trim()) {
            setError('Please enter some achievements to enhance');
            return;
        }

        setIsEnhancing(true);
        setError('');
        try {
            const bullets = formData.highlights.split('\n').filter((b) => b.trim());
            const enhancedBullets: string[] = [];

            const sanitizedJD = targetJD.trim()
                ? sanitizeRichText(targetJD)
                : undefined;

            for (const bullet of bullets) {
                // Server route validates session and attaches backend JWT
                const res = await fetch('/api/ai/enhance-bullet', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        bullet: sanitizeText(bullet),
                        job_description: sanitizedJD || undefined,
                    }),
                });

                await assertAuthenticatedResponse(res);

                const data = (await res.json()) as {
                    enhanced_bullet?: string;
                    error?: string;
                };

                if (res.ok && data.enhanced_bullet) {
                    enhancedBullets.push(data.enhanced_bullet);
                } else {
                    // Keep original bullet on partial failure; surface soft error once
                    logger.warn('[ExperienceForm] Bullet enhance failed', {
                        status: res.status,
                        error: data.error,
                    });
                    enhancedBullets.push(bullet);
                }
            }

            setFormData({
                ...formData,
                highlights: enhancedBullets.join('\n'),
            });
        } catch (err) {
            if (isAuthenticationError(err) || err instanceof AuthenticationError) {
                handleAuthFailure(err);
                return;
            }
            logger.error('Failed to enhance bullets', { err });
            setError('AI enhancement failed. Please try again.');
        } finally {
            setIsEnhancing(false);
        }
    };

    logger.debug('[ExperienceForm] Initialized', {
        isEdit: !!experience?.id,
        experienceId: experience?.id,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.company.trim() || !formData.title.trim() || !formData.startDate) {
            setError('Please fill in all required fields');
            logger.warn('[ExperienceForm] Validation failed - missing required fields');
            return;
        }

        logger.startOperation('ExperienceForm:submit');
        setLoading(true);
        setError('');

        try {
            const sanitized = sanitizeExperienceData({
                ...formData,
                highlights: formData.highlights.split('\n').filter((h) => h.trim()),
                keywords: formData.keywords
                    .split(',')
                    .map((k) => k.trim())
                    .filter(Boolean),
            });

            await onSubmit({
                company: sanitized.company,
                title: sanitized.title,
                location: sanitized.location,
                description: sanitized.description,
                highlights: sanitized.highlights,
                keywords: sanitized.keywords,
                startDate: formData.startDate,
                endDate: formData.current ? undefined : formData.endDate || undefined,
                current: sanitized.current,
            });
            logger.endOperation('ExperienceForm:submit');
        } catch (err) {
            logger.failOperation('ExperienceForm:submit', err);
            if (isAuthenticationError(err)) {
                handleAuthFailure(err);
                return;
            }
            setError('Failed to save experience. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="exp-company" className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                    <input
                        id="exp-company"
                        type="text"
                        required
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        aria-invalid={error ? true : undefined}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Company name"
                    />
                </div>
                <div>
                    <label htmlFor="exp-title" className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                    <input
                        id="exp-title"
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Your role"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="exp-location" className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                    id="exp-location"
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="City, Country or Remote"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="exp-start-date" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                        id="exp-start-date"
                        type="date"
                        required
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <div>
                    <label htmlFor="exp-end-date" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                        id="exp-end-date"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        disabled={formData.current}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100"
                    />
                </div>
            </div>

            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="exp-current"
                    checked={formData.current}
                    onChange={(e) => setFormData({ ...formData, current: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="exp-current" className="text-sm text-gray-700">
                    I currently work here
                </label>
            </div>

            <div>
                <label htmlFor="exp-description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                    id="exp-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    placeholder="Brief overview of your role"
                />
            </div>

            <div>
                <div className="flex justify-between items-center mb-1">
                    <label htmlFor="exp-highlights" className="block text-sm font-medium text-gray-700">Key Achievements</label>
                    <button
                        type="button"
                        onClick={handleAIEnhance}
                        disabled={isEnhancing || !formData.highlights.trim()}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50"
                    >
                        {isEnhancing ? (
                            <>
                                <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                                Enhancing...
                            </>
                        ) : (
                            <>
                                <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    aria-hidden="true"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 10V3L4 14h7v7l9-11h-7z"
                                    />
                                </svg>
                                AI Enhance
                            </>
                        )}
                    </button>
                </div>
                <textarea
                    id="exp-highlights"
                    value={formData.highlights}
                    onChange={(e) => setFormData({ ...formData, highlights: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    placeholder="Enter each achievement on a new line"
                />
                <p id="exp-highlights-help" className="mt-1 text-xs text-gray-600">
                    One achievement per line. Start with action verbs.
                </p>
            </div>

            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <label htmlFor="exp-target-jd" className="block text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">
                    Target Job Description (Optional for AI)
                </label>
                <textarea
                    id="exp-target-jd"
                    value={targetJD}
                    onChange={(e) => setTargetJD(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    placeholder="Paste job requirements here to tailor achievements..."
                />
            </div>

            <div>
                <label htmlFor="exp-keywords" className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
                <input
                    id="exp-keywords"
                    type="text"
                    value={formData.keywords}
                    onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="React, TypeScript, Leadership (comma separated)"
                />
            </div>

            {error && (
                <p className="text-sm text-red-600" role="alert" aria-live="assertive">
                    {error}
                </p>
            )}

            <div className="flex gap-3 pt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50"
                >
                    {loading ? 'Saving...' : 'Save Experience'}
                </button>
            </div>
        </form>
    );
}
