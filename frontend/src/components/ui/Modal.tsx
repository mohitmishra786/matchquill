/**
 * Modal Component
 * Reusable modal dialog for forms and content with focus trap
 */

'use client';

import { useEffect, useCallback, useId, useRef } from 'react';
import { createLogger } from '@/lib/logger';
import { useFocusTrap } from '@/lib/keyboardNavigation';

const logger = createLogger({ component: 'Modal' });

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
    const titleId = useId();
    const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const handleEscapeKey = useCallback((event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            logger.debug('[Modal] Closing via Escape key', { title });
            onCloseRef.current();
        }
    }, [title]);

    useEffect(() => {
        if (isOpen) {
            logger.info('[Modal] Opened', { title, size });
            document.addEventListener('keydown', handleEscapeKey);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, handleEscapeKey, title, size]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            logger.debug('[Modal] Closing via backdrop click', { title });
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={handleBackdropClick}
            role="presentation"
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

            {/* Modal Content */}
            <div
                ref={focusTrapRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={`relative w-full ${sizeClasses[size]} bg-white rounded-2xl shadow-2xl transform transition-all`}
                style={{ maxHeight: '90vh' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 id={titleId} className="text-xl font-semibold text-gray-900">{title}</h2>
                    <button
                        type="button"
                        onClick={() => {
                            logger.debug('[Modal] Closing via X button', { title });
                            onClose();
                        }}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 outline-none"
                        aria-label="Close modal"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
                    {children}
                </div>
            </div>
        </div>
    );
}
