/**
 * Tests for ProjectForm Component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProjectForm from '../ProjectForm';

describe('ProjectForm', () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render empty form for new project', () => {
        render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

        expect(screen.getByLabelText(/Project Name/i)).toHaveValue('');
        expect(screen.getByLabelText(/Description/i)).toHaveValue('');
        expect(screen.getByLabelText(/Project URL/i)).toHaveValue('');
        expect(screen.getByText('Save Project')).toBeInTheDocument();
    });

    it('should render form with existing project data', () => {
        const project = {
            id: 'proj-1',
            name: 'Test Project',
            description: 'Test Description',
            url: 'https://github.com/test/project',
            startDate: '2023-01-01',
            technologies: ['React', 'TypeScript'],
            highlights: ['Feature 1', 'Feature 2'],
        };

        render(<ProjectForm project={project} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

        expect(screen.getByLabelText(/Project Name/i)).toHaveValue('Test Project');
        expect(screen.getByLabelText(/Description/i)).toHaveValue('Test Description');
        expect(screen.getByLabelText(/Project URL/i)).toHaveValue('https://github.com/test/project');
    });

    it('should validate required fields on submit', async () => {
        render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

        const submitButton = screen.getByText('Save Project');
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/Project name is required/i)).toBeInTheDocument();
            expect(screen.getByText(/Description is required/i)).toBeInTheDocument();
        });

        expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should validate URL format', async () => {
        render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

        const nameInput = screen.getByLabelText(/Project Name/i);
        const descInput = screen.getByLabelText(/Description/i);
        const urlInput = screen.getByLabelText(/Project URL/i);
        const submitButton = screen.getByText('Save Project');

        fireEvent.change(nameInput, { target: { value: 'Test Project' } });
        fireEvent.change(descInput, { target: { value: 'Test Description' } });
        fireEvent.change(urlInput, { target: { value: 'javascript:alert(1)' } });

        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/Invalid URL/i)).toBeInTheDocument();
        });

        expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should accept valid http and https URLs', async () => {
        mockOnSubmit.mockResolvedValue(undefined);

        render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

        const nameInput = screen.getByLabelText(/Project Name/i);
        const descInput = screen.getByLabelText(/Description/i);
        const urlInput = screen.getByLabelText(/Project URL/i);
        const submitButton = screen.getByText('Save Project');

        fireEvent.change(nameInput, { target: { value: 'Test Project' } });
        fireEvent.change(descInput, { target: { value: 'Test Description' } });
        fireEvent.change(urlInput, { target: { value: 'https://github.com/test/project' } });

        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockOnSubmit).toHaveBeenCalled();
        });

        const submittedData = mockOnSubmit.mock.calls[0][0];
        expect(submittedData.url).toBe('https://github.com/test/project');
    });

    it('should submit form with valid data', async () => {
        mockOnSubmit.mockResolvedValue(undefined);

        render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

        fireEvent.change(screen.getByLabelText(/Project Name/i), {
            target: { value: 'My Project' },
        });
        fireEvent.change(screen.getByLabelText(/Description/i), {
            target: { value: 'Project Description' },
        });
        fireEvent.change(screen.getByLabelText(/Technologies/i), {
            target: { value: 'React, TypeScript, Node.js' },
        });

        fireEvent.click(screen.getByText('Save Project'));

        await waitFor(() => {
            // sanitizeUrl() (src/lib/sanitization.ts) normalizes an empty/absent
            // URL to `null` (its return type is `string | null`), not `undefined`.
            expect(mockOnSubmit).toHaveBeenCalledWith({
                name: 'My Project',
                description: 'Project Description',
                url: null,
                startDate: undefined,
                endDate: undefined,
                technologies: ['React', 'TypeScript', 'Node.js'],
                highlights: [],
            });
        });
    });

    it('should parse technologies as comma-separated list', async () => {
        mockOnSubmit.mockResolvedValue(undefined);

        render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

        fireEvent.change(screen.getByLabelText(/Project Name/i), {
            target: { value: 'Test' },
        });
        fireEvent.change(screen.getByLabelText(/Description/i), {
            target: { value: 'Desc' },
        });
        fireEvent.change(screen.getByLabelText(/Technologies/i), {
            target: { value: 'React, TypeScript,  Node.js  , Docker' },
        });

        fireEvent.click(screen.getByText('Save Project'));

        await waitFor(() => {
            const submittedData = mockOnSubmit.mock.calls[0][0];
            expect(submittedData.technologies).toEqual(['React', 'TypeScript', 'Node.js', 'Docker']);
        });
    });

    it('should parse highlights as newline-separated list', async () => {
        mockOnSubmit.mockResolvedValue(undefined);

        render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

        fireEvent.change(screen.getByLabelText(/Project Name/i), {
            target: { value: 'Test' },
        });
        fireEvent.change(screen.getByLabelText(/Description/i), {
            target: { value: 'Desc' },
        });
        fireEvent.change(screen.getByPlaceholderText(/Enter each feature/i), {
            target: { value: 'Feature 1\nFeature 2\n\nFeature 3' },
        });

        fireEvent.click(screen.getByText('Save Project'));

        await waitFor(() => {
            const submittedData = mockOnSubmit.mock.calls[0][0];
            expect(submittedData.highlights).toEqual(['Feature 1', 'Feature 2', 'Feature 3']);
        });
    });

    it('should call onCancel when cancel button is clicked', () => {
        render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

        fireEvent.click(screen.getByText('Cancel'));

        expect(mockOnCancel).toHaveBeenCalledTimes(1);
        expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should clear error when user corrects invalid field', async () => {
        render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

        // Submit without filling fields to trigger validation
        fireEvent.click(screen.getByText('Save Project'));

        await waitFor(() => {
            expect(screen.getByText(/Project name is required/i)).toBeInTheDocument();
        });

        // Fill in the name field
        fireEvent.change(screen.getByLabelText(/Project Name/i), {
            target: { value: 'My Project' },
        });

        // Error should be cleared
        await waitFor(() => {
            expect(screen.queryByText(/Project name is required/i)).not.toBeInTheDocument();
        });
    });

    it('should show loading state during submission', async () => {
        mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

        render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

        fireEvent.change(screen.getByLabelText(/Project Name/i), {
            target: { value: 'Test' },
        });
        fireEvent.change(screen.getByLabelText(/Description/i), {
            target: { value: 'Desc' },
        });

        fireEvent.click(screen.getByText('Save Project'));

        await waitFor(() => {
            expect(screen.getByText('Saving...')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText('Save Project')).toBeInTheDocument();
        });
    });

    it('should handle dates correctly', async () => {
        mockOnSubmit.mockResolvedValue(undefined);

        render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

        fireEvent.change(screen.getByLabelText(/Project Name/i), {
            target: { value: 'Test' },
        });
        fireEvent.change(screen.getByLabelText(/Description/i), {
            target: { value: 'Desc' },
        });
        fireEvent.change(screen.getByLabelText(/Start Date/i), {
            target: { value: '2023-01-01' },
        });
        fireEvent.change(screen.getByLabelText(/End Date/i), {
            target: { value: '2023-12-31' },
        });

        fireEvent.click(screen.getByText('Save Project'));

        await waitFor(() => {
            const submittedData = mockOnSubmit.mock.calls[0][0];
            expect(submittedData.startDate).toBe('2023-01-01');
            expect(submittedData.endDate).toBe('2023-12-31');
        });
    });

    it('should sanitize dangerous URLs', async () => {
        mockOnSubmit.mockResolvedValue(undefined);

        render(<ProjectForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

        fireEvent.change(screen.getByLabelText(/Project Name/i), {
            target: { value: 'Test' },
        });
        fireEvent.change(screen.getByLabelText(/Description/i), {
            target: { value: 'Desc' },
        });
        fireEvent.change(screen.getByLabelText(/Project URL/i), {
            target: { value: 'data:text/html,<script>alert(1)</script>' },
        });

        fireEvent.click(screen.getByText('Save Project'));

        await waitFor(() => {
            expect(screen.getByText(/Invalid URL/i)).toBeInTheDocument();
        });

        expect(mockOnSubmit).not.toHaveBeenCalled();
    });
});