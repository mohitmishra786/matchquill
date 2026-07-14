/**
 * Keyboard Navigation Utilities
 * Provides comprehensive keyboard navigation support for accessibility
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export type KeyboardKey =
    | 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
    | 'Enter' | 'Escape' | 'Tab' | 'Space'
    | 'Home' | 'End' | 'PageUp' | 'PageDown'
    | string;

export interface KeyboardShortcut {
    key: KeyboardKey;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
    handler: (event: KeyboardEvent) => void;
    description: string;
    scope?: string;
}

export interface FocusableElement {
    element: HTMLElement;
    index: number;
}

export interface UseKeyboardNavigationOptions {
    /**
     * Enable circular navigation (wrap around)
     * @default true
     */
    circular?: boolean;
    /**
     * Selector for focusable elements
     * @default '[tabindex]:not([tabindex="-1"])'
     */
    focusableSelector?: string;
    /**
     * Initial focused index
     * @default -1
     */
    initialIndex?: number;
    /**
     * Callback when focus changes
     */
    onFocusChange?: (index: number, element: HTMLElement) => void;
    /**
     * Orientation of the navigation
     * @default 'vertical'
     */
    orientation?: 'horizontal' | 'vertical' | 'both';
}

export interface UseKeyboardNavigationReturn {
    focusedIndex: number;
    focusNext: () => void;
    focusPrevious: () => void;
    focusFirst: () => void;
    focusLast: () => void;
    setFocusedIndex: (index: number) => void;
    containerRef: React.RefObject<HTMLElement | null>;
}

// ============================================================================
// Keyboard Event Helpers
// ============================================================================

/**
 * Check if a keyboard event matches a key combination
 */
export function matchesKeyCombo(
    event: KeyboardEvent,
    key: KeyboardKey,
    options: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } = {}
): boolean {
    const { ctrl = false, alt = false, shift = false, meta = false } = options;

    return (
        event.key === key &&
        event.ctrlKey === ctrl &&
        event.altKey === alt &&
        event.shiftKey === shift &&
        event.metaKey === meta
    );
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(
    container: HTMLElement,
    selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
): HTMLElement[] {
    const elements = Array.from(container.querySelectorAll(selector)) as HTMLElement[];
    return elements.filter(el => {
        // Filter out disabled elements and hidden elements
        return (
            !el.hasAttribute('disabled') &&
            !el.hasAttribute('aria-disabled') &&
            el.offsetParent !== null
        );
    });
}

/**
 * Focus the next focusable element
 */
export function focusNext(
    container: HTMLElement,
    currentElement?: HTMLElement,
    options: { circular?: boolean } = {}
): HTMLElement | null {
    const focusable = getFocusableElements(container);
    if (focusable.length === 0) return null;

    // Fall back to the currently focused element so callers can invoke
    // focusNext(container) without tracking the active element themselves.
    const activeElement = currentElement ?? (document.activeElement as HTMLElement | null);
    const currentIndex = activeElement ? focusable.indexOf(activeElement) : -1;

    let nextIndex = currentIndex + 1;

    if (nextIndex >= focusable.length) {
        if (options.circular) {
            nextIndex = 0;
        } else {
            return null;
        }
    }

    focusable[nextIndex].focus();
    return focusable[nextIndex];
}

/**
 * Focus the previous focusable element
 */
export function focusPrevious(
    container: HTMLElement,
    currentElement?: HTMLElement,
    options: { circular?: boolean } = {}
): HTMLElement | null {
    const focusable = getFocusableElements(container);
    if (focusable.length === 0) return null;

    // Fall back to the currently focused element so callers can invoke
    // focusPrevious(container) without tracking the active element themselves.
    // If nothing is focused (or focus is outside the container), default to
    // "past the end" so the first call moves to the last focusable element.
    const activeElement = currentElement ?? (document.activeElement as HTMLElement | null);
    const foundIndex = activeElement ? focusable.indexOf(activeElement) : -1;
    const currentIndex = foundIndex >= 0 ? foundIndex : focusable.length;

    let prevIndex = currentIndex - 1;

    if (prevIndex < 0) {
        if (options.circular) {
            prevIndex = focusable.length - 1;
        } else {
            return null;
        }
    }

    focusable[prevIndex].focus();
    return focusable[prevIndex];
}

/**
 * Focus the first focusable element
 */
export function focusFirst(container: HTMLElement): HTMLElement | null {
    const focusable = getFocusableElements(container);
    if (focusable.length === 0) return null;

    focusable[0].focus();
    return focusable[0];
}

/**
 * Focus the last focusable element
 */
export function focusLast(container: HTMLElement): HTMLElement | null {
    const focusable = getFocusableElements(container);
    if (focusable.length === 0) return null;

    focusable[focusable.length - 1].focus();
    return focusable[focusable.length - 1];
}

/**
 * Trap focus within a container (for modals, dialogs)
 */
export function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) return;

    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];
    const activeElement = document.activeElement as HTMLElement;

    if (event.shiftKey) {
        // Shift + Tab
        if (activeElement === firstElement || !container.contains(activeElement)) {
            event.preventDefault();
            lastElement.focus();
        }
    } else {
        // Tab
        if (activeElement === lastElement || !container.contains(activeElement)) {
            event.preventDefault();
            firstElement.focus();
        }
    }
}

