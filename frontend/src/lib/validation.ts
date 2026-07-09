/**
 * Validation Utilities
 * Provides real-time form validation with visual feedback support
 */

import { useState, useCallback, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ValidationRule<T = string> = {
    type: 'required' | 'minLength' | 'maxLength' | 'email' | 'pattern' | 'custom' | 'match';
    value?: T;
    message: string;
    validator?: (value: T) => boolean;
};

export type ValidationRules<T = Record<string, unknown>> = {
    [K in keyof T]?: ValidationRule[];
};

export type ValidationErrors<T = Record<string, unknown>> = {
    [K in keyof T]?: string;
};

export type ValidationTouched<T = Record<string, unknown>> = {
    [K in keyof T]?: boolean;
};

export interface UseValidationReturn<T> {
    values: T;
    errors: ValidationErrors<T>;
    touched: ValidationTouched<T>;
    isValid: boolean;
    isDirty: boolean;
    setValue: <K extends keyof T>(field: K, value: T[K]) => void;
    setTouched: <K extends keyof T>(field: K, touched?: boolean) => void;
    validateField: <K extends keyof T>(field: K, value: T[K]) => string | undefined;
    validateAll: () => boolean;
    reset: () => void;
    setValues: (values: Partial<T>) => void;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function isValidDate(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;
    const d = new Date(date);
    return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Validate phone number (basic international format)
 */
export function isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    return phoneRegex.test(phone);
}

/**
 * Validate minimum length
 */
export function minLength(value: string, min: number): boolean {
    return value.length >= min;
}

/**
 * Validate maximum length
 */
export function maxLength(value: string, max: number): boolean {
    return value.length <= max;
}

/**
 * Validate value is in range
 */
export function inRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
}

/**
 * Validate strong password
 */
export function isStrongPassword(password: string): {
    isValid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

// ============================================================================
// React Hook for Form Validation
// ============================================================================

/**
 * useValidation hook
 * Provides real-time form validation with visual feedback
 */
export function useValidation<T extends Record<string, unknown>>(
    initialValues: T,
    rules: ValidationRules<T>,
    options: {
        validateOnChange?: boolean;
        validateOnBlur?: boolean;
    } = {}
): UseValidationReturn<T> {
    const { validateOnChange = true, validateOnBlur = true } = options;

    const [values, setValuesState] = useState<T>(initialValues);
    const [errors, setErrors] = useState<ValidationErrors<T>>({});
    const [touched, setTouchedState] = useState<ValidationTouched<T>>({});
    const [isDirty, setIsDirty] = useState(false);

    /**
     * Validate a single field against its rules
     */
    const validateField = useCallback(<K extends keyof T>(
        field: K,
        value: T[K]
    ): string | undefined => {
        const fieldRules = rules[field];
        if (!fieldRules) return undefined;

        for (const rule of fieldRules) {
            const stringValue = String(value || '');

            switch (rule.type) {
                case 'required':
                    if (!value || (typeof value === 'string' && value.trim() === '')) {
                        return rule.message;
                    }
                    break;

                case 'minLength':
                    if (typeof value === 'string' && !minLength(stringValue, Number(rule.value))) {
                        return rule.message;
                    }
                    break;

                case 'maxLength':
                    if (typeof value === 'string' && !maxLength(stringValue, Number(rule.value))) {
                        return rule.message;
                    }
                    break;

                case 'email':
                    if (typeof value === 'string' && !isValidEmail(stringValue)) {
                        return rule.message;
                    }
                    break;

                case 'pattern':
                    if (typeof value === 'string') {
                        const pattern = new RegExp(rule.value as string);
                        if (!pattern.test(stringValue)) {
                            return rule.message;
                        }
                    }
                    break;

                case 'custom':
                    if (rule.validator && !rule.validator(value as T[K] & string)) {
                        return rule.message;
                    }
                    break;

                case 'match':
                    const matchValue = values[rule.value as keyof T];
                    if (value !== matchValue) {
                        return rule.message;
                    }
                    break;
            }
        }

        return undefined;
    }, [rules, values]);

    /**
     * Set a field value
     */
    const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
        setValuesState(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);

        if (validateOnChange && touched[field]) {
            const error = validateField(field, value);
            setErrors(prev => ({ ...prev, [field]: error }));
        }
    }, [validateOnChange, touched, validateField]);

    /**
     * Set a field as touched
     */
    const setTouched = useCallback(<K extends keyof T>(field: K, isTouched = true) => {
        setTouchedState(prev => ({ ...prev, [field]: isTouched }));

        if (validateOnBlur && isTouched) {
            const error = validateField(field, values[field]);
            setErrors(prev => ({ ...prev, [field]: error }));
        }
    }, [validateOnBlur, values, validateField]);

    /**
     * Validate all fields
     */
    const validateAll = useCallback((): boolean => {
        const newErrors: ValidationErrors<T> = {};
        let isValid = true;

        for (const field of Object.keys(rules) as Array<keyof T>) {
            const error = validateField(field, values[field]);
            if (error) {
                newErrors[field] = error;
                isValid = false;
            }
        }

        setErrors(newErrors);
        setTouchedState(
            Object.keys(rules).reduce((acc, key) => ({ ...acc, [key]: true }), {} as ValidationTouched<T>)
        );

        return isValid;
    }, [rules, values, validateField]);

    /**
     * Reset form to initial values
     */
    const reset = useCallback(() => {
        setValuesState(initialValues);
        setErrors({});
        setTouchedState({});
        setIsDirty(false);
    }, [initialValues]);

    /**
     * Set multiple values at once
     */
    const setValues = useCallback((newValues: Partial<T>) => {
        setValuesState(prev => ({ ...prev, ...newValues }));
        setIsDirty(true);
    }, []);

    /**
     * Check if form is valid
     */
    const isValid = Object.keys(errors).length === 0 &&
        Object.keys(touched).length > 0;

    return {
        values,
        errors,
        touched,
        isValid,
        isDirty,
        setValue,
        setTouched,
        validateField,
        validateAll,
        reset,
        setValues,
    };
}

