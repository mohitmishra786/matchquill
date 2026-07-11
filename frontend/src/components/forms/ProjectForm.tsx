/**
 * Project Form Component
 * Form for adding/editing projects
 */

'use client';

import { useState } from 'react';
import type { Project } from '@/types';
import { createLogger } from '@/lib/logger';
import { sanitizeUrl, sanitizeProjectData } from '@/lib/sanitization';

const logger = createLogger({ component: 'ProjectForm' });

interface ProjectFormProps {
    project?: Partial<Project>;
    onSubmit: (data: Partial<Project>) => Promise<void>;
    onCancel: () => void;
}

export default function ProjectForm({ project, onSubmit, onCancel }: ProjectFormProps) {
    const [formData, setFormData] = useState({
        name: project?.name || '',
        description: project?.description || '',
        url: project?.url || '',
        startDate: project?.startDate?.split('T')[0] || '',
        endDate: project?.endDate?.split('T')[0] || '',
        technologies: project?.technologies?.join(', ') || '',
        highlights: project?.highlights?.join('\n') || '',
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    logger.debug('[ProjectForm] Initialized', {
        isEdit: !!project?.id,
        projectId: project?.id
    });

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Project name is required';
        }
        if (!formData.description.trim()) {
            newErrors.description = 'Description is required';
        }
        if (formData.url) {
            // Use sanitizeUrl to validate URL and block dangerous protocols
            const sanitizedUrl = sanitizeUrl(formData.url);
            if (sanitizedUrl === null) {
                newErrors.url = 'Invalid URL. URLs must start with http:// or https://';
            } else if (!sanitizedUrl.match(/^https?:\/\/.+/)) {
                newErrors.url = 'Please enter a valid URL starting with http:// or https://';
            }
        }

        setErrors(newErrors);
        const isValid = Object.keys(newErrors).length === 0;
        logger.debug('[ProjectForm] Validation result', { isValid, errors: newErrors });
        return isValid;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) {
            logger.warn('[ProjectForm] Validation failed', { errors });
            return;
        }

        logger.startOperation('ProjectForm:submit');
        setLoading(true);

        try {
            const sanitized = sanitizeProjectData({
                name: formData.name,
                description: formData.description,
                url: formData.url,
                technologies: formData.technologies.split(',').map(t => t.trim()).filter(Boolean),
                highlights: formData.highlights.split('\n').filter(h => h.trim()),
                startDate: formData.startDate || undefined,
                endDate: formData.endDate || undefined,
            });

            const data: Partial<Project> = {
                name: sanitized.name,
                description: sanitized.description,
                technologies: sanitized.technologies,
                highlights: sanitized.highlights,
                startDate: (sanitized.startDate as string) || undefined,
                endDate: (sanitized.endDate as string) || undefined,
                url: sanitized.url,
            };

            await onSubmit(data);
            logger.endOperation('ProjectForm:submit');
        } catch (error) {
            logger.failOperation('ProjectForm:submit', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
                <label htmlFor="proj-name" className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                <input
                    id="proj-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? 'proj-name-error' : undefined}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none ${errors.name ? 'border-red-500' : 'border-gray-300'
                        }`}
                    placeholder="My Awesome Project"
                />
                {errors.name && <p id="proj-name-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="assertive">{errors.name}</p>}
            </div>

            <div>
                <label htmlFor="proj-description" className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                    id="proj-description"
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={3}
                    aria-invalid={!!errors.description}
                    aria-describedby={errors.description ? 'proj-description-error' : undefined}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none ${errors.description ? 'border-red-500' : 'border-gray-300'
                        }`}
                    placeholder="Brief description of the project"
                />
                {errors.description && <p id="proj-description-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="assertive">{errors.description}</p>}
            </div>

            <div>
                <label htmlFor="proj-url" className="block text-sm font-medium text-gray-700 mb-1">Project URL</label>
                <input
                    id="proj-url"
                    type="text"
                    value={formData.url}
                    onChange={(e) => handleChange('url', e.target.value)}
                    aria-invalid={!!errors.url}
                    aria-describedby={errors.url ? 'proj-url-error' : undefined}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none ${errors.url ? 'border-red-500' : 'border-gray-300'
                        }`}
                    placeholder="https://github.com/username/project"
                />
                {errors.url && <p id="proj-url-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="assertive">{errors.url}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="proj-start-date" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                        id="proj-start-date"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => handleChange('startDate', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
                <div>
                    <label htmlFor="proj-end-date" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                        id="proj-end-date"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => handleChange('endDate', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="proj-technologies" className="block text-sm font-medium text-gray-700 mb-1">Technologies</label>
                <input
                    id="proj-technologies"
                    type="text"
                    value={formData.technologies}
                    onChange={(e) => handleChange('technologies', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="React, TypeScript, Node.js (comma separated)"
                />
            </div>

            <div>
                <label htmlFor="proj-highlights" className="block text-sm font-medium text-gray-700 mb-1">Key Features / Highlights</label>
                <textarea
                    id="proj-highlights"
                    value={formData.highlights}
                    onChange={(e) => handleChange('highlights', e.target.value)}
                    rows={4}
                    aria-describedby="proj-highlights-help"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    placeholder="Enter each feature on a new line"
                />
                <p id="proj-highlights-help" className="mt-1 text-xs text-gray-600">One feature per line.</p>
            </div>

            <div className="flex gap-3 pt-4">
                <button
                    type="button"
                    onClick={() => {
                        logger.debug('[ProjectForm] Cancel clicked');
                        onCancel();
                    }}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50"
                >
                    {loading ? 'Saving...' : 'Save Project'}
                </button>
            </div>
        </form>
    );
}