// ============================================================================
// React Hooks
// ============================================================================

/**
 * useKeyboardNavigation hook
 * Provides keyboard navigation for lists, menus, and other components
 */
export function useKeyboardNavigation(
    options: UseKeyboardNavigationOptions = {}
): UseKeyboardNavigationReturn {
    const {
        circular = true,
        initialIndex = -1,
        onFocusChange,
    } = options;

    const containerRef = useRef<HTMLElement>(null);
    const [focusedIndex, setFocusedIndex] = useState(initialIndex);

    const getFocusableElementsList = useCallback((): HTMLElement[] => {
        if (!containerRef.current) return [];
        return getFocusableElements(containerRef.current);
    }, []);

    const focusElement = useCallback((index: number) => {
        const elements = getFocusableElementsList();
        if (index >= 0 && index < elements.length) {
            elements[index].focus();
            setFocusedIndex(index);
            onFocusChange?.(index, elements[index]);
        }
    }, [getFocusableElementsList, onFocusChange]);

    const focusNext = useCallback(() => {
        const elements = getFocusableElementsList();
        if (elements.length === 0) return;

        let nextIndex = focusedIndex + 1;
        if (nextIndex >= elements.length) {
            nextIndex = circular ? 0 : focusedIndex;
        }
        focusElement(nextIndex);
    }, [focusedIndex, circular, focusElement, getFocusableElementsList]);

    const focusPrevious = useCallback(() => {
        const elements = getFocusableElementsList();
        if (elements.length === 0) return;

        let prevIndex = focusedIndex - 1;
        if (prevIndex < 0) {
            prevIndex = circular ? elements.length - 1 : focusedIndex;
        }
        focusElement(prevIndex);
    }, [focusedIndex, circular, focusElement, getFocusableElementsList]);

    const focusFirst = useCallback(() => {
        focusElement(0);
    }, [focusElement]);

    const focusLast = useCallback(() => {
        const elements = getFocusableElementsList();
        focusElement(elements.length - 1);
    }, [focusElement, getFocusableElementsList]);

    return {
        focusedIndex,
        focusNext,
        focusPrevious,
        focusFirst,
        focusLast,
        setFocusedIndex: focusElement,
        containerRef,
    };
}

/**
 * useKeyboardShortcuts hook
 * Register keyboard shortcuts with descriptions for help modals
 */
export function useKeyboardShortcuts(
    shortcuts: KeyboardShortcut[],
    options: { enabled?: boolean; scope?: string } = {}
) {
    const { enabled = true, scope = 'global' } = options;
    const shortcutsRef = useRef(shortcuts);

    useEffect(() => {
        shortcutsRef.current = shortcuts;
    }, [shortcuts]);

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            // Don't trigger shortcuts when typing in input fields
            if (
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement ||
                (event.target as HTMLElement)?.isContentEditable
            ) {
                return;
            }

            for (const shortcut of shortcutsRef.current) {
                if (shortcut.scope && shortcut.scope !== scope) continue;

                if (
                    matchesKeyCombo(event, shortcut.key, {
                        ctrl: shortcut.ctrl,
                        alt: shortcut.alt,
                        shift: shortcut.shift,
                        meta: shortcut.meta,
                    })
                ) {
                    event.preventDefault();
                    shortcut.handler(event);
                    break;
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [enabled, scope]);

    // Return shortcuts for help modal
    return shortcuts.filter(s => !s.scope || s.scope === scope);
}

/**
 * useFocusTrap hook
 * Trap focus within a container element
 */
export function useFocusTrap<T extends HTMLElement>(isActive: boolean) {
    const containerRef = useRef<T>(null);
    const previouslyFocusedElement = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (isActive) {
            // Store the currently focused element
            previouslyFocusedElement.current = document.activeElement as HTMLElement;

            // Focus the first focusable element in the container
            if (containerRef.current) {
                focusFirst(containerRef.current);
            }
        } else {
            // Restore focus when trap is deactivated
            previouslyFocusedElement.current?.focus();
        }
    }, [isActive]);

    useEffect(() => {
        if (!isActive || !containerRef.current) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                // Let the component handle escape
                return;
            }
            trapFocus(containerRef.current!, event);
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isActive]);

    return containerRef;
}

