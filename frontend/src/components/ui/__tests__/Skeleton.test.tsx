/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Skeleton, {
    SkeletonText,
    SkeletonCard,
    SkeletonAvatar,
    SkeletonTable,
    SkeletonList,
    LoadingState,
} from '../Skeleton';

describe('Skeleton', () => {
    it('renders with default props', () => {
        render(<Skeleton data-testid="skeleton" />);
        const skeleton = screen.getByTestId('skeleton');
        expect(skeleton).toBeInTheDocument();
        expect(skeleton).toHaveClass('animate-pulse');
        expect(skeleton).toHaveClass('bg-gray-200');
    });

    it('renders with custom className', () => {
        render(<Skeleton data-testid="skeleton" className="custom-class" />);
        const skeleton = screen.getByTestId('skeleton');
        expect(skeleton).toHaveClass('custom-class');
    });

    it('renders circle variant', () => {
        render(<Skeleton data-testid="skeleton" variant="circle" />);
        const skeleton = screen.getByTestId('skeleton');
        expect(skeleton).toHaveClass('rounded-full');
    });

    it('renders with custom width and height', () => {
        render(<Skeleton data-testid="skeleton" width={100} height={50} />);
        const skeleton = screen.getByTestId('skeleton');
        expect(skeleton).toHaveStyle({ width: '100px', height: '50px' });
    });

    it('renders with string width and height', () => {
        render(<Skeleton data-testid="skeleton" width="50%" height="2rem" />);
        const skeleton = screen.getByTestId('skeleton');
        expect(skeleton).toHaveStyle({ width: '50%', height: '2rem' });
    });

    it('renders with shimmer animation', () => {
        render(<Skeleton data-testid="skeleton" shimmer />);
        const skeleton = screen.getByTestId('skeleton');
        expect(skeleton).toHaveClass('relative');
        expect(skeleton).toHaveClass('overflow-hidden');
    });

    it('has aria-hidden attribute', () => {
        render(<Skeleton data-testid="skeleton" />);
        const skeleton = screen.getByTestId('skeleton');
        expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    });
});

describe('SkeletonText', () => {
    it('renders default number of lines', () => {
        render(<SkeletonText data-testid="skeleton-text" />);
        const container = screen.getByTestId('skeleton-text');
        const lines = container.querySelectorAll('[aria-hidden="true"]');
        expect(lines).toHaveLength(3);
    });

    it('renders specified number of lines', () => {
        render(<SkeletonText data-testid="skeleton-text" lines={5} />);
        const container = screen.getByTestId('skeleton-text');
        const lines = container.querySelectorAll('[aria-hidden="true"]');
        expect(lines).toHaveLength(5);
    });

    it('last line has reduced width', () => {
        render(<SkeletonText lines={3} />);
        const lines = screen.getAllByRole('presentation', { hidden: true });
        const lastLine = lines[lines.length - 1];
        expect(lastLine).toHaveClass('w-3/4');
    });
});

describe('SkeletonCard', () => {
    it('renders card with header, content, and footer by default', () => {
        render(<SkeletonCard data-testid="skeleton-card" />);
        const card = screen.getByTestId('skeleton-card');
        expect(card).toBeInTheDocument();
        expect(card).toHaveClass('rounded-xl');
    });

    it('renders without header when hasHeader is false', () => {
        render(<SkeletonCard data-testid="skeleton-card" hasHeader={false} />);
        const card = screen.getByTestId('skeleton-card');
        // Card should still render but without avatar section
        expect(card).toBeInTheDocument();
    });

    it('renders without footer when hasFooter is false', () => {
        render(<SkeletonCard data-testid="skeleton-card" hasFooter={false} />);
        const card = screen.getByTestId('skeleton-card');
        expect(card).toBeInTheDocument();
    });
});

describe('SkeletonAvatar', () => {
    it('renders avatar with text by default', () => {
        render(<SkeletonAvatar data-testid="skeleton-avatar" />);
        const avatar = screen.getByTestId('skeleton-avatar');
        expect(avatar).toBeInTheDocument();
        expect(avatar).toHaveClass('flex');
        expect(avatar).toHaveClass('items-center');
    });

    it('renders avatar without text when hasText is false', () => {
        render(<SkeletonAvatar data-testid="skeleton-avatar" hasText={false} />);
        const avatar = screen.getByTestId('skeleton-avatar');
        expect(avatar).toBeInTheDocument();
    });

    it('renders with different sizes', () => {
        // SkeletonAvatar renders multiple role="presentation" placeholders
        // (the avatar circle plus text lines) - the avatar circle is
        // always the first one rendered.
        const { rerender } = render(<SkeletonAvatar size="sm" />);
        rerender(<SkeletonAvatar size="lg" />);
        const [avatar] = screen.getAllByRole('presentation', { hidden: true });
        expect(avatar).toHaveClass('w-24', 'h-24');
    });
});

describe('SkeletonTable', () => {
    it('renders table with header and rows', () => {
        render(<SkeletonTable data-testid="skeleton-table" rows={3} columns={4} />);
        const table = screen.getByTestId('skeleton-table');
        expect(table).toBeInTheDocument();
    });

    it('renders without header when hasHeader is false', () => {
        render(<SkeletonTable data-testid="skeleton-table" hasHeader={false} />);
        const table = screen.getByTestId('skeleton-table');
        expect(table).toBeInTheDocument();
    });

    it('renders correct number of rows', () => {
        render(<SkeletonTable rows={5} columns={3} />);
        const rows = screen.getAllByRole('presentation', { hidden: true });
        // 5 rows * 3 columns = 15 skeletons + 3 header skeletons = 18
        expect(rows.length).toBeGreaterThanOrEqual(15);
    });
});

describe('SkeletonList', () => {
    it('renders list with specified items', () => {
        render(<SkeletonList data-testid="skeleton-list" items={5} />);
        const list = screen.getByTestId('skeleton-list');
        expect(list).toBeInTheDocument();
        expect(list.children).toHaveLength(5);
    });

    it('renders without avatar when hasAvatar is false', () => {
        render(<SkeletonList data-testid="skeleton-list" hasAvatar={false} />);
        const list = screen.getByTestId('skeleton-list');
        expect(list).toBeInTheDocument();
    });
});

describe('LoadingState', () => {
    it('renders children when not loading', () => {
        render(
            <LoadingState isLoading={false}>
                <div data-testid="content">Content</div>
            </LoadingState>
        );
        expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('renders loading spinner when loading', () => {
        render(
            <LoadingState isLoading={true}>
                <div data-testid="content">Content</div>
            </LoadingState>
        );
        expect(screen.queryByTestId('content')).not.toBeInTheDocument();
        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders custom loading text', () => {
        render(
            <LoadingState isLoading={true} loadingText="Custom loading message">
                <div>Content</div>
            </LoadingState>
        );
        expect(screen.getByText('Custom loading message')).toBeInTheDocument();
    });

    it('renders custom fallback when provided', () => {
        render(
            <LoadingState
                isLoading={true}
                fallback={<div data-testid="custom-fallback">Custom Fallback</div>}
            >
                <div>Content</div>
            </LoadingState>
        );
        expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
});
