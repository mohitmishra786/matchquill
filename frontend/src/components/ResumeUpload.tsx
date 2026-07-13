'use client';

/**
 * Resume Upload Component
 * Parses uploaded PDF/DOCX/TXT/MD files and extracts data
 * Shows loading status, success message, or detailed errors
 * Supports keyboard activation and accessible status announcements
 */

import { useState, useRef, useId, useEffect, ChangeEvent, KeyboardEvent } from 'react';
import { createLogger } from '@/lib/logger';
import { sanitizeText } from '@/lib/sanitization';
import { MAX_UPLOAD_BYTES } from '@/lib/constants';

const logger = createLogger({ component: 'ResumeUpload' });

interface ExtractedExperience {
    company: string;
    title: string;
    location?: string;
    startDate: string;
    endDate?: string;
    current?: boolean;
    description?: string;
    highlights?: string[];
}

interface ExtractedEducation {
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate?: string;
    gpa?: string;
}

interface ExtractedProject {
    name: string;
    description: string;
    technologies?: string[];
}

interface ExtractedData {
    name?: string;
    email?: string;
    phone?: string;
    experiences?: ExtractedExperience[];
    education?: ExtractedEducation[];
    skills?: string[];
    projects?: ExtractedProject[];
    extraction_method?: string;
    warning?: string;
    content?: string; // For cover letters
    word_count?: number; // For cover letters
}

interface ResumeUploadProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onDataExtracted: (data: any) => void;
    type?: 'resume' | 'cover-letter';
}

