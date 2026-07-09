'use client';

/**
 * Resume Upload Component
 * Parses uploaded PDF/DOCX/TXT/MD files and extracts data
 * Shows loading status, success message, or detailed errors
 */

import { useState, useRef, ChangeEvent } from 'react';
import { createLogger } from '@/lib/logger';

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

    const handleFile = async (file: File) => {
        if (!file) return;

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
            const errorMsg = `Invalid file type "${extension}". Please upload a PDF, DOCX, TXT, or MD file.`;
            logger.warn('[ResumeUpload] Invalid file type', { type: file.type, extension });
            setError(errorMsg);
            return;
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            const errorMsg = `File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum size is 10MB.`;
            logger.warn('[ResumeUpload] File too large', { size: file.size });
            setError(errorMsg);
            return;
        }

        setFileName(file.name);
        setIsProcessing(true);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);

            logger.info('[ResumeUpload] Sending to API', { type });

            const response = await fetch('/api/profile/upload', {
                method: 'POST',
                body: formData,
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
            setIsProcessing(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        handleFile(file);
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
        if (file) handleFile(file);
    };

    const handleRetry = () => {
        setError('');
        setErrorDetails(null);
        setSuccess(false);
        setFileName('');
        setExtractedSummary(null);
        inputRef.current?.click();
    };

    return (
        <div className="w-full space-y-3">
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !isProcessing && inputRef.current?.click()}
                className={`
                    relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all
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
                    className="hidden"
                    disabled={isProcessing}
                />

                {isProcessing ? (
                    <div className="space-y-3">
                        <div className="w-12 h-12 mx-auto border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-gray-600 font-medium">Processing {fileName}...</p>
                        <p className="text-sm text-gray-500">Extracting text and analyzing content</p>
                    </div>
                ) : success ? (
                    <div className="space-y-3">
                        <div className="w-12 h-12 mx-auto bg-green-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-green-700 font-medium">{fileName} processed successfully!</p>
                            {extractedSummary && (
                                <p className="text-sm text-green-600 mt-1">{extractedSummary}</p>
                            )}
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRetry();
                            }}
                            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            Upload a different file
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="w-12 h-12 mx-auto bg-indigo-100 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-gray-900 font-medium">
                                Drop your {type === 'cover-letter' ? 'cover letter' : 'resume'} here
                            </p>
                            <p className="text-sm text-gray-500">
                                or click to browse (PDF, DOCX, TXT, or MD, max 10MB)
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Error message */}
            {error && (
                <div className={`p-3 rounded-lg ${success ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-start gap-2">
                        <svg className={`w-5 h-5 mt-0.5 flex-shrink-0 ${success ? 'text-yellow-500' : 'text-red-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={success ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" : "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
                        </svg>
                        <div className="flex-1">
                            <p className={`text-sm ${success ? 'text-yellow-700' : 'text-red-700'}`}>{error}</p>
                            {errorDetails && (
                                <details className="mt-2">
                                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                        Show technical details
                                    </summary>
                                    <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                                        {errorDetails}
                                    </pre>
                                </details>
                            )}
                            {!success && (
                                <button
                                    onClick={handleRetry}
                                    className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
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