// ============================================================================
// Common Validation Rules
// ============================================================================

export const commonRules = {
    required: (message = 'This field is required'): ValidationRule => ({
        type: 'required',
        message,
    }),

    email: (message = 'Please enter a valid email address'): ValidationRule => ({
        type: 'email',
        message,
    }),

    minLength: (min: number, message?: string): ValidationRule => ({
        type: 'minLength',
        value: min as unknown as string,
        message: message || `Must be at least ${min} characters`,
    }),

    maxLength: (max: number, message?: string): ValidationRule => ({
        type: 'maxLength',
        value: max as unknown as string,
        message: message || `Must be no more than ${max} characters`,
    }),

    pattern: (pattern: RegExp, message: string): ValidationRule => ({
        type: 'pattern',
        value: pattern.source,
        message,
    }),

    match: (field: string, message: string): ValidationRule => ({
        type: 'match',
        value: field,
        message,
    }),

    url: (message = 'Please enter a valid URL'): ValidationRule => ({
        type: 'custom',
        message,
        validator: isValidUrl,
    }),

    phone: (message = 'Please enter a valid phone number'): ValidationRule => ({
        type: 'custom',
        message,
        validator: isValidPhone,
    }),

    date: (message = 'Please enter a valid date (YYYY-MM-DD)'): ValidationRule => ({
        type: 'custom',
        message,
        validator: isValidDate,
    }),
};

// ============================================================================
// Real-time Validation Hook for Individual Fields
// ============================================================================

/**
 * useFieldValidation hook
 * Provides real-time validation for a single field
 */
export function useFieldValidation<T = string>(
    initialValue: T,
    rules: ValidationRule[],
    options: {
        debounceMs?: number;
        validateOnChange?: boolean;
    } = {}
) {
    const { debounceMs = 300, validateOnChange = true } = options;

    const [value, setValue] = useState<T>(initialValue);
    const [error, setError] = useState<string | undefined>();
    const [isValidating, setIsValidating] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    const validate = useCallback(async (val: T): Promise<string | undefined> => {
        setIsValidating(true);

        // Simulate async validation
        if (debounceMs > 0) {
            await new Promise(resolve => setTimeout(resolve, debounceMs));
        }

        const stringValue = String(val || '');

        for (const rule of rules) {
            switch (rule.type) {
                case 'required':
                    if (!val || (typeof val === 'string' && val.trim() === '')) {
                        setIsValidating(false);
                        return rule.message;
                    }
                    break;

                case 'minLength':
                    if (typeof val === 'string' && stringValue.length < Number(rule.value)) {
                        setIsValidating(false);
                        return rule.message;
                    }
                    break;

                case 'maxLength':
                    if (typeof val === 'string' && stringValue.length > Number(rule.value)) {
                        setIsValidating(false);
                        return rule.message;
                    }
                    break;

                case 'email':
                    if (typeof val === 'string' && !isValidEmail(stringValue)) {
                        setIsValidating(false);
                        return rule.message;
                    }
                    break;

                case 'pattern':
                    if (typeof val === 'string') {
                        const pattern = new RegExp(rule.value as string);
                        if (!pattern.test(stringValue)) {
                            setIsValidating(false);
                            return rule.message;
                        }
                    }
                    break;

                case 'custom':
                    if (rule.validator && !rule.validator(val as T & string)) {
                        setIsValidating(false);
                        return rule.message;
                    }
                    break;
            }
        }

        setIsValidating(false);
        return undefined;
    }, [rules, debounceMs]);

    useEffect(() => {
        if (validateOnChange && isDirty) {
            let isCancelled = false;
            validate(value).then((errorMsg) => {
                if (!isCancelled) {
                    setError(errorMsg);
                }
            });
            return () => {
                isCancelled = true;
            };
        }
        return undefined;
    }, [value, validateOnChange, isDirty, validate]);

    const onChange = useCallback((newValue: T) => {
        setValue(newValue);
        setIsDirty(true);
    }, []);

    const onBlur = useCallback(() => {
        validate(value).then(setError);
    }, [value, validate]);

    return {
        value,
        error,
        isValidating,
        isDirty,
        isValid: !error && isDirty,
        onChange,
        onBlur,
        setValue,
        validate: () => validate(value),
    };
}

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export function parseAndValidateRegistrationInput(body: unknown): { email: string; password: string; name: string | undefined } {
    if (typeof body !== 'object' || body === null) {
        throw new ValidationError('Invalid request body');
    }
    const data = body as Record<string, unknown>;

    const email = typeof data.email === 'string' ? data.email.trim() : '';
    const password = typeof data.password === 'string' ? data.password : '';
    const name = typeof data.name === 'string' ? data.name.trim() : undefined;

    if (!email) {
        throw new ValidationError('Email and password are required');
    }
    if (!password) {
        throw new ValidationError('Email and password are required');
    }
    if (!isValidEmail(email)) {
        throw new ValidationError('Invalid email format');
    }
    if (password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters');
    }

    return { email, password, name };
}

export function parseAndValidateHoneypot(body: unknown): string | undefined {
    if (typeof body !== 'object' || body === null) return undefined;
    const data = body as Record<string, unknown>;
    return typeof data.honeypot === 'string' ? data.honeypot : undefined;
}

export default useValidation;
