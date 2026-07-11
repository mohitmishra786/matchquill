'use client';

/**
 * Granular error boundary for dashboard/profile sections.
 * Isolates failures so one section does not crash the whole page.
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { createLogger } from '@/lib/logger';

const logger = createLogger({ component: 'SectionErrorBoundary' });

interface Props {
    children: ReactNode;
    sectionName: string;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    message: string;
}

export class SectionErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, message: '' };

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            message: error.message || 'Something went wrong',
        };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        logger.error('Section crashed', {
            section: this.props.sectionName,
            error: error.message,
            componentStack: info.componentStack?.slice(0, 500),
        });
    }

    private handleRetry = (): void => {
        this.setState({ hasError: false, message: '' });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <div
                    className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                    role="alert"
                    aria-live="assertive"
                >
                    <p className="font-semibold mb-1">
                        {this.props.sectionName} failed to load
                    </p>
                    <p className="mb-3 text-red-700">{this.state.message}</p>
                    <button
                        type="button"
                        onClick={this.handleRetry}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700"
                    >
                        Try again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default SectionErrorBoundary;
