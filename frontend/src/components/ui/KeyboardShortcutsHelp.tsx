/**
 * Keyboard Shortcuts Help Modal
 * Displays all available keyboard shortcuts with search functionality
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';

interface Shortcut {
    key: string;
    description: string;
    category: 'Navigation' | 'Actions' | 'Forms' | 'Global';
}

const SHORTCUTS: Shortcut[] = [
    // Global shortcuts
    { key: '?', description: 'Show/hide keyboard shortcuts help', category: 'Global' },
    { key: 'Esc', description: 'Close modal or cancel current action', category: 'Global' },
    { key: 'Cmd/Ctrl + K', description: 'Open command palette', category: 'Global' },
    
    // Navigation shortcuts
    { key: 'g + d', description: 'Go to Dashboard', category: 'Navigation' },
    { key: 'g + p', description: 'Go to Profile', category: 'Navigation' },
    { key: 'g + t', description: 'Go to Templates', category: 'Navigation' },
    { key: 'g + s', description: 'Go to Settings', category: 'Navigation' },
    { key: 'Arrow Up/Down', description: 'Navigate list items', category: 'Navigation' },
    { key: 'Tab', description: 'Move to next focusable element', category: 'Navigation' },
    { key: 'Shift + Tab', description: 'Move to previous focusable element', category: 'Navigation' },
    
    // Actions shortcuts
    { key: 'Cmd/Ctrl + S', description: 'Save current form', category: 'Actions' },
    { key: 'Cmd/Ctrl + N', description: 'Create new item', category: 'Actions' },
    { key: 'Cmd/Ctrl + E', description: 'Export current view', category: 'Actions' },
    { key: 'Cmd/Ctrl + F', description: 'Focus search input', category: 'Actions' },
    { key: '/', description: 'Focus search input', category: 'Actions' },
    
    // Forms shortcuts
    { key: 'Enter', description: 'Submit form or activate button', category: 'Forms' },
    { key: 'Cmd/Ctrl + Enter', description: 'Submit form (alternative)', category: 'Forms' },
];

interface KeyboardShortcutsHelpProps {
    isOpen: boolean;
    onClose: () => void;
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Filter shortcuts based on search and category
    const filteredShortcuts = SHORTCUTS.filter((shortcut) => {
        const matchesSearch = searchQuery === '' ||
            shortcut.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
            shortcut.description.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesCategory = selectedCategory === null || shortcut.category === selectedCategory;
        
        return matchesSearch && matchesCategory;
    });

    // Group shortcuts by category
    const groupedShortcuts = filteredShortcuts.reduce((acc, shortcut) => {
        if (!acc[shortcut.category]) {
            acc[shortcut.category] = [];
        }
        acc[shortcut.category].push(shortcut);
        return acc;
    }, {} as Record<string, Shortcut[]>);

    // Reset search when modal opens.
    // This runs in a useEffect (after render/commit), so calling setState
    // directly here does not trigger a synchronous render-phase update -
    // no requestAnimationFrame indirection is needed, and deferring via RAF
    // only delayed the reset by a frame (visible as a brief flash of the
    // previous search value when reopening the modal).
    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setSelectedCategory(null);
        }
    }, [isOpen]);

    // Handle keyboard shortcut to open help
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Open help with '?' key (but not when typing in inputs)
            if (e.key === '?' && !isOpen) {
                const target = e.target as HTMLElement;
                if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
                    e.preventDefault();
                    onClose(); // Toggle - this will actually open it since isOpen is false
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const categories = ['Global', 'Navigation', 'Actions', 'Forms'];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Keyboard Shortcuts"
            size="lg"
        >
            <div className="space-y-6">
                {/* Search and Filter */}
                <div className="space-y-4">
                    {/* Search Input */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search shortcuts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-2 pl-10 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                            autoFocus
                        />
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    {/* Category Filters */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                selectedCategory === null
                                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                                    : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)]'
                            }`}
                        >
                            All
                        </button>
                        {categories.map((category) => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                    selectedCategory === category
                                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                                        : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)]'
                                }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Shortcuts List */}
                <div className="space-y-6 max-h-[60vh] overflow-y-auto">
                    {Object.entries(groupedShortcuts).length === 0 ? (
                        <div className="text-center py-8 text-[var(--muted-foreground)]">
                            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p>No shortcuts found</p>
                        </div>
                    ) : (
                        Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
                            <div key={category}>
                                <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
                                    {category}
                                </h3>
                                <div className="space-y-2">
                                    {shortcuts.map((shortcut, index) => (
                                        <div
                                            key={`${shortcut.key}-${index}`}
                                            className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--muted)] hover:bg-[var(--border)] transition-colors"
                                        >
                                            <span className="text-[var(--foreground)]">
                                                {shortcut.description}
                                            </span>
                                            <kbd className="px-2 py-1 text-xs font-mono font-semibold bg-[var(--card)] border border-[var(--border)] rounded shadow-sm text-[var(--foreground)] whitespace-nowrap">
                                                {shortcut.key}
                                            </kbd>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-[var(--border)] text-center text-sm text-[var(--muted-foreground)]">
                    Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-[var(--muted)] border border-[var(--border)] rounded">?</kbd> anytime to show this help
                </div>
            </div>
        </Modal>
    );
}

/**
 * Hook to manage keyboard shortcuts help modal
 */
export function useKeyboardShortcutsHelp() {
    const [isOpen, setIsOpen] = useState(false);

    const openHelp = useCallback(() => setIsOpen(true), []);
    const closeHelp = useCallback(() => setIsOpen(false), []);
    const toggleHelp = useCallback(() => setIsOpen((prev) => !prev), []);

    // Listen for '?' key to toggle help
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '?') {
                const target = e.target as HTMLElement;
                // Don't trigger when typing in input fields
                if (
                    target.tagName !== 'INPUT' &&
                    target.tagName !== 'TEXTAREA' &&
                    !target.isContentEditable
                ) {
                    e.preventDefault();
                    toggleHelp();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleHelp]);

    return {
        isOpen,
        openHelp,
        closeHelp,
        toggleHelp,
        KeyboardShortcutsHelpComponent: () => (
            <KeyboardShortcutsHelp isOpen={isOpen} onClose={closeHelp} />
        ),
    };
}
