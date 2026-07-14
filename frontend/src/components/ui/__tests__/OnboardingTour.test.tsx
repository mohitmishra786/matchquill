/**
 * Onboarding Tour Tests
 * Tests for interactive onboarding tour functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import OnboardingTour, { useOnboardingTour, RestartTourButton } from '../../OnboardingTour';

// Mock driver.js
const mockDrive = vi.fn();
const mockDestroy = vi.fn();
let mockOnDestroyed: (() => void) | undefined;

vi.mock('driver.js', () => ({
    driver: vi.fn((config: { onDestroyed?: () => void }) => {
        mockOnDestroyed = config.onDestroyed;
        return {
            drive: mockDrive,
            destroy: mockDestroy,
        };
    }),
}));

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

// Mock window.location.reload
const reloadMock = vi.fn();
Object.defineProperty(window, 'location', {
    value: { reload: reloadMock },
    writable: true,
});

describe('OnboardingTour', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should not show tour if already completed', () => {
        localStorageMock.getItem.mockReturnValue(JSON.stringify({
            completed: true,
            version: '2.0',
            completedAt: new Date().toISOString()
        }));

        render(<OnboardingTour />);
        
        act(() => {
            vi.advanceTimersByTime(2000);
        });

        expect(mockDrive).not.toHaveBeenCalled();
    });

    it('should show tour if not completed', () => {
        localStorageMock.getItem.mockReturnValue(null);

        render(<OnboardingTour />);

        // The component chains two effects: a 500ms timer sets `isReady`,
        // whose state update (flushed by `act`) mounts a second effect that
        // schedules a further 1000ms timer to actually start the tour.
        // Advancing 2000ms in one shot races that second timer being
        // registered, so advance in two steps to let the effect chain settle
        // between them.
        act(() => {
            vi.advanceTimersByTime(500);
        });
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(mockDrive).toHaveBeenCalled();
    });

    it('should show tour if version changed', () => {
        localStorageMock.getItem.mockReturnValue(JSON.stringify({
            completed: true,
            version: '1.0',
            completedAt: new Date().toISOString()
        }));

        render(<OnboardingTour />);

        act(() => {
            vi.advanceTimersByTime(500);
        });
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(mockDrive).toHaveBeenCalled();
    });

    it('should force show tour when forceShow is true', () => {
        localStorageMock.getItem.mockReturnValue(JSON.stringify({
            completed: true,
            version: '2.0',
            completedAt: new Date().toISOString()
        }));

        render(<OnboardingTour forceShow={true} />);

        act(() => {
            vi.advanceTimersByTime(500);
        });
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(mockDrive).toHaveBeenCalled();
    });

    it('should call onComplete callback when tour is destroyed', async () => {
        const onComplete = vi.fn();
        localStorageMock.getItem.mockReturnValue(null);

        render(<OnboardingTour onComplete={onComplete} />);

        act(() => {
            vi.advanceTimersByTime(500);
        });
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        // Simulate tour completion by calling onDestroyed callback
        if (mockOnDestroyed) {
            mockOnDestroyed();
        }

        expect(localStorageMock.setItem).toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalled();
    });
});

describe('useOnboardingTour', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return hasCompletedTour as false when no tour data', async () => {
        localStorageMock.getItem.mockReturnValue(null);

        function TestComponent() {
            const { hasCompletedTour } = useOnboardingTour();
            return <div data-testid="completed">{hasCompletedTour === null ? 'loading' : String(hasCompletedTour)}</div>;
        }

        render(<TestComponent />);

        await waitFor(() => {
            expect(screen.getByTestId('completed').textContent).toBe('false');
        });
    });

    it('should return hasCompletedTour as true when tour is completed', async () => {
        localStorageMock.getItem.mockReturnValue(JSON.stringify({
            completed: true,
            version: '2.0',
            completedAt: new Date().toISOString()
        }));

        function TestComponent() {
            const { hasCompletedTour } = useOnboardingTour();
            return <div data-testid="completed">{hasCompletedTour === null ? 'loading' : String(hasCompletedTour)}</div>;
        }

        render(<TestComponent />);

        await waitFor(() => {
            expect(screen.getByTestId('completed').textContent).toBe('true');
        });
    });

    it('should restart tour when restartTour is called', () => {
        localStorageMock.getItem.mockReturnValue(JSON.stringify({
            completed: true,
            version: '2.0',
            completedAt: new Date().toISOString()
        }));

        function TestComponent() {
            const { restartTour } = useOnboardingTour();
            return <button onClick={restartTour}>Restart</button>;
        }

        render(<TestComponent />);
        
        fireEvent.click(screen.getByText('Restart'));

        expect(localStorageMock.removeItem).toHaveBeenCalledWith('matchquill_tour_v2');
        expect(reloadMock).toHaveBeenCalled();
    });

    it('should mark tour as completed when markTourCompleted is called', async () => {
        localStorageMock.getItem.mockReturnValue(null);

        function TestComponent() {
            const { hasCompletedTour, markTourCompleted } = useOnboardingTour();
            return (
                <div>
                    <span data-testid="completed">{hasCompletedTour === null ? 'loading' : String(hasCompletedTour)}</span>
                    <button onClick={markTourCompleted}>Complete</button>
                </div>
            );
        }

        render(<TestComponent />);

        await waitFor(() => {
            expect(screen.getByTestId('completed').textContent).toBe('false');
        });

        fireEvent.click(screen.getByText('Complete'));

        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'matchquill_tour_v2',
            expect.stringContaining('"completed":true')
        );
    });

    it('should reset tour when resetTour is called', async () => {
        localStorageMock.getItem.mockReturnValue(JSON.stringify({
            completed: true,
            version: '2.0',
            completedAt: new Date().toISOString()
        }));

        function TestComponent() {
            const { hasCompletedTour, resetTour } = useOnboardingTour();
            return (
                <div>
                    <span data-testid="completed">{hasCompletedTour === null ? 'loading' : String(hasCompletedTour)}</span>
                    <button onClick={resetTour}>Reset</button>
                </div>
            );
        }

        render(<TestComponent />);

        await waitFor(() => {
            expect(screen.getByTestId('completed').textContent).toBe('true');
        });

        fireEvent.click(screen.getByText('Reset'));

        expect(localStorageMock.removeItem).toHaveBeenCalledWith('matchquill_tour_v2');
    });
});

describe('RestartTourButton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // `hasCompletedTour` is resolved synchronously from localStorage on
    // mount (see useOnboardingTour), so there is no "loading" state to
    // observe here - this verifies the button stays hidden until the tour
    // has actually been completed.
    it('should not render when the tour has not been completed', () => {
        localStorageMock.getItem.mockReturnValue(null);

        render(<RestartTourButton />);

        expect(screen.queryByText('Restart Tour')).not.toBeInTheDocument();
    });

    it('should render when tour is completed', async () => {
        localStorageMock.getItem.mockReturnValue(JSON.stringify({
            completed: true,
            version: '2.0',
            completedAt: new Date().toISOString()
        }));

        render(<RestartTourButton />);

        await waitFor(() => {
            expect(screen.getByText('Restart Tour')).toBeInTheDocument();
        });
    });

    it('should restart tour when clicked', async () => {
        localStorageMock.getItem.mockReturnValue(JSON.stringify({
            completed: true,
            version: '2.0',
            completedAt: new Date().toISOString()
        }));

        render(<RestartTourButton />);

        await waitFor(() => {
            expect(screen.getByText('Restart Tour')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Restart Tour'));

        expect(localStorageMock.removeItem).toHaveBeenCalledWith('matchquill_tour_v2');
        expect(reloadMock).toHaveBeenCalled();
    });

    it('should apply custom className', async () => {
        localStorageMock.getItem.mockReturnValue(JSON.stringify({
            completed: true,
            version: '2.0',
            completedAt: new Date().toISOString()
        }));

        render(<RestartTourButton className="custom-class" />);

        await waitFor(() => {
            const button = screen.getByText('Restart Tour');
            expect(button).toHaveClass('custom-class');
        });
    });
});
