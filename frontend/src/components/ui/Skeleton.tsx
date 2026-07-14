import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility to merge tailwind classes
 */
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Skeleton Component
 * Provides a loading placeholder with consistent animation
 * Supports multiple variants for different use cases
 */

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    /**
     * Visual variant of the skeleton
     * @default 'default'
     */
    variant?: 'default' | 'circle' | 'text' | 'card' | 'avatar';
    /**
     * Size preset for common sizes
     * @default 'md'
     */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    /**
     * Width of the skeleton (overrides size)
     */
    width?: string | number;
    /**
     * Height of the skeleton (overrides size)
     */
    height?: string | number;
    /**
     * Whether to show shimmer animation instead of pulse
     * @default false
     */
    shimmer?: boolean;
}

const variantStyles = {
    default: 'rounded-md',
    circle: 'rounded-full',
    text: 'rounded',
    card: 'rounded-xl',
    avatar: 'rounded-full',
};

const sizeStyles = {
    xs: 'w-4 h-4',
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32',
};

export default function Skeleton({
    className = '',
    variant = 'default',
    size = 'md',
    width,
    height,
    shimmer = false,
    style,
    ...props
}: SkeletonProps) {
    const customStyles: React.CSSProperties = {
        ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
        ...(height && { height: typeof height === 'number' ? `${height}px` : height }),
        ...style,
    };

    return (
        <div
            className={cn(
                'bg-gray-200 dark:bg-gray-700',
                variantStyles[variant],
                !width && !height && sizeStyles[size],
                shimmer
                    ? 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent'
                    : 'animate-pulse',
                className
            )}
            style={customStyles}
            role="presentation"
            aria-hidden="true"
            {...props}
        />
    );
}

/**
 * Skeleton Text - Multiple lines of text skeleton
 */
interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
    lines?: number;
    lineHeight?: string;
    lastLineWidth?: string;
}

export function SkeletonText({
    lines = 3,
    lineHeight = 'h-4',
    lastLineWidth = 'w-3/4',
    className = '',
    ...props
}: SkeletonTextProps) {
    return (
        <div className={cn('space-y-2', className)} {...props}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    variant="text"
                    className={cn(
                        lineHeight,
                        i === lines - 1 ? lastLineWidth : 'w-full'
                    )}
                />
            ))}
        </div>
    );
}

/**
 * Skeleton Card - Card-shaped skeleton with header, content, and footer areas
 */
interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
    hasHeader?: boolean;
    hasFooter?: boolean;
    lines?: number;
}

export function SkeletonCard({
    hasHeader = true,
    hasFooter = true,
    lines = 3,
    className = '',
    ...props
}: SkeletonCardProps) {
    return (
        <div
            className={cn(
                'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4',
                className
            )}
            {...props}
        >
            {hasHeader && (
                <div className="flex items-center gap-4">
                    <Skeleton variant="avatar" size="sm" />
                    <div className="flex-1 space-y-2">
                        <Skeleton variant="text" className="h-4 w-1/3" />
                        <Skeleton variant="text" className="h-3 w-1/4" />
                    </div>
                </div>
            )}
            <SkeletonText lines={lines} lineHeight="h-3" />
            {hasFooter && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                    <Skeleton variant="text" className="h-3 w-20" />
                    <Skeleton variant="text" className="h-3 w-16" />
                </div>
            )}
        </div>
    );
}

/**
 * Skeleton Avatar - Avatar skeleton with optional text lines
 */
interface SkeletonAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    hasText?: boolean;
    textLines?: number;
}

export function SkeletonAvatar({
    size = 'md',
    hasText = true,
    textLines = 2,
    className = '',
    ...props
}: SkeletonAvatarProps) {
    return (
        <div className={cn('flex items-center gap-3', className)} {...props}>
            <Skeleton variant="avatar" size={size} />
            {hasText && (
                <div className="flex-1 space-y-2">
                    <Skeleton variant="text" className="h-4 w-32" />
                    {textLines > 1 && (
                        <Skeleton variant="text" className="h-3 w-24" />
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Skeleton Table - Table skeleton with rows and columns
 */
interface SkeletonTableProps extends React.HTMLAttributes<HTMLDivElement> {
    rows?: number;
    columns?: number;
    hasHeader?: boolean;
}

export function SkeletonTable({
    rows = 5,
    columns = 4,
    hasHeader = true,
    className = '',
    ...props
}: SkeletonTableProps) {
    return (
        <div className={cn('w-full', className)} {...props}>
            {hasHeader && (
                <div className="flex gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    {Array.from({ length: columns }).map((_, i) => (
                        <Skeleton
                            key={i}
                            variant="text"
                            className="h-4 flex-1"
                        />
                    ))}
                </div>
            )}
            <div className="space-y-3 pt-3">
                {Array.from({ length: rows }).map((_, rowIndex) => (
                    <div key={rowIndex} className="flex gap-4">
                        {Array.from({ length: columns }).map((_, colIndex) => (
                            <Skeleton
                                key={colIndex}
                                variant="text"
                                className="h-4 flex-1"
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Loading State Wrapper - Wraps content with loading state
 */
interface LoadingStateProps {
    isLoading: boolean;
    children: React.ReactNode;
    fallback?: React.ReactNode;
    loadingText?: string;
}

export function LoadingState({
    isLoading,
    children,
    fallback,
    loadingText = 'Loading...',
}: LoadingStateProps) {
    if (!isLoading) {
        return <>{children}</>;
    }

    if (fallback) {
        return <>{fallback}</>;
    }

    return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="relative">
                <div className="w-12 h-12 rounded-full border-4 border-gray-200 dark:border-gray-700" />
                <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{loadingText}</p>
        </div>
    );
}

/**
 * Skeleton List - List of skeleton items
 */
interface SkeletonListProps extends React.HTMLAttributes<HTMLDivElement> {
    items?: number;
    itemHeight?: string;
    hasAvatar?: boolean;
}

export function SkeletonList({
    items = 5,
    itemHeight = 'h-16',
    hasAvatar = true,
    className = '',
    ...props
}: SkeletonListProps) {
    return (
        <div className={cn('space-y-3', className)} {...props}>
            {Array.from({ length: items }).map((_, i) => (
                <div
                    key={i}
                    className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-800',
                        itemHeight
                    )}
                >
                    {hasAvatar && <Skeleton variant="avatar" size="sm" />}
                    <div className="flex-1 space-y-2">
                        <Skeleton variant="text" className="h-3 w-1/3" />
                        <Skeleton variant="text" className="h-2 w-1/4" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export { Skeleton };
