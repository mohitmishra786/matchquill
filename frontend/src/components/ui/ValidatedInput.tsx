'use client';

/**
 * ValidatedInput Component
 * Input field with real-time validation and visual feedback
 */

import React, { useState, useCallback, useId } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useFieldValidation, ValidationRule, commonRules } from '@/lib/validation';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ValidatedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    /**
     * Input label
     */
    label?: string;
    /**
     * Validation rules
     */
    rules?: ValidationRule[];
    /**
     * Custom error message
     */
    error?: string;
    /**
     * Helper text displayed below input
     */
    helperText?: string;
    /**
     * Debounce time for validation in ms
     * @default 300
     */
    debounceMs?: number;
    /**
     * Whether to show validation icon
     * @default true
     */
    showValidationIcon?: boolean;
    /**
     * Callback when value changes
     */
    onChange?: (value: string) => void;
    /**
     * Callback when validation state changes
     */
    onValidationChange?: (isValid: boolean) => void;
}

export const ValidatedInput: React.FC<ValidatedInputProps> = ({
    label,
    rules = [],
    error: externalError,
    helperText,
    debounceMs = 300,
    showValidationIcon = true,
    onChange,
    onValidationChange,
    className,
    id,
    required,
    ...props
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const generatedId = useId();
    const inputId = id || generatedId;

    const {
        value,
        error: validationError,
        isValidating,
        isDirty,
        isValid,
        onChange: handleValidationChange,
        onBlur: handleValidationBlur,
    } = useFieldValidation(props.defaultValue as string || '', rules, {
        debounceMs,
        validateOnChange: true,
    });

    const error = externalError || validationError;
    const showError = error && isDirty && !isFocused;

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        handleValidationChange(newValue);
        onChange?.(newValue);
    }, [handleValidationChange, onChange]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        handleValidationBlur();
        props.onBlur?.(e);
    }, [handleValidationBlur, props]);

    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        props.onFocus?.(e);
    }, [props]);

    // Notify parent of validation state changes
    React.useEffect(() => {
        if (isDirty) {
            onValidationChange?.(!error);
        }
    }, [error, isDirty, onValidationChange]);

    return (
        <div className={cn('space-y-1.5', className)}>
            {label && (
                <label
                    htmlFor={inputId}
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            <div className="relative">
                <input
                    {...props}
                    id={inputId}
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onFocus={handleFocus}
                    aria-invalid={!!error}
                    aria-describedby={showError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
                    className={cn(
                        'block w-full rounded-lg border px-4 py-2.5 text-sm transition-all duration-200',
                        'focus:outline-none focus:ring-2 focus:ring-offset-0',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        showError
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-200 dark:border-red-700 dark:focus:border-red-500'
                            : isValid && isDirty
                                ? 'border-green-300 focus:border-green-500 focus:ring-green-200 dark:border-green-700 dark:focus:border-green-500'
                                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-200 dark:border-gray-600 dark:focus:border-indigo-500',
                        showValidationIcon && 'pr-10',
                        className
                    )}
                />
                {showValidationIcon && isDirty && !isValidating && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {showError ? (
                            <svg
                                className="w-5 h-5 text-red-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        ) : isValid ? (
                            <svg
                                className="w-5 h-5 text-green-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        ) : null}
                    </div>
                )}
                {isValidating && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
            </div>
            {showError && (
                <p
                    id={`${inputId}-error`}
                    className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
                    role="alert"
                    aria-live="assertive"
                >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                    </svg>
                    {error}
                </p>
            )}
            {!showError && helperText && (
                <p
                    id={`${inputId}-helper`}
                    className="text-sm text-gray-600 dark:text-gray-400"
                >
                    {helperText}
                </p>
            )}
        </div>
    );
};

interface ValidatedTextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
    label?: string;
    rules?: ValidationRule[];
    error?: string;
    helperText?: string;
    debounceMs?: number;
    showValidationIcon?: boolean;
    onChange?: (value: string) => void;
    onValidationChange?: (isValid: boolean) => void;
    maxLength?: number;
    showCharacterCount?: boolean;
}

export const ValidatedTextArea: React.FC<ValidatedTextAreaProps> = ({
    label,
    rules = [],
    error: externalError,
    helperText,
    debounceMs = 300,
    showValidationIcon = true,
    onChange,
    onValidationChange,
    className,
    id,
    required,
    maxLength,
    showCharacterCount = false,
    ...props
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const generatedId = useId();
    const inputId = id || generatedId;

    const {
        value,
        error: validationError,
        isValidating,
        isDirty,
        isValid,
        onChange: handleValidationChange,
        onBlur: handleValidationBlur,
    } = useFieldValidation(props.defaultValue as string || '', rules, {
        debounceMs,
        validateOnChange: true,
    });

    const error = externalError || validationError;
    const showError = error && isDirty && !isFocused;
    const currentLength = String(value).length;

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        if (maxLength && newValue.length > maxLength) return;
        handleValidationChange(newValue);
        onChange?.(newValue);
    }, [handleValidationChange, onChange, maxLength]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
        setIsFocused(false);
        handleValidationBlur();
        props.onBlur?.(e);
    }, [handleValidationBlur, props]);

    const handleFocus = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
        setIsFocused(true);
        props.onFocus?.(e);
    }, [props]);

    React.useEffect(() => {
        if (isDirty) {
            onValidationChange?.(!error);
        }
    }, [error, isDirty, onValidationChange]);

    return (
        <div className={cn('space-y-1.5', className)}>
            {label && (
                <div className="flex items-center justify-between">
                    <label
                        htmlFor={inputId}
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        {label}
                        {required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {showCharacterCount && maxLength && (
                        <span className={cn(
                            'text-xs',
                            currentLength > maxLength * 0.9
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-gray-400 dark:text-gray-500'
                        )}>
                            {currentLength}/{maxLength}
                        </span>
                    )}
                </div>
            )}
            <div className="relative">
                <textarea
                    {...props}
                    id={inputId}
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onFocus={handleFocus}
                    aria-invalid={!!error}
                    aria-describedby={showError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
                    className={cn(
                        'block w-full rounded-lg border px-4 py-2.5 text-sm transition-all duration-200 resize-y min-h-[100px]',
                        'focus:outline-none focus:ring-2 focus:ring-offset-0',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        showError
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-200 dark:border-red-700 dark:focus:border-red-500'
                            : isValid && isDirty
                                ? 'border-green-300 focus:border-green-500 focus:ring-green-200 dark:border-green-700 dark:focus:border-green-500'
                                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-200 dark:border-gray-600 dark:focus:border-indigo-500',
                        className
                    )}
                />
                {showValidationIcon && isDirty && !isValidating && (
                    <div className="absolute right-3 top-3">
                        {showError ? (
                            <svg
                                className="w-5 h-5 text-red-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        ) : isValid ? (
                            <svg
                                className="w-5 h-5 text-green-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        ) : null}
                    </div>
                )}
            </div>
            {showError && (
                <p
                    id={`${inputId}-error`}
                    className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
                    role="alert"
                    aria-live="assertive"
                >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                    </svg>
                    {error}
                </p>
            )}
            {!showError && helperText && (
                <p
                    id={`${inputId}-helper`}
                    className="text-sm text-gray-600 dark:text-gray-400"
                >
                    {helperText}
                </p>
            )}
        </div>
    );
};

// Export common rules for convenience
export { commonRules };
export type { ValidationRule };

export default ValidatedInput;
