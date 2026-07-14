/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { ErrorBoundary } from '../../ErrorBoundary';
import { GlobalErrorBoundary } from '../../GlobalErrorBoundary';

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
    captureException: vi.fn(),
}));

// Component that throws an error
const ThrowError: React.FC<{ error?: Error }> = ({ error = new Error('Test error') }) => {
    throw error;
};

// Component that throws after render
const ThrowAfterRender: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
    if (shouldThrow) {
        throw new Error('Error after render');
    }
    return <div>Normal content</div>;
};

describe('ErrorBoundary', () => {
    // Suppress console.error for expected errors
    const originalConsoleError = console.error;
    beforeAll(() => {
        console.error = vi.fn();
    });

    afterAll(() => {
        console.error = originalConsoleError;
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders children when there is no error', () => {
        render(
            <ErrorBoundary>
                <div data-testid="child">Child content</div>
            </ErrorBoundary>
        );

        expect(screen.getByTestId('child')).toBeInTheDocument();
        expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('renders error UI when child throws an error', () => {
        render(
            <ErrorBoundary componentName="TestComponent">
                <ThrowError />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByText(/Error in component:/)).toBeInTheDocument();
        expect(screen.getByText('TestComponent')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
    });

    it('renders error UI without component name when not provided', () => {
        render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.queryByText(/Error in component:/)).not.toBeInTheDocument();
    });

    it('renders custom fallback when provided', () => {
        const customFallback = <div data-testid="custom-fallback">Custom error UI</div>;
        render(
            <ErrorBoundary fallback={customFallback}>
                <ThrowError />
            </ErrorBoundary>
        );

        expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
        expect(screen.getByText('Custom error UI')).toBeInTheDocument();
        expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('calls onError callback when error occurs', () => {
        const onError = vi.fn();
        const testError = new Error('Test callback error');

        render(
            <ErrorBoundary onError={onError}>
                <ThrowError error={testError} />
            </ErrorBoundary>
        );

        expect(onError).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Test callback error' }),
            expect.objectContaining({ componentStack: expect.any(String) })
        );
    });

    it('resets error state when Try Again button is clicked', () => {
        const { rerender } = render(
            <ErrorBoundary componentName="TestComponent">
                <ThrowAfterRender shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();

        // Fix the underlying issue first (e.g. the parent re-renders with
        // corrected props). The boundary is still showing the fallback UI
        // here because getDerivedStateFromError only clears on a reset, not
        // on a prop change.
        rerender(
            <ErrorBoundary componentName="TestComponent">
                <ThrowAfterRender shouldThrow={false} />
            </ErrorBoundary>
        );
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();

        // Now click "Try Again" to reset the boundary's error state. Since
        // the children no longer throw, it renders the recovered content.
        // (Note: clicking reset before fixing the underlying props would
        // just re-render the still-throwing child and re-trip the boundary
        // immediately, since props.children hasn't changed yet.)
        fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));

        expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    it('shows error details in development mode', () => {
        const originalEnv = process.env.NODE_ENV;
        (process.env as { NODE_ENV: string }).NODE_ENV = 'development';

        render(
            <ErrorBoundary>
                <ThrowError error={new Error('Development error message')} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Development error message')).toBeInTheDocument();

        (process.env as { NODE_ENV: string | undefined }).NODE_ENV = originalEnv;
    });

    it('hides error details in production mode', () => {
        const originalEnv = process.env.NODE_ENV;
        (process.env as { NODE_ENV: string }).NODE_ENV = 'production';

        render(
            <ErrorBoundary>
                <ThrowError error={new Error('Production error message')} />
            </ErrorBoundary>
        );

        expect(screen.queryByText('Production error message')).not.toBeInTheDocument();

        (process.env as { NODE_ENV: string | undefined }).NODE_ENV = originalEnv;
    });
});

describe('GlobalErrorBoundary', () => {
    const originalConsoleError = console.error;
    beforeAll(() => {
        console.error = vi.fn();
    });

    afterAll(() => {
        console.error = originalConsoleError;
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders children when there is no error', () => {
        render(
            <GlobalErrorBoundary>
                <div data-testid="child">Child content</div>
            </GlobalErrorBoundary>
        );

        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('renders full-page error UI when error occurs', () => {
        render(
            <GlobalErrorBoundary>
                <ThrowError />
            </GlobalErrorBoundary>
        );

        expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
        expect(screen.getByText(/We're sorry, but MatchQuill encountered an unexpected error/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Reload Page/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Go Home/i })).toBeInTheDocument();
    });

    it('shows error details in development mode', () => {
        const originalEnv = process.env.NODE_ENV;
        (process.env as { NODE_ENV: string }).NODE_ENV = 'development';

        render(
            <GlobalErrorBoundary>
                <ThrowError error={new Error('Global development error')} />
            </GlobalErrorBoundary>
        );

        expect(screen.getByText('Global development error')).toBeInTheDocument();

        (process.env as { NODE_ENV: string | undefined }).NODE_ENV = originalEnv;
    });

    it('shows support link', () => {
        render(
            <GlobalErrorBoundary>
                <ThrowError />
            </GlobalErrorBoundary>
        );

        const supportLink = screen.getByText('contact support');
        expect(supportLink).toBeInTheDocument();
        expect(supportLink).toHaveAttribute('href', 'mailto:support@matchquill.com');
    });

    it('has correct styling classes for dark theme', () => {
        render(
            <GlobalErrorBoundary>
                <ThrowError />
            </GlobalErrorBoundary>
        );

        // Check for dark theme classes
        const container = screen.getByText('Oops! Something went wrong').parentElement;
        expect(container).toHaveClass('bg-gray-800/50');
        expect(container).toHaveClass('border-gray-700');
    });
});
