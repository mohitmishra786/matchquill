/**
 * Cover Letter Section Component
 * Allows users to create and manage cover letters
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { createLogger } from '@/lib/logger';
import { withRetry } from '@/lib/retry';
import { sanitizeText, sanitizeRichText, sanitizeCoverLetterData } from '@/lib/sanitization';

const logger = createLogger({ component: 'CoverLetterSection' });

interface CoverLetter {
    id: string;
    content: string;
    jobTitle?: string;
    companyName?: string;
    createdAt: string;
    updatedAt: string;
}

export default function CoverLetterSection() {
    const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [content, setContent] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [fetchError, setFetchError] = useState('');

    const fetchCoverLetters = useCallback(async () => {
        logger.startOperation('CoverLetterSection:fetch');
        setLoading(true);
        setFetchError('');

        try {
            const data = await withRetry(
                async (attempt) => {
                    logger.info('[CoverLetterSection] Fetch attempt', { attempt });
                    const response = await fetch('/api/profile/cover-letter');

                    if (!response.ok) {
                        const body = await response.json().catch(() => ({}));
                        const message =
                            (body as { error?: string; message?: string }).error ||
                            (body as { message?: string }).message ||
                            `Failed to load cover letters (${response.status})`;
                        throw new Error(message);
                    }

                    return response.json() as Promise<{ coverLetters?: CoverLetter[] }>;
                },
                {
                    maxAttempts: 3,
                    initialDelayMs: 300,
                    backoffFactor: 2,
                    maxDelayMs: 3000,
                    onRetry: (err, attempt, nextDelayMs) => {
                        logger.warn('[CoverLetterSection] Retrying fetch', {
                            attempt,
                            nextDelayMs,
                            error: err instanceof Error ? err.message : String(err),
                        });
                    },
                }
            );

            setCoverLetters(data.coverLetters || []);
            logger.endOperation('CoverLetterSection:fetch');
        } catch (err) {
            logger.failOperation('CoverLetterSection:fetch', err);
            setFetchError(
                err instanceof Error
                    ? err.message
                    : 'Failed to load cover letters. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCoverLetters();
    }, [fetchCoverLetters]);

    const handleSave = async () => {
        if (!content.trim()) {
            setError('Cover letter content is required');
            return;
        }

        logger.startOperation('CoverLetterSection:save');
        setSaving(true);
        setError('');

        try {
            const sanitized = sanitizeCoverLetterData({
                content: content.trim(),
                jobTitle: jobTitle.trim(),
                companyName: companyName.trim(),
            });

            const response = await fetch('/api/profile/cover-letter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: sanitized.content,
                    jobTitle: sanitized.jobTitle || undefined,
                    companyName: sanitized.companyName || undefined,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save cover letter');
            }

            logger.endOperation('CoverLetterSection:save');
            setContent('');
            setJobTitle('');
            setCompanyName('');
            setIsCreating(false);
            await fetchCoverLetters();
        } catch (err) {
            logger.failOperation('CoverLetterSection:save', err);
            setError('Failed to save cover letter. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        logger.startOperation('CoverLetterSection:delete');
        try {
            const response = await fetch(`/api/profile/cover-letter?id=${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setCoverLetters(prev => prev.filter(cl => cl.id !== id));
                logger.endOperation('CoverLetterSection:delete');
                return;
            }

            logger.warn('[CoverLetterSection] Delete failed', {
                id,
                status: response.status,
            });
            setFetchError('Failed to delete cover letter. Please try again.');
        } catch (err) {
            logger.failOperation('CoverLetterSection:delete', err);
            setFetchError('Failed to delete cover letter. Please try again.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500" aria-hidden="true"></div>
                <span className="sr-only">Loading cover letters…</span>
            </div>
        );
    }

    if (fetchError && coverLetters.length === 0) {
        return (
            <div
                className="rounded-xl border border-red-200 bg-red-50 p-6 text-center"
                role="alert"
                aria-live="assertive"
            >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-3">
                    <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-red-800 mb-1">Could not load cover letters</h3>
                <p className="text-sm text-red-700 mb-4">{fetchError}</p>
                <button
                    type="button"
                    onClick={() => {
                        logger.info('[CoverLetterSection] Manual retry after fetch error');
                        void fetchCoverLetters();
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                    Try again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {fetchError && (
                <div
                    className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 flex items-start justify-between gap-3"
                    role="alert"
                    aria-live="polite"
                >
                    <p className="text-sm text-yellow-800">{fetchError}</p>
                    <button
                        type="button"
                        onClick={() => void fetchCoverLetters()}
                        className="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                        Retry
                    </button>
                </div>
            )}

            {isCreating ? (
                <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="cl-job-title" className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                            <input
                                id="cl-job-title"
                                type="text"
                                value={jobTitle}
                                onChange={(e) => setJobTitle(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Software Engineer"
                            />
                        </div>
                        <div>
                            <label htmlFor="cl-company" className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                            <input
                                id="cl-company"
                                type="text"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Google"
                            />
                        </div>
                    </div>

                    {/* File Upload Option */}
                    <div className="border border-dashed border-gray-300 rounded-lg p-4">
                        <label htmlFor="cl-file-upload" className="block text-sm font-medium text-gray-700 mb-2">Upload from file (optional)</label>
                        <input
                            id="cl-file-upload"
                            type="file"
                            accept=".pdf,.docx,.doc,.txt,.md"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                logger.info('[CoverLetterSection] Uploading file', { filename: file.name });
                                setError('');

                                try {
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    formData.append('type', 'cover-letter');

                                    const response = await fetch('/api/profile/upload', {
                                        method: 'POST',
                                        body: formData,
                                    });

                                    const data = await response.json();

                                    if (data.success && data.data?.content) {
                                        setContent(sanitizeRichText(data.data.content));
                                        logger.info('[CoverLetterSection] File content extracted', { wordCount: data.data.word_count });
                                    } else if (data.error) {
                                        setError(sanitizeText(data.error));
                                    }
                                } catch (err) {
                                    logger.error('[CoverLetterSection] File upload failed', { error: err });
                                    setError('Failed to upload file. Please try again or paste your content manually.');
                                }
                            }}
                            className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                        <p className="text-xs text-gray-600 mt-1">Supports PDF, DOCX, TXT, or MD files</p>
                    </div>

                    <div>
                        <label htmlFor="cl-content" className="block text-sm font-medium text-gray-700 mb-1">Cover Letter Content *</label>
                        <textarea
                            id="cl-content"
                            value={content}
                            onChange={(e) => {
                                setContent(e.target.value);
                                if (error) setError('');
                            }}
                            rows={10}
                            aria-invalid={!!error}
                            aria-describedby={error ? 'cl-content-error' : undefined}
                            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none ${error ? 'border-red-500' : 'border-gray-300'
                                }`}
                            placeholder="Dear Hiring Manager,

I am writing to express my interest in..."
                        />
                        {error && (
                            <p id="cl-content-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="assertive">
                                {error}
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                logger.debug('[CoverLetterSection] Cancel create');
                                setIsCreating(false);
                                setContent('');
                                setJobTitle('');
                                setCompanyName('');
                                setError('');
                            }}
                            className="flex-1 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-lg hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Cover Letter'}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {coverLetters.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                                <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-1">No cover letters yet</h3>
                            <p className="text-gray-600 mb-4">Create a cover letter to use with your job applications</p>
                            <button
                                type="button"
                                onClick={() => {
                                    logger.info('[CoverLetterSection] Starting new cover letter');
                                    setIsCreating(true);
                                }}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                Create Cover Letter
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {coverLetters.map((cl) => (
                                <div key={cl.id} className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-semibold text-gray-900">
                                                {sanitizeText(cl.jobTitle) || 'Cover Letter'}
                                                {cl.companyName && (
                                                    <span className="text-gray-600">
                                                        {' '}
                                                        @ {sanitizeText(cl.companyName)}
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-sm text-gray-600">
                                                Created {new Date(cl.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(cl.id)}
                                            className="text-gray-500 hover:text-red-600 p-1"
                                            aria-label={`Delete cover letter ${sanitizeText(cl.jobTitle) || cl.id}`}
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                    <p className="text-gray-600 text-sm line-clamp-3">
                                        {sanitizeText(cl.content)}
                                    </p>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => {
                                    logger.info('[CoverLetterSection] Starting new cover letter');
                                    setIsCreating(true);
                                }}
                                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
                            >
                                + Add Cover Letter
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
