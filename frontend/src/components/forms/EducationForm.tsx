/**
 * Education Form Component
 * Form for adding/editing education entries
 */

'use client';

import { useState } from 'react';
import type { Education } from '@/types';
import { createLogger } from '@/lib/logger';
import { sanitizeEducationData } from '@/lib/sanitization';

const logger = createLogger({ component: 'EducationForm' });

interface EducationFormProps {
    education?: Partial<Education>;
    onSubmit: (data: Partial<Education>) => Promise<void>;
    onCancel: () => void;
}

const DEGREE_TYPES = [
    'High School Diploma',
    'Associate Degree',
    'Bachelor\'s Degree',
    'Master\'s Degree',
    'Doctorate (PhD)',
    'Professional Degree',
    'Certificate',
    'Bootcamp',
    'Other',
];

export default function EducationForm({ education, onSubmit, onCancel }: EducationFormProps) {
    const [formData, setFormData] = useState({
        institution: education?.institution || '',
        degree: education?.degree || '',
        field: education?.field || '',
        startDate: education?.startDate?.split('T')[0] || '',
        endDate: education?.endDate?.split('T')[0] || '',
        gpa: education?.gpa?.toString() || '',
        honors: education?.honors?.join('\n') || '',
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    logger.debug('[EducationForm] Initialized', {
        isEdit: !!education?.id,
        educationId: education?.id
    });

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.institution.trim()) {
            newErrors.institution = 'Institution name is required';
        }
        if (!formData.degree.trim()) {
            newErrors.degree = 'Degree is required';
        }
        if (!formData.field.trim()) {
            newErrors.field = 'Field of study is required';
        }
        if (!formData.startDate) {
            newErrors.startDate = 'Start date is required';
        }
        if (formData.gpa) {
            const gpaNum = parseFloat(formData.gpa);
            if (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 4.0) {
                newErrors.gpa = 'GPA must be between 0 and 4.0';
            }
        }
        if (formData.startDate && formData.endDate) {
            if (new Date(formData.startDate) > new Date(formData.endDate)) {
                newErrors.endDate = 'End date must be after start date';
            }
        }

        setErrors(newErrors);
        const isValid = Object.keys(newErrors).length === 0;
        logger.debug('[EducationForm] Validation result', { isValid, errors: newErrors });
        return isValid;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) {
            logger.warn('[EducationForm] Validation failed', { errors });
            return;
        }

        logger.startOperation('EducationForm:submit');
        setLoading(true);

        try {
            const sanitized = sanitizeEducationData({
                institution: formData.institution.trim(),
                degree: formData.degree,
                field: formData.field.trim(),
                gpa: formData.gpa ? parseFloat(formData.gpa) : undefined,
                honors: formData.honors.split('\n').filter(h => h.trim()),
                startDate: formData.startDate,
                endDate: formData.endDate || undefined,
            });

            const data: Partial<Education> = {
                institution: sanitized.institution,
                degree: sanitized.degree,
                field: sanitized.field,
                startDate: formData.startDate,
                endDate: formData.endDate || undefined,
                gpa: formData.gpa ? sanitized.gpa : undefined,
                honors: sanitized.honors,
            };

            await onSubmit(data);
            logger.endOperation('EducationForm:submit');
        } catch (error) {
            logger.failOperation('EducationForm:submit', error);
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
                <label htmlFor="edu-institution" className="block text-sm font-medium text-gray-700 mb-1">Institution *</label>
                <input
                    id="edu-institution"
                    type="text"
                    value={formData.institution}
                    onChange={(e) => handleChange('institution', e.target.value)}
                    aria-invalid={!!errors.institution}
                    aria-describedby={errors.institution ? 'edu-institution-error' : undefined}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none ${errors.institution ? 'border-red-500' : 'border-gray-300'
                        }`}
                    placeholder="University or School name"
                />
                {errors.institution && <p id="edu-institution-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="assertive">{errors.institution}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="edu-degree" className="block text-sm font-medium text-gray-700 mb-1">Degree *</label>
                    <select
                        id="edu-degree"
                        value={formData.degree}
                        onChange={(e) => handleChange('degree', e.target.value)}
                        aria-invalid={!!errors.degree}
                        aria-describedby={errors.degree ? 'edu-degree-error' : undefined}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none ${errors.degree ? 'border-red-500' : 'border-gray-300'
                            }`}
                    >
                        <option value="">Select degree...</option>
                        {DEGREE_TYPES.map(deg => (
                            <option key={deg} value={deg}>{deg}</option>
                        ))}
                    </select>
                    {errors.degree && <p id="edu-degree-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="assertive">{errors.degree}</p>}
                </div>
                <div>
                    <label htmlFor="edu-field" className="block text-sm font-medium text-gray-700 mb-1">Field of Study *</label>
                    <input
                        id="edu-field"
                        type="text"
                        value={formData.field}
                        onChange={(e) => handleChange('field', e.target.value)}
                        aria-invalid={!!errors.field}
                        aria-describedby={errors.field ? 'edu-field-error' : undefined}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none ${errors.field ? 'border-red-500' : 'border-gray-300'
                            }`}
                        placeholder="e.g., Computer Science"
                    />
                    {errors.field && <p id="edu-field-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="assertive">{errors.field}</p>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="edu-start-date" className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                    <input
                        id="edu-start-date"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => handleChange('startDate', e.target.value)}
                        aria-invalid={!!errors.startDate}
                        aria-describedby={errors.startDate ? 'edu-start-date-error' : undefined}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none ${errors.startDate ? 'border-red-500' : 'border-gray-300'
                            }`}
                    />
                    {errors.startDate && <p id="edu-start-date-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="assertive">{errors.startDate}</p>}
                </div>
                <div>
                    <label htmlFor="edu-end-date" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                        id="edu-end-date"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => handleChange('endDate', e.target.value)}
                        aria-invalid={!!errors.endDate}
                        aria-describedby={errors.endDate ? 'edu-end-date-error' : 'edu-end-date-help'}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none ${errors.endDate ? 'border-red-500' : 'border-gray-300'
                            }`}
                    />
                    {errors.endDate && <p id="edu-end-date-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="assertive">{errors.endDate}</p>}
                    <p id="edu-end-date-help" className="mt-1 text-xs text-gray-600">Leave empty if currently enrolled</p>
                </div>
            </div>

            <div>
                <label htmlFor="edu-gpa" className="block text-sm font-medium text-gray-700 mb-1">GPA</label>
                <input
                    id="edu-gpa"
                    type="number"
                    min="0"
                    max="4.0"
                    step="0.01"
                    value={formData.gpa}
                    onChange={(e) => handleChange('gpa', e.target.value)}
                    aria-invalid={!!errors.gpa}
                    aria-describedby={errors.gpa ? 'edu-gpa-error' : undefined}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none ${errors.gpa ? 'border-red-500' : 'border-gray-300'
                        }`}
                    placeholder="e.g., 3.8"
                />
                {errors.gpa && <p id="edu-gpa-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="assertive">{errors.gpa}</p>}
            </div>

            <div>
                <label htmlFor="edu-honors" className="block text-sm font-medium text-gray-700 mb-1">Honors & Awards</label>
                <textarea
                    id="edu-honors"
                    value={formData.honors}
                    onChange={(e) => handleChange('honors', e.target.value)}
                    rows={3}
                    aria-describedby="edu-honors-help"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    placeholder="Dean's List, Summa Cum Laude, etc."
                />
                <p id="edu-honors-help" className="mt-1 text-xs text-gray-600">One honor per line</p>
            </div>

            <div className="flex gap-3 pt-4">
                <button
                    type="button"
                    onClick={() => {
                        logger.debug('[EducationForm] Cancel clicked');
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
                    {loading ? 'Saving...' : 'Save Education'}
                </button>
            </div>
        </form>
    );
}
