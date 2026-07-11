/**
 * Validation Utilities Tests
 */

import {
    isValidEmail,
    isValidUrl,
    isValidDate,
    isValidPhone,
    minLength,
    maxLength,
    inRange,
    isStrongPassword,
    useValidation,
    useFieldValidation,
    commonRules,
} from '../validation';
import { renderHook, act } from '@testing-library/react';

// ============================================================================
// Validation Function Tests
// ============================================================================

describe('isValidEmail', () => {
    it('returns true for valid emails', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
        expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('returns false for invalid emails', () => {
        expect(isValidEmail('')).toBe(false);
        expect(isValidEmail('invalid')).toBe(false);
        expect(isValidEmail('@example.com')).toBe(false);
        expect(isValidEmail('test@')).toBe(false);
        expect(isValidEmail('test@.com')).toBe(false);
    });
});

describe('isValidUrl', () => {
    it('returns true for valid URLs', () => {
        expect(isValidUrl('https://example.com')).toBe(true);
        expect(isValidUrl('http://localhost:3000')).toBe(true);
        expect(isValidUrl('ftp://files.example.com')).toBe(true);
    });

    it('returns false for invalid URLs', () => {
        expect(isValidUrl('')).toBe(false);
        expect(isValidUrl('not-a-url')).toBe(false);
        expect(isValidUrl('example.com')).toBe(false);
    });
});

describe('isValidDate', () => {
    it('returns true for valid dates', () => {
        expect(isValidDate('2024-01-15')).toBe(true);
        expect(isValidDate('2023-12-31')).toBe(true);
        expect(isValidDate('2000-01-01')).toBe(true);
    });

    it('returns false for invalid dates', () => {
        expect(isValidDate('')).toBe(false);
        expect(isValidDate('2024-13-01')).toBe(false);
        expect(isValidDate('2024-01-32')).toBe(false);
        expect(isValidDate('01-15-2024')).toBe(false);
        expect(isValidDate('invalid')).toBe(false);
    });
});

describe('isValidPhone', () => {
    it('returns true for valid phone numbers', () => {
        expect(isValidPhone('+1-555-123-4567')).toBe(true);
        expect(isValidPhone('555-123-4567')).toBe(true);
        expect(isValidPhone('(555) 123-4567')).toBe(true);
        expect(isValidPhone('5551234567')).toBe(true);
    });

    it('returns false for invalid phone numbers', () => {
        expect(isValidPhone('')).toBe(false);
        expect(isValidPhone('123')).toBe(false);
        expect(isValidPhone('abc-def-ghij')).toBe(false);
    });
});

describe('minLength', () => {
    it('returns true when string meets minimum length', () => {
        expect(minLength('hello', 3)).toBe(true);
        expect(minLength('hello', 5)).toBe(true);
    });

    it('returns false when string is too short', () => {
        expect(minLength('hi', 3)).toBe(false);
        expect(minLength('', 1)).toBe(false);
    });
});

describe('maxLength', () => {
    it('returns true when string is within maximum length', () => {
        expect(maxLength('hi', 5)).toBe(true);
        expect(maxLength('hello', 5)).toBe(true);
    });

    it('returns false when string is too long', () => {
        expect(maxLength('hello world', 5)).toBe(false);
    });
});

describe('inRange', () => {
    it('returns true when value is within range', () => {
        expect(inRange(5, 1, 10)).toBe(true);
        expect(inRange(1, 1, 10)).toBe(true);
        expect(inRange(10, 1, 10)).toBe(true);
    });

    it('returns false when value is outside range', () => {
        expect(inRange(0, 1, 10)).toBe(false);
        expect(inRange(11, 1, 10)).toBe(false);
    });
});

describe('isStrongPassword', () => {
    it('returns valid for strong passwords', () => {
        const result = isStrongPassword('StrongPass123!');
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('returns errors for weak passwords', () => {
        const result = isStrongPassword('weak');
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('requires at least 10 characters', () => {
        // 9 chars, otherwise strong
        const result = isStrongPassword('Short1!Aa');
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes('at least 10'))).toBe(true);
    });

    it('detects missing uppercase', () => {
        const result = isStrongPassword('lowercase123!');
        expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('detects missing lowercase', () => {
        const result = isStrongPassword('UPPERCASE123!');
        expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('detects missing number', () => {
        const result = isStrongPassword('NoNumbers!!');
        expect(result.errors).toContain('Password must contain at least one number');
    });

    it('detects missing special character', () => {
        const result = isStrongPassword('NoSpecial12');
        expect(result.errors).toContain('Password must contain at least one special character');
    });
});

// ============================================================================
// Common Rules Tests
// ============================================================================

describe('commonRules', () => {
    it('creates required rule', () => {
        const rule = commonRules.required('Custom message');
        expect(rule.type).toBe('required');
        expect(rule.message).toBe('Custom message');
    });

    it('creates email rule', () => {
        const rule = commonRules.email();
        expect(rule.type).toBe('email');
    });

    it('creates minLength rule', () => {
        const rule = commonRules.minLength(5);
        expect(rule.type).toBe('minLength');
        expect(rule.value).toBe('5');
    });

    it('creates maxLength rule', () => {
        const rule = commonRules.maxLength(10);
        expect(rule.type).toBe('maxLength');
        expect(rule.value).toBe('10');
    });

    it('creates pattern rule', () => {
        const rule = commonRules.pattern(/^[a-z]+$/, 'Only lowercase letters');
        expect(rule.type).toBe('pattern');
        expect(rule.value).toBe('^[a-z]+$');
    });

    it('creates url rule', () => {
        const rule = commonRules.url();
        expect(rule.type).toBe('custom');
        expect(rule.validator).toBeDefined();
    });
});

// ============================================================================
// useValidation Hook Tests
// ============================================================================

describe('useValidation', () => {
    const initialValues = {
        name: '',
        email: '',
    };

    const rules = {
        name: [commonRules.required('Name is required')],
        email: [
            commonRules.required('Email is required'),
            commonRules.email(),
        ],
    };

    it('initializes with correct values', () => {
        const { result } = renderHook(() =>
            useValidation(initialValues, rules)
        );

        expect(result.current.values).toEqual(initialValues);
        expect(result.current.errors).toEqual({});
        expect(result.current.isDirty).toBe(false);
    });

    it('updates value and marks as dirty', () => {
        const { result } = renderHook(() =>
            useValidation(initialValues, rules)
        );

        act(() => {
            result.current.setValue('name', 'John');
        });

        expect(result.current.values.name).toBe('John');
        expect(result.current.isDirty).toBe(true);
    });

    it('validates field on blur', () => {
        const { result } = renderHook(() =>
            useValidation(initialValues, rules)
        );

        act(() => {
            result.current.setTouched('name', true);
        });

        expect(result.current.errors.name).toBe('Name is required');
    });

    it('clears error when valid value is entered', () => {
        const { result } = renderHook(() =>
            useValidation(initialValues, rules)
        );

        act(() => {
            result.current.setTouched('name', true);
        });

        expect(result.current.errors.name).toBeDefined();

        act(() => {
            result.current.setValue('name', 'John');
        });

        expect(result.current.errors.name).toBeUndefined();
    });

    it('validates all fields', () => {
        const { result } = renderHook(() =>
            useValidation(initialValues, rules)
        );

        act(() => {
            result.current.validateAll();
        });

        expect(result.current.errors.name).toBeDefined();
        expect(result.current.errors.email).toBeDefined();
    });

    it('resets to initial state', () => {
        const { result } = renderHook(() =>
            useValidation(initialValues, rules)
        );

        act(() => {
            result.current.setValue('name', 'John');
            result.current.setTouched('name', true);
        });

        act(() => {
            result.current.reset();
        });

        expect(result.current.values).toEqual(initialValues);
        expect(result.current.errors).toEqual({});
        expect(result.current.isDirty).toBe(false);
    });

    it('sets multiple values at once', () => {
        const { result } = renderHook(() =>
            useValidation(initialValues, rules)
        );

        act(() => {
            result.current.setValues({ name: 'John', email: 'john@example.com' });
        });

        expect(result.current.values.name).toBe('John');
        expect(result.current.values.email).toBe('john@example.com');
    });
});

// ============================================================================
// useFieldValidation Hook Tests
// ============================================================================

describe('useFieldValidation', () => {
    const rules = [
        commonRules.required('Field is required'),
        commonRules.minLength(3, 'Must be at least 3 characters'),
    ];

    it('initializes with correct state', () => {
        const { result } = renderHook(() =>
            useFieldValidation('', rules)
        );

        expect(result.current.value).toBe('');
        expect(result.current.error).toBeUndefined();
        expect(result.current.isDirty).toBe(false);
    });

    it('updates value and marks as dirty on change', () => {
        const { result } = renderHook(() =>
            useFieldValidation('', rules)
        );

        act(() => {
            result.current.onChange('test');
        });

        expect(result.current.value).toBe('test');
        expect(result.current.isDirty).toBe(true);
    });

    it('validates on blur', async () => {
        const { result } = renderHook(() =>
            useFieldValidation('', rules, { debounceMs: 0 })
        );

        await act(async () => {
            await result.current.onBlur();
        });

        expect(result.current.error).toBe('Field is required');
    });

    it('clears error when valid', async () => {
        const { result } = renderHook(() =>
            useFieldValidation('', rules, { debounceMs: 0 })
        );

        act(() => {
            result.current.onChange('ab');
        });

        await act(async () => {
            await result.current.validate();
        });

        expect(result.current.error).toBe('Must be at least 3 characters');

        act(() => {
            result.current.onChange('valid');
        });

        await act(async () => {
            await result.current.validate();
        });

        expect(result.current.error).toBeUndefined();
    });
});
