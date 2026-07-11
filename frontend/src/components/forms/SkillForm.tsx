/**
 * Skill Form Component
 * Form for adding/editing skills
 */

'use client';

import { useState } from 'react';
import type { Skill } from '@/types';
import { createLogger } from '@/lib/logger';
import { sanitizeSkillData } from '@/lib/sanitization';

const logger = createLogger({ component: 'SkillForm' });

interface SkillFormProps {
    skill?: Partial<Skill>;
    onSubmit: (data: Partial<Skill>) => Promise<void>;
    onCancel: () => void;
}

const SKILL_CATEGORIES = [
    'Programming Languages',
    'Frameworks & Libraries',
    'Databases',
    'Cloud & DevOps',
    'Tools & Software',
    'Soft Skills',
    'Languages',
    'Other',
];

const PROFICIENCY_LEVELS = [
    'Beginner',
    'Intermediate',
    'Advanced',
    'Expert',
];

export default function SkillForm({ skill, onSubmit, onCancel }: SkillFormProps) {
    const [formData, setFormData] = useState<{ name: string; category: string; proficiency: string; yearsExp: string }>({
        name: skill?.name || '',
        category: skill?.category || 'Programming Languages',
        proficiency: skill?.proficiency || '',
        yearsExp: skill?.yearsExp?.toString() || '',
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    logger.debug('[SkillForm] Initialized', {
        isEdit: !!skill?.id,
        skillId: skill?.id
    });

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Skill name is required';
        }
        if (!formData.category) {
            newErrors.category = 'Category is required';
        }
        if (formData.yearsExp && (isNaN(Number(formData.yearsExp)) || Number(formData.yearsExp) < 0)) {
            newErrors.yearsExp = 'Please enter a valid number of years';
        }

        setErrors(newErrors);
        const isValid = Object.keys(newErrors).length === 0;
        logger.debug('[SkillForm] Validation result', { isValid, errors: newErrors });
        return isValid;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) {
            logger.warn('[SkillForm] Validation failed', { errors });
            return;
        }

        logger.startOperation('SkillForm:submit');
        setLoading(true);

        try {
            const sanitized = sanitizeSkillData({
                name: formData.name.trim(),
                category: formData.category,
                proficiency: formData.proficiency || undefined,
                yearsExp: formData.yearsExp ? Number(formData.yearsExp) : undefined,
            });

            const data: Partial<Skill> = {
                name: sanitized.name,
                category: sanitized.category,
                proficiency: sanitized.proficiency || undefined,
                yearsExp: formData.yearsExp ? sanitized.yearsExp : undefined,
            };

            await onSubmit(data);
            logger.endOperation('SkillForm:submit');
        } catch (error) {
            logger.failOperation('SkillForm:submit', error);
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
                <label htmlFor="skill-name" className="block text-sm font-medium text-gray-700 mb-1">Skill Name *</label>
                <input
                    id="skill-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? 'skill-name-error' : undefined}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none ${errors.name ? 'border-red-500' : 'border-gray-300'
                        }`}
                    placeholder="e.g., React, Python, Project Management"
                />
                {errors.name && <p id="skill-name-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="assertive">{errors.name}</p>}
            </div>

            <div>
                <label htmlFor="skill-category" className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                    id="skill-category"
                    value={formData.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    aria-invalid={!!errors.category}
                    aria-describedby={errors.category ? 'skill-category-error' : undefined}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none ${errors.category ? 'border-red-500' : 'border-gray-300'
                        }`}
                >
                    {SKILL_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
                {errors.category && <p id="skill-category-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="assertive">{errors.category}</p>}
            </div>

            <div>
                <label htmlFor="skill-proficiency" className="block text-sm font-medium text-gray-700 mb-1">Proficiency Level</label>
                <select
                    id="skill-proficiency"
                    value={formData.proficiency}
                    onChange={(e) => handleChange('proficiency', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    <option value="">Select proficiency...</option>
                    {PROFICIENCY_LEVELS.map(level => (
                        <option key={level} value={level}>{level}</option>
                    ))}
                </select>
            </div>

            <div>
                <label htmlFor="skill-years" className="block text-sm font-medium text-gray-700 mb-1">Years of Experience</label>
                <input
                    id="skill-years"
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={formData.yearsExp}
                    onChange={(e) => handleChange('yearsExp', e.target.value)}
                    aria-invalid={!!errors.yearsExp}
                    aria-describedby={errors.yearsExp ? 'skill-years-error' : undefined}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none ${errors.yearsExp ? 'border-red-500' : 'border-gray-300'
                        }`}
                    placeholder="e.g., 3"
                />
                {errors.yearsExp && <p id="skill-years-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="assertive">{errors.yearsExp}</p>}
            </div>

            <div className="flex gap-3 pt-4">
                <button
                    type="button"
                    onClick={() => {
                        logger.debug('[SkillForm] Cancel clicked');
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
                    {loading ? 'Saving...' : 'Save Skill'}
                </button>
            </div>
        </form>
    );
}
