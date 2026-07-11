/**
 * Keyboard Navigation Utilities Tests
 */

import {
    matchesKeyCombo,
    getFocusableElements,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
    trapFocus,
    useKeyboardNavigation,
    useArrowKeyNavigation,
    commonShortcuts,
    createListAriaAttributes,
    createListItemAriaAttributes,
} from '../keyboardNavigation';
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

// ============================================================================
// matchesKeyCombo Tests
// ============================================================================

describe('matchesKeyCombo', () => {
    it('matches simple key press', () => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        expect(matchesKeyCombo(event, 'Enter')).toBe(true);
    });

    it('does not match different key', () => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        expect(matchesKeyCombo(event, 'Enter')).toBe(false);
    });

    it('matches key with modifiers', () => {
        const event = new KeyboardEvent('keydown', {
            key: 's',
            ctrlKey: true,
        });
        expect(matchesKeyCombo(event, 's', { ctrl: true })).toBe(true);
    });

    it('does not match when modifier is missing', () => {
        const event = new KeyboardEvent('keydown', { key: 's' });
        expect(matchesKeyCombo(event, 's', { ctrl: true })).toBe(false);
    });

    it('matches multiple modifiers', () => {
        const event = new KeyboardEvent('keydown', {
            key: 'k',
            ctrlKey: true,
            shiftKey: true,
        });
        expect(matchesKeyCombo(event, 'k', { ctrl: true, shift: true })).toBe(true);
    });
});

// ============================================================================
// getFocusableElements Tests
// ============================================================================

describe('getFocusableElements', () => {
    it('returns focusable elements from container', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <button>Button 1</button>
            <input type="text" />
            <a href="#">Link</a>
            <div tabindex="0">Div with tabindex</div>
        `;

        const elements = getFocusableElements(container);
        expect(elements.length).toBe(4);
    });

    it('excludes disabled elements', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <button>Enabled</button>
            <button disabled>Disabled</button>
        `;

        const elements = getFocusableElements(container);
        expect(elements.length).toBe(1);
    });

    it('excludes hidden elements', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <button>Visible</button>
            <button style="display: none">Hidden</button>
        `;

        const elements = getFocusableElements(container);
        expect(elements.length).toBe(1);
    });

    it('excludes elements with tabindex="-1"', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <div tabindex="0">Focusable</div>
            <div tabindex="-1">Not focusable</div>
        `;

        const elements = getFocusableElements(container);
        expect(elements.length).toBe(1);
    });
});

// ============================================================================
// Focus Navigation Tests
// ============================================================================

describe('focusNext', () => {
    it('focuses the next element', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <button id="btn1">Button 1</button>
            <button id="btn2">Button 2</button>
        `;
        document.body.appendChild(container);

        const btn1 = container.querySelector('#btn1') as HTMLElement;
        btn1.focus();

        const result = focusNext(container);
        expect(document.activeElement?.id).toBe('btn2');
        expect(result?.id).toBe('btn2');

        document.body.removeChild(container);
    });

    it('returns null when no next element (non-circular)', () => {
        const container = document.createElement('div');
        container.innerHTML = `<button id="btn1">Button 1</button>`;
        document.body.appendChild(container);

        const btn1 = container.querySelector('#btn1') as HTMLElement;
        btn1.focus();

        const result = focusNext(container, btn1, { circular: false });
        expect(result).toBeNull();

        document.body.removeChild(container);
    });

    it('wraps to first element when circular', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <button id="btn1">Button 1</button>
            <button id="btn2">Button 2</button>
        `;
        document.body.appendChild(container);

        const btn2 = container.querySelector('#btn2') as HTMLElement;
        btn2.focus();

        focusNext(container, btn2, { circular: true });
        expect(document.activeElement?.id).toBe('btn1');

        document.body.removeChild(container);
    });
});

