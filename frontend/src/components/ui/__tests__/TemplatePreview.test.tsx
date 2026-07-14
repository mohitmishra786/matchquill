/**
 * Template Preview Component Tests
 * Tests for template preview with realistic sample data
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TemplatePreview from '../../templates/TemplatePreview';

const mockTemplate = {
    id: 'professional',
    name: 'Professional',
    description: 'Best for experienced professionals',
    sections: ['Experience', 'Skills', 'Projects', 'Education'],
    color: 'from-blue-500 to-indigo-600',
    category: 'Professional',
    bestFor: ['Executives', 'Managers'],
};

const mockUserData = {
    name: 'Jane Smith',
    title: 'Product Manager',
    experience: [
        { title: 'Senior PM', company: 'Tech Corp' },
    ],
    skills: ['Product Strategy', 'Agile', 'Analytics'],
};

describe('TemplatePreview', () => {
    it('should render template information correctly', () => {
        render(
            <TemplatePreview
                {...mockTemplate}
                selected={false}
                onSelect={vi.fn()}
            />
        );

        // "Professional" is rendered twice: as the template title (heading)
        // and as the category badge.
        expect(screen.getByRole('heading', { name: 'Professional' })).toBeInTheDocument();
        expect(screen.getByText('Best for experienced professionals')).toBeInTheDocument();
        expect(screen.getAllByText('Professional')).toHaveLength(2);
    });

    it('should show selection state when selected', () => {
        render(
            <TemplatePreview
                {...mockTemplate}
                selected={true}
                onSelect={vi.fn()}
            />
        );

        expect(screen.getByText('Selected - Click to use this template')).toBeInTheDocument();
    });

    it('should call onSelect when clicked', () => {
        const onSelect = vi.fn();
        render(
            <TemplatePreview
                {...mockTemplate}
                selected={false}
                onSelect={onSelect}
            />
        );

        fireEvent.click(screen.getByRole('button'));
        expect(onSelect).toHaveBeenCalledWith('professional');
    });

    it('should display "Best for" roles', () => {
        render(
            <TemplatePreview
                {...mockTemplate}
                selected={false}
                onSelect={vi.fn()}
            />
        );

        expect(screen.getByText('Best for:')).toBeInTheDocument();
        expect(screen.getByText('Executives')).toBeInTheDocument();
        expect(screen.getByText('Managers')).toBeInTheDocument();
    });

    it('should display all sections as tags', () => {
        render(
            <TemplatePreview
                {...mockTemplate}
                selected={false}
                onSelect={vi.fn()}
            />
        );

        mockTemplate.sections.forEach(section => {
            expect(screen.getByText(section)).toBeInTheDocument();
        });
    });

    it('should show preview label', () => {
        render(
            <TemplatePreview
                {...mockTemplate}
                selected={false}
                onSelect={vi.fn()}
            />
        );

        expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    it('should use user data when provided', () => {
        render(
            <TemplatePreview
                {...mockTemplate}
                selected={false}
                onSelect={vi.fn()}
                userData={mockUserData}
            />
        );

        // Component should render without errors with user data
        expect(screen.getByRole('heading', { name: 'Professional' })).toBeInTheDocument();
    });

    it('should use sample data when user data is not provided', () => {
        render(
            <TemplatePreview
                {...mockTemplate}
                selected={false}
                onSelect={vi.fn()}
            />
        );

        // Component should render with sample data
        expect(screen.getByRole('heading', { name: 'Professional' })).toBeInTheDocument();
    });

    it('should apply correct CSS classes when selected', () => {
        const { container } = render(
            <TemplatePreview
                {...mockTemplate}
                selected={true}
                onSelect={vi.fn()}
            />
        );

        const button = container.querySelector('button');
        expect(button).toHaveClass('border-[var(--primary)]');
    });

    it('should apply correct CSS classes when not selected', () => {
        const { container } = render(
            <TemplatePreview
                {...mockTemplate}
                selected={false}
                onSelect={vi.fn()}
            />
        );

        const button = container.querySelector('button');
        expect(button).toHaveClass('border-[var(--border)]');
    });

    it('should not show category badge when category is not provided', () => {
        const templateWithoutCategory = { ...mockTemplate, category: undefined };
        render(
            <TemplatePreview
                {...templateWithoutCategory}
                selected={false}
                onSelect={vi.fn()}
            />
        );

        // Should only show the name once, not as a category badge
        const professionalElements = screen.getAllByText('Professional');
        expect(professionalElements.length).toBe(1);
    });

    it('should not show "Best for" section when bestFor is empty', () => {
        const templateWithoutBestFor = { ...mockTemplate, bestFor: [] };
        render(
            <TemplatePreview
                {...templateWithoutBestFor}
                selected={false}
                onSelect={vi.fn()}
            />
        );

        expect(screen.queryByText('Best for:')).not.toBeInTheDocument();
    });
});