/**
 * useArrowKeyNavigation hook
 * Simplified hook for arrow key navigation in lists
 */
export function useArrowKeyNavigation(
    itemCount: number,
    onSelect: (index: number) => void,
    options: { orientation?: 'horizontal' | 'vertical' } = {}
) {
    const { orientation = 'vertical' } = options;
    const [activeIndex, setActiveIndex] = useState(-1);

    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        if (itemCount === 0) return;

        let newIndex: number;

        switch (event.key) {
            case orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight':
                event.preventDefault();
                newIndex = activeIndex < itemCount - 1 ? activeIndex + 1 : 0;
                break;
            case orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft':
                event.preventDefault();
                newIndex = activeIndex > 0 ? activeIndex - 1 : itemCount - 1;
                break;
            case 'Home':
                event.preventDefault();
                newIndex = 0;
                break;
            case 'End':
                event.preventDefault();
                newIndex = itemCount - 1;
                break;
            case 'Enter':
            case ' ':
                if (activeIndex >= 0) {
                    event.preventDefault();
                    onSelect(activeIndex);
                }
                return;
            default:
                return;
        }

        setActiveIndex(newIndex);
    }, [activeIndex, itemCount, onSelect, orientation]);

    return {
        activeIndex,
        setActiveIndex,
        handleKeyDown,
    };
}

// ============================================================================
// Common Keyboard Shortcuts
// ============================================================================

export const commonShortcuts = {
    save: (handler: () => void): KeyboardShortcut => ({
        key: 's',
        ctrl: true,
        handler: (e) => {
            e.preventDefault();
            handler();
        },
        description: 'Save',
    }),

    search: (handler: () => void): KeyboardShortcut => ({
        key: 'k',
        ctrl: true,
        handler: (e) => {
            e.preventDefault();
            handler();
        },
        description: 'Search',
    }),

    close: (handler: () => void): KeyboardShortcut => ({
        key: 'Escape',
        handler,
        description: 'Close/Cancel',
    }),

    newItem: (handler: () => void): KeyboardShortcut => ({
        key: 'n',
        ctrl: true,
        handler: (e) => {
            e.preventDefault();
            handler();
        },
        description: 'New item',
    }),

    help: (handler: () => void): KeyboardShortcut => ({
        key: '?',
        handler: (e) => {
            e.preventDefault();
            handler();
        },
        description: 'Show keyboard shortcuts',
    }),

    navigateNext: (handler: () => void): KeyboardShortcut => ({
        key: 'Tab',
        handler: (e) => {
            if (!e.shiftKey) {
                handler();
            }
        },
        description: 'Navigate to next field',
    }),

    navigatePrevious: (handler: () => void): KeyboardShortcut => ({
        key: 'Tab',
        shift: true,
        handler,
        description: 'Navigate to previous field',
    }),
};

// ============================================================================
// Accessibility Helpers
// ============================================================================

/**
 * Create ARIA attributes for a keyboard-navigable list
 */
export function createListAriaAttributes(
    id: string,
    activeIndex: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _itemCount: number
) {
    return {
        role: 'listbox',
        'aria-activedescendant': activeIndex >= 0 ? `${id}-item-${activeIndex}` : undefined,
        'aria-orientation': 'vertical' as const,
        tabIndex: 0,
    };
}

/**
 * Create ARIA attributes for a keyboard-navigable list item
 */
export function createListItemAriaAttributes(
    listId: string,
    index: number,
    isActive: boolean,
    isSelected: boolean
) {
    return {
        id: `${listId}-item-${index}`,
        role: 'option',
        'aria-selected': isSelected,
        tabIndex: isActive ? 0 : -1,
    };
}

/**
 * Create ARIA attributes for a menu
 */
export function createMenuAriaAttributes(isOpen: boolean) {
    return {
        role: 'menu',
        'aria-expanded': isOpen,
        tabIndex: isOpen ? 0 : -1,
    };
}

/**
 * Create ARIA attributes for a menu item
 */
export function createMenuItemAriaAttributes(disabled = false) {
    return {
        role: 'menuitem',
        tabIndex: disabled ? -1 : 0,
        'aria-disabled': disabled,
    };
}

const keyboardNavigation = {
    matchesKeyCombo,
    getFocusableElements,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
    trapFocus,
    useKeyboardNavigation,
    useKeyboardShortcuts,
    useFocusTrap,
    useArrowKeyNavigation,
    commonShortcuts,
    createListAriaAttributes,
    createListItemAriaAttributes,
    createMenuAriaAttributes,
    createMenuItemAriaAttributes,
};

export default keyboardNavigation;