describe('focusPrevious', () => {
    it('focuses the previous element', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <button id="btn1">Button 1</button>
            <button id="btn2">Button 2</button>
        `;
        document.body.appendChild(container);

        const btn2 = container.querySelector('#btn2') as HTMLElement;
        btn2.focus();

        focusPrevious(container);
        expect(document.activeElement?.id).toBe('btn1');

        document.body.removeChild(container);
    });

    it('wraps to last element when circular', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <button id="btn1">Button 1</button>
            <button id="btn2">Button 2</button>
        `;
        document.body.appendChild(container);

        const btn1 = container.querySelector('#btn1') as HTMLElement;
        btn1.focus();

        focusPrevious(container, btn1, { circular: true });
        expect(document.activeElement?.id).toBe('btn2');

        document.body.removeChild(container);
    });
});

describe('focusFirst', () => {
    it('focuses the first element', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <button id="btn1">Button 1</button>
            <button id="btn2">Button 2</button>
        `;
        document.body.appendChild(container);

        focusFirst(container);
        expect(document.activeElement?.id).toBe('btn1');

        document.body.removeChild(container);
    });
});

describe('focusLast', () => {
    it('focuses the last element', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <button id="btn1">Button 1</button>
            <button id="btn2">Button 2</button>
        `;
        document.body.appendChild(container);

        focusLast(container);
        expect(document.activeElement?.id).toBe('btn2');

        document.body.removeChild(container);
    });
});

// ============================================================================
// trapFocus Tests
// ============================================================================

