'use client';

import { useEffect, useState, useRef } from 'react';
import { sanitizeText } from '@/lib/sanitization';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  onDismiss: (id: string) => void;
}

export default function Toast({ id, message, type, duration = 3000, onDismiss }: ToastProps) {
  // Sanitize user-provided / interpolated strings before display
  const safeMessage = sanitizeText(message);
  const [isVisible, setIsVisible] = useState(false);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    // Small delay to allow enter animation
    enterTimerRef.current = setTimeout(() => setIsVisible(true), 10);
    
    // Auto-dismiss timer
    autoDismissTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      exitTimerRef.current = setTimeout(() => onDismiss(id), 300);
    }, duration);

    return () => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [duration, id, onDismiss]);

  const handleManualDismiss = () => {
    // Cancel the auto-dismiss timer to prevent double onDismiss calls
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }
    setIsVisible(false);
    // Set a short timer for the exit animation before calling onDismiss
    exitTimerRef.current = setTimeout(() => onDismiss(id), 300);
  };

  const bgColors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  };

  const icons = {
    success: (
      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  };

  return (
    <div
      className={`flex items-center w-full max-w-sm p-4 mb-3 rounded-lg border shadow-sm transition-all duration-300 transform ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      } ${bgColors[type]}`}
      role="alert"
    >
      <div className="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg bg-white/50">
        {icons[type]}
      </div>
      <div className="ml-3 text-sm font-medium break-words">{safeMessage}</div>
      <button
        type="button"
        className={`ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex h-8 w-8 hover:bg-black/5 focus:ring-2 focus:ring-gray-300 transition-colors ${
            type === 'success' ? 'text-green-500' : 
            type === 'error' ? 'text-red-500' : 
            type === 'warning' ? 'text-yellow-500' : 'text-blue-500'
        }`}
        onClick={handleManualDismiss}
        aria-label="Close"
      >
        <span className="sr-only">Close</span>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