export default function ResumeUpload({ onDataExtracted, type = 'resume' }: ResumeUploadProps) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    const [errorDetails, setErrorDetails] = useState<string | null>(null);
    const [fileName, setFileName] = useState('');
    const [success, setSuccess] = useState(false);
    const [extractedSummary, setExtractedSummary] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const selectDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dropzoneId = useId();
    const statusId = useId();
    const errorId = useId();

    // Cancel in-flight upload on unmount
    useEffect(() => {
        return () => {
            abortRef.current?.abort();
            if (selectDebounceRef.current) {
                clearTimeout(selectDebounceRef.current);
            }
        };
    }, []);

    const openFilePicker = () => {
        if (!isProcessing) {
            inputRef.current?.click();
        }
    };

    const handleFile = async (file: File) => {
        if (!file) return;

        // Cancel any previous in-flight upload
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        logger.startOperation('ResumeUpload:handleFile');
        logger.info('[ResumeUpload] Processing file', {
            filename: file.name,
            type: file.type,
            size: file.size,
        });

        // Reset state
        setError('');
        setErrorDetails(null);
        setSuccess(false);
        setExtractedSummary(null);

        // Validate file type
        const validTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'text/markdown',
        ];
        const validExtensions = ['.pdf', '.docx', '.doc', '.txt', '.md', '.markdown'];
        const extension = '.' + file.name.split('.').pop()?.toLowerCase();

        if (!validTypes.includes(file.type) && !validExtensions.includes(extension)) {
            const errorMsg = `Invalid file type "${sanitizeText(extension)}". Please upload a PDF, DOCX, TXT, or MD file.`;
            logger.warn('[ResumeUpload] Invalid file type', { type: file.type, extension });
            setError(errorMsg);
            return;
        }

        const maxSize = MAX_UPLOAD_BYTES;
        if (file.size > maxSize) {
            const maxMb = Math.round(maxSize / 1024 / 1024);
            const errorMsg = `File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size is ${maxMb}MB.`;
            logger.warn('[ResumeUpload] File too large', { size: file.size });
            setError(errorMsg);
            return;
        }

        // Display sanitized file name only
        setFileName(sanitizeText(file.name));
        setIsProcessing(true);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);

            logger.info('[ResumeUpload] Sending to API', { type });

            const response = await fetch('/api/profile/upload', {
                method: 'POST',
                body: formData,
                signal: controller.signal,
            });

            const data = await response.json();

            logger.info('[ResumeUpload] API response received', {
                success: data.success,
                hasError: !!data.error,
                status: response.status,
            });

            if (!data.success || data.error) {
                // Handle error response
                const errorMessage = data.error || 'Failed to process file';
                logger.error('[ResumeUpload] Processing failed', {
                    error: errorMessage,
                    details: data.details,
                });

                setError(errorMessage);
                if (data.details) {
                    setErrorDetails(JSON.stringify(data.details, null, 2));
                }
                logger.failOperation('ResumeUpload:handleFile', new Error(errorMessage));
                return;
            }

            // Success
            const extractedData = data.data as ExtractedData;

            // Create summary for display
            let summary = '';
            if (type === 'cover-letter') {
                summary = `Cover letter extracted (${extractedData.word_count || 0} words)`;
            } else {
                const parts = [];
                if (extractedData.name) parts.push(`Name: ${extractedData.name}`);
                if (extractedData.experiences?.length) parts.push(`${extractedData.experiences.length} experiences`);
                if (extractedData.education?.length) parts.push(`${extractedData.education.length} education entries`);
                if (extractedData.skills?.length) parts.push(`${extractedData.skills.length} skills`);
                if (extractedData.projects?.length) parts.push(`${extractedData.projects.length} projects`);
                summary = parts.join(' • ') || 'Data extracted';

                if (extractedData.extraction_method) {
                    summary += ` (via ${extractedData.extraction_method})`;
                }
            }

            setSuccess(true);
            setExtractedSummary(summary);

            if (extractedData.warning) {
                setError(extractedData.warning);
            }

            logger.info('[ResumeUpload] Success', { summary });
            logger.endOperation('ResumeUpload:handleFile');

            // Call the callback with extracted data
            onDataExtracted(extractedData);

        } catch (err) {
            // Ignore abort — user cancelled or a newer upload superseded this one
            if (
                (err instanceof DOMException && err.name === 'AbortError') ||
                (err instanceof Error && err.name === 'AbortError') ||
                controller.signal.aborted
            ) {
                logger.info('[ResumeUpload] Upload cancelled');
                return;
            }

            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            const errorStack = err instanceof Error ? err.stack : undefined;

            logger.error('[ResumeUpload] Exception during upload', {
                error: errorMessage,
                stack: errorStack,
            });
            logger.failOperation('ResumeUpload:handleFile', err);

            setError(`Failed to process file: ${errorMessage}`);
            if (errorStack) {
                setErrorDetails(errorStack);
            }
        } finally {
            if (abortRef.current === controller) {
                setIsProcessing(false);
            }
        }
    };

    const cancelUpload = () => {
        if (selectDebounceRef.current) {
            clearTimeout(selectDebounceRef.current);
            selectDebounceRef.current = null;
        }
        abortRef.current?.abort();
        abortRef.current = null;
        setIsProcessing(false);
        logger.info('[ResumeUpload] User cancelled upload');
    };

    /** Debounce rapid file selection / drop events to avoid thrashing uploads */
    const scheduleFile = (file: File) => {
        if (selectDebounceRef.current) {
            clearTimeout(selectDebounceRef.current);
        }
        selectDebounceRef.current = setTimeout(() => {
            selectDebounceRef.current = null;
            void handleFile(file);
        }, 200);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) scheduleFile(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // Allow re-selecting the same file
        e.target.value = '';
        if (file) scheduleFile(file);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (isProcessing) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openFilePicker();
        }
    };

    const handleRetry = () => {
        setError('');
        setErrorDetails(null);
        setSuccess(false);
        setFileName('');
        setExtractedSummary(null);
        inputRef.current?.click();
    };

    const dropzoneLabel = type === 'cover-letter' ? 'cover letter' : 'resume';

    return (
        <div className="w-full space-y-3">
            <div
                id={dropzoneId}
                role="button"
                tabIndex={isProcessing ? -1 : 0}
                aria-disabled={isProcessing}
                aria-describedby={statusId}
                aria-label={`Upload ${dropzoneLabel}. Drop a file here or press Enter to browse.`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={openFilePicker}
                onKeyDown={handleKeyDown}
                className={`
                    relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                    ${isDragOver
                        ? 'border-indigo-500 bg-indigo-50'
                        : success
                            ? 'border-green-300 bg-green-50'
                            : error
                                ? 'border-red-300 bg-red-50'
                                : 'border-gray-300 hover:border-gray-400'
                    }
                    ${isProcessing ? 'opacity-50 cursor-wait' : ''}
                `}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.md,.markdown"
                    onChange={handleInputChange}
                    className="sr-only"
                    disabled={isProcessing}
                    tabIndex={-1}
                    aria-hidden="true"
                />

                {isProcessing ? (
                    <div className="space-y-3" id={statusId} role="status" aria-live="polite">
                        <div className="w-12 h-12 mx-auto border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" aria-hidden="true"></div>
                        <p className="text-gray-700 font-medium">Processing {fileName}...</p>
                        <p className="text-sm text-gray-600">Extracting text and analyzing content</p>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                cancelUpload();
                            }}
                            className="text-sm text-red-600 hover:text-red-700 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                        >
                            Cancel upload
                        </button>
                    </div>
                ) : success ? (
                    <div className="space-y-3" id={statusId} role="status" aria-live="polite">
                        <div className="w-12 h-12 mx-auto bg-green-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-green-700 font-medium">{fileName} processed successfully!</p>
                            {extractedSummary && (
                                <p className="text-sm text-green-700 mt-1">{extractedSummary}</p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRetry();
                            }}
                            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                        >
                            Upload a different file
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3" id={statusId}>
                        <div className="w-12 h-12 mx-auto bg-indigo-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-gray-900 font-medium">
                                Drop your {dropzoneLabel} here
                            </p>
                            <p className="text-sm text-gray-600">
                                or click / press Enter to browse (PDF, DOCX, TXT, or MD, max {Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB)
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Error message */}
            {error && (
                <div
                    id={errorId}
                    role="alert"
                    aria-live="assertive"
                    className={`p-3 rounded-lg ${success ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'}`}
                >
                    <div className="flex items-start gap-2">
                        <svg className={`w-5 h-5 mt-0.5 flex-shrink-0 ${success ? 'text-yellow-600' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={success ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" : "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
                        </svg>
                        <div className="flex-1">
                            <p className={`text-sm ${success ? 'text-yellow-800' : 'text-red-700'}`}>{error}</p>
                            {errorDetails && (
                                <details className="mt-2">
                                    <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                                        Show technical details
                                    </summary>
                                    <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                                        {errorDetails}
                                    </pre>
                                </details>
                            )}
                            {!success && (
                                <button
                                    type="button"
                                    onClick={handleRetry}
                                    className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                                >
                                    Try again
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