describe('trapFocus', () => {
    it('prevents tab from leaving container', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <button id="btn1">Button 1</button>
            <button id="btn2">Button 2</button>
        `;
        document.body.appendChild(container);

        const btn2 = container.querySelector('#btn2') as HTMLElement;
        btn2.focus();

        const event = new KeyboardEvent('keydown', {
            key: 'Tab',
            bubbles: true,
        });

        trapFocus(container, event);
        expect(document.activeElement?.id).toBe('btn1');

        document.body.removeChild(container);
    });

    it('handles shift+tab', () => {
        const container = document.createElement('div');
        container.innerHTML = `
            <button id="btn1">Button 1</button>
            <button id="btn2">Button 2</button>
        `;
        document.body.appendChild(container);

        const btn1 = container.querySelector('#btn1') as HTMLElement;
        btn1.focus();

        const event = new KeyboardEvent('keydown', {
            key: 'Tab',
            shiftKey: true,
            bubbles: true,
        });

        trapFocus(container, event);
        expect(document.activeElement?.id).toBe('btn2');

        document.body.removeChild(container);
    });
});

// ============================================================================
// useKeyboardNavigation Hook Tests
// ============================================================================

describe('useKeyboardNavigation', () => {
    it('initializes with correct state', () => {
        const { result } = renderHook(() => useKeyboardNavigation());

        expect(result.current.focusedIndex).toBe(-1);
        expect(result.current.containerRef.current).toBeNull();
    });

    it('initializes with custom initial index', () => {
        const { result } = renderHook(() =>
            useKeyboardNavigation({ initialIndex: 0 })
        );

        expect(result.current.focusedIndex).toBe(0);
    });
});

// ============================================================================
// useArrowKeyNavigation Hook Tests
// ============================================================================

describe('useArrowKeyNavigation', () => {
    it('initializes with correct state', () => {
        const onSelect = vi.fn();
        const { result } = renderHook(() =>
            useArrowKeyNavigation(5, onSelect)
        );

        expect(result.current.activeIndex).toBe(-1);
    });

    it('navigates down with arrow key', () => {
        const onSelect = vi.fn();
        const { result } = renderHook(() =>
            useArrowKeyNavigation(5, onSelect)
        );

        act(() => {
            result.current.handleKeyDown({
                key: 'ArrowDown',
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent);
        });

        expect(result.current.activeIndex).toBe(0);
    });

    it('navigates up with arrow key', () => {
        const onSelect = vi.fn();
        const { result } = renderHook(() =>
            useArrowKeyNavigation(5, onSelect)
        );

        act(() => {
            result.current.setActiveIndex(2);
        });

        act(() => {
            result.current.handleKeyDown({
                key: 'ArrowUp',
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent);
        });

        expect(result.current.activeIndex).toBe(1);
    });

    it('wraps around at end', () => {
        const onSelect = vi.fn();
        const { result } = renderHook(() =>
            useArrowKeyNavigation(3, onSelect)
        );

        act(() => {
            result.current.setActiveIndex(2);
        });

        act(() => {
            result.current.handleKeyDown({
                key: 'ArrowDown',
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent);
        });

        expect(result.current.activeIndex).toBe(0);
    });

    it('calls onSelect on Enter', () => {
        const onSelect = vi.fn();
        const { result } = renderHook(() =>
            useArrowKeyNavigation(5, onSelect)
        );

        act(() => {
            result.current.setActiveIndex(2);
        });

        act(() => {
            result.current.handleKeyDown({
                key: 'Enter',
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent);
        });

        expect(onSelect).toHaveBeenCalledWith(2);
    });

    it('navigates to first on Home key', () => {
        const onSelect = vi.fn();
        const { result } = renderHook(() =>
            useArrowKeyNavigation(5, onSelect)
        );

        act(() => {
            result.current.setActiveIndex(3);
        });

        act(() => {
            result.current.handleKeyDown({
                key: 'Home',
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent);
        });

        expect(result.current.activeIndex).toBe(0);
    });

    it('navigates to last on End key', () => {
        const onSelect = vi.fn();
        const { result } = renderHook(() =>
            useArrowKeyNavigation(5, onSelect)
        );

        act(() => {
            result.current.setActiveIndex(1);
        });

        act(() => {
            result.current.handleKeyDown({
                key: 'End',
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent);
        });

        expect(result.current.activeIndex).toBe(4);
    });
});

// ============================================================================
// ARIA Helpers Tests
// ============================================================================

describe('createListAriaAttributes', () => {
    it('creates correct attributes for list', () => {
        const attrs = createListAriaAttributes('my-list', 2, 5);

        expect(attrs.role).toBe('listbox');
        expect(attrs['aria-activedescendant']).toBe('my-list-item-2');
        expect(attrs['aria-orientation']).toBe('vertical');
        expect(attrs.tabIndex).toBe(0);
    });

    it('handles no active item', () => {
        const attrs = createListAriaAttributes('my-list', -1, 5);

        expect(attrs['aria-activedescendant']).toBeUndefined();
    });
});

describe('createListItemAriaAttributes', () => {
    it('creates correct attributes for list item', () => {
        const attrs = createListItemAriaAttributes('my-list', 3, true, false);

        expect(attrs.id).toBe('my-list-item-3');
        expect(attrs.role).toBe('option');
        expect(attrs['aria-selected']).toBe(false);
        expect(attrs.tabIndex).toBe(0);
    });

    it('sets tabIndex to -1 when not active', () => {
        const attrs = createListItemAriaAttributes('my-list', 3, false, true);

        expect(attrs.tabIndex).toBe(-1);
        expect(attrs['aria-selected']).toBe(true);
    });
});

// ============================================================================
// Common Shortcuts Tests
// ============================================================================

describe('commonShortcuts', () => {
    it('creates save shortcut', () => {
        const handler = vi.fn();
        const shortcut = commonShortcuts.save(handler);

        expect(shortcut.key).toBe('s');
        expect(shortcut.ctrl).toBe(true);
        expect(shortcut.description).toBe('Save');

        const event = { preventDefault: vi.fn() } as unknown as KeyboardEvent;
        shortcut.handler(event);
        expect(handler).toHaveBeenCalled();
    });

    it('creates search shortcut', () => {
        const handler = vi.fn();
        const shortcut = commonShortcuts.search(handler);

        expect(shortcut.key).toBe('k');
        expect(shortcut.ctrl).toBe(true);
        expect(shortcut.description).toBe('Search');
    });

    it('creates close shortcut', () => {
        const handler = vi.fn();
        const shortcut = commonShortcuts.close(handler);

        expect(shortcut.key).toBe('Escape');
        expect(shortcut.description).toBe('Close/Cancel');
    });

    it('creates help shortcut', () => {
        const handler = vi.fn();
        const shortcut = commonShortcuts.help(handler);

        expect(shortcut.key).toBe('?');
        expect(shortcut.description).toBe('Show keyboard shortcuts');
    });
});
