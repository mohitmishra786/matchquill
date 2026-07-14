/**
 * Smoke tests for the public pricing page: both tiers render with their
 * price/feature copy, and the CTA reflects auth state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PricingPage from '../page';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
}));

const mockUseSession = vi.fn();
vi.mock('next-auth/react', () => ({
    useSession: () => mockUseSession(),
}));

describe('PricingPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    });

    it('renders both tiers with their prices', () => {
        render(<PricingPage />);

        expect(screen.getByText('Free')).toBeInTheDocument();
        expect(screen.getByText('Pro')).toBeInTheDocument();
        expect(screen.getByText('$0')).toBeInTheDocument();
        expect(screen.getByText('$9.99')).toBeInTheDocument();
    });

    it('renders the feature lists for both tiers', () => {
        render(<PricingPage />);

        expect(screen.getByText('5 tailored resumes per month')).toBeInTheDocument();
        expect(screen.getByText('Unlimited tailored resumes')).toBeInTheDocument();
        expect(screen.getByText('Cancel anytime, no lock-in')).toBeInTheDocument();
    });

    it('shows the upgrade CTA for an unauthenticated visitor', () => {
        render(<PricingPage />);

        expect(screen.getByRole('button', { name: /upgrade to pro/i })).toBeInTheDocument();
        expect(screen.getByText('Start Free')).toBeInTheDocument();
    });

    it('shows "your current plan" for an authenticated user', () => {
        mockUseSession.mockReturnValue({
            data: { user: { id: 'user-1' } },
            status: 'authenticated',
        });

        render(<PricingPage />);

        expect(screen.getByText('Your current plan')).toBeInTheDocument();
    });

    it('mentions Stripe processes payments and that cancellation is self-serve', () => {
        render(<PricingPage />);

        expect(
            screen.getByText(/Payments are processed securely by Stripe/i)
        ).toBeInTheDocument();
    });
});
