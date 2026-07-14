/**
 * Keyboard Shortcuts Help Modal Tests
 * Tests for keyboard shortcuts help functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KeyboardShortcutsHelp, useKeyboardShortcutsHelp } from '../KeyboardShortcutsHelp';

describe('KeyboardShortcutsHelp', () => {
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render when open', () => {
        render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);
        
        expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search shortcuts...')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
        render(<KeyboardShortcutsHelp isOpen={false} onClose={mockOnClose} />);
        
        expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
    });

    it('should display all shortcut categories', () => {
        render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);

        // Each category name appears twice (a filter chip button and a
        // section heading), so scope to the headings to avoid ambiguity.
        expect(screen.getByRole('heading', { name: 'Global' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Navigation' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Actions' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Forms' })).toBeInTheDocument();
    });

    it('should filter shortcuts by search query', () => {
        render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);
        
        const searchInput = screen.getByPlaceholderText('Search shortcuts...');
        fireEvent.change(searchInput, { target: { value: 'save' } });
        
        expect(screen.getByText('Save current form')).toBeInTheDocument();
    });

    it('should filter shortcuts by category', () => {
        render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);

        // "Global" matches both the filter chip button and a section
        // heading - target the button explicitly.
        const globalButton = screen.getByRole('button', { name: 'Global' });
        fireEvent.click(globalButton);

        // Should show Global shortcuts
        expect(screen.getByText('Show/hide keyboard shortcuts help')).toBeInTheDocument();
    });

    it('should show "All" button for clearing category filter', () => {
        render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);

        const allButton = screen.getByText('All');
        expect(allButton).toBeInTheDocument();

        // Click a category first
        fireEvent.click(screen.getByRole('button', { name: 'Global' }));

        // Then click All to clear filter
        fireEvent.click(allButton);

        // All categories should be visible again
        expect(screen.getByRole('heading', { name: 'Navigation' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Actions' })).toBeInTheDocument();
    });

    it('should show empty state when no shortcuts match', () => {
        render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);
        
        const searchInput = screen.getByPlaceholderText('Search shortcuts...');
        fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } });
        
        expect(screen.getByText('No shortcuts found')).toBeInTheDocument();
    });

    it('should display shortcut keys in kbd elements', () => {
        render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);

        // "?" appears in both the shortcuts list and the footer help text.
        expect(screen.getAllByText('?').length).toBeGreaterThan(0);
        expect(screen.getByText('Esc')).toBeInTheDocument();
    });

    it('should show help text in footer', () => {
        render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);

        expect(screen.getByText(/Press/)).toBeInTheDocument();
        // The footer text is split across text nodes by the <kbd> element
        // ("Press <kbd>?</kbd> anytime to show this help"), so no single
        // node's own text matches "anytime to show this help" exactly -
        // match on the full normalized text of the containing element
        // instead, restricted to the element whose *direct* children don't
        // already contain the full phrase (to avoid matching every ancestor).
        expect(screen.getByText((_, element) => {
            if (!element) return false;
            const normalize = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();
            const hasFullText = normalize(element.textContent) === 'Press ? anytime to show this help';
            const childHasFullText = Array.from(element.children).some(
                child => normalize(child.textContent) === 'Press ? anytime to show this help'
            );
            return hasFullText && !childHasFullText;
        })).toBeInTheDocument();
    });

    it('should reset search when reopened', () => {
        const { rerender } = render(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);
        
        const searchInput = screen.getByPlaceholderText('Search shortcuts...');
        fireEvent.change(searchInput, { target: { value: 'search term' } });
        
        // Close and reopen
        rerender(<KeyboardShortcutsHelp isOpen={false} onClose={mockOnClose} />);
        rerender(<KeyboardShortcutsHelp isOpen={true} onClose={mockOnClose} />);
        
        // Search should be cleared
        expect(screen.getByPlaceholderText('Search shortcuts...')).toHaveValue('');
    });
});

describe('useKeyboardShortcutsHelp', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Clean up event listeners
        window.removeEventListener('keydown', () => {});
    });

    it('should start with modal closed', () => {
        function TestComponent() {
            const { isOpen } = useKeyboardShortcutsHelp();
            return <div data-testid="is-open">{isOpen ? 'open' : 'closed'}</div>;
        }

        render(<TestComponent />);
        expect(screen.getByTestId('is-open').textContent).toBe('closed');
    });

    it('should open help when openHelp is called', () => {
        function TestComponent() {
            const { isOpen, openHelp } = useKeyboardShortcutsHelp();
            return (
                <div>
                    <span data-testid="is-open">{isOpen ? 'open' : 'closed'}</span>
                    <button onClick={openHelp}>Open</button>
                </div>
            );
        }

        render(<TestComponent />);
        fireEvent.click(screen.getByText('Open'));
        
        expect(screen.getByTestId('is-open').textContent).toBe('open');
    });

    it('should close help when closeHelp is called', () => {
        function TestComponent() {
            const { isOpen, openHelp, closeHelp } = useKeyboardShortcutsHelp();
            return (
                <div>
                    <span data-testid="is-open">{isOpen ? 'open' : 'closed'}</span>
                    <button onClick={openHelp}>Open</button>
                    <button onClick={closeHelp}>Close</button>
                </div>
            );
        }

        render(<TestComponent />);
        fireEvent.click(screen.getByText('Open'));
        fireEvent.click(screen.getByText('Close'));
        
        expect(screen.getByTestId('is-open').textContent).toBe('closed');
    });

    it('should toggle help when toggleHelp is called', () => {
        function TestComponent() {
            const { isOpen, toggleHelp } = useKeyboardShortcutsHelp();
            return (
                <div>
                    <span data-testid="is-open">{isOpen ? 'open' : 'closed'}</span>
                    <button onClick={toggleHelp}>Toggle</button>
                </div>
            );
        }

        render(<TestComponent />);
        
        // Toggle open
        fireEvent.click(screen.getByText('Toggle'));
        expect(screen.getByTestId('is-open').textContent).toBe('open');
        
        // Toggle closed
        fireEvent.click(screen.getByText('Toggle'));
        expect(screen.getByTestId('is-open').textContent).toBe('closed');
    });

    it('should open help when ? key is pressed', async () => {
        function TestComponent() {
            const { isOpen, KeyboardShortcutsHelpComponent } = useKeyboardShortcutsHelp();
            return (
                <div>
                    <span data-testid="is-open">{isOpen ? 'open' : 'closed'}</span>
                    <KeyboardShortcutsHelpComponent />
                </div>
            );
        }

        render(<TestComponent />);
        
        // Press ? key
        fireEvent.keyDown(window, { key: '?' });
        
        await waitFor(() => {
            expect(screen.getByTestId('is-open').textContent).toBe('open');
        });
    });

    it('should not open help when ? is typed in an input', () => {
        function TestComponent() {
            const { isOpen, KeyboardShortcutsHelpComponent } = useKeyboardShortcutsHelp();
            return (
                <div>
                    <span data-testid="is-open">{isOpen ? 'open' : 'closed'}</span>
                    <input data-testid="test-input" />
                    <KeyboardShortcutsHelpComponent />
                </div>
            );
        }

        render(<TestComponent />);
        
        const input = screen.getByTestId('test-input');
        input.focus();
        
        // Press ? key while input is focused
        fireEvent.keyDown(input, { key: '?' });
        
        // Should still be closed
        expect(screen.getByTestId('is-open').textContent).toBe('closed');
    });

    it('should not open help when ? is typed in a textarea', () => {
        function TestComponent() {
            const { isOpen, KeyboardShortcutsHelpComponent } = useKeyboardShortcutsHelp();
            return (
                <div>
                    <span data-testid="is-open">{isOpen ? 'open' : 'closed'}</span>
                    <textarea data-testid="test-textarea" />
                    <KeyboardShortcutsHelpComponent />
                </div>
            );
        }

        render(<TestComponent />);
        
        const textarea = screen.getByTestId('test-textarea');
        textarea.focus();
        
        // Press ? key while textarea is focused
        fireEvent.keyDown(textarea, { key: '?' });
        
        // Should still be closed
        expect(screen.getByTestId('is-open').textContent).toBe('closed');
    });

    it('should render KeyboardShortcutsHelpComponent', () => {
        function TestComponent() {
            const { openHelp, KeyboardShortcutsHelpComponent } = useKeyboardShortcutsHelp();
            return (
                <div>
                    <button onClick={openHelp}>Open</button>
                    <KeyboardShortcutsHelpComponent />
                </div>
            );
        }

        render(<TestComponent />);
        
        // Initially not visible
        expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
        
        // Open the modal
        fireEvent.click(screen.getByText('Open'));
        
        // Now visible
        expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });
});
