/**
 * Profile Edit Form Component
 * Form for editing basic profile information
 */

'use client';

import { useState } from 'react';
import { createLogger } from '@/lib/logger';

const logger = createLogger({ component: 'ProfileEditForm' });

interface ProfileData {
    name: string;
    image?: string;
}

interface ProfileEditFormProps {
    currentName?: string;
    currentImage?: string;
    onSubmit: (data: ProfileData) => Promise<void>;
    onCancel: () => void;
}

export default function ProfileEditForm({ currentName, currentImage, onSubmit, onCancel }: ProfileEditFormProps) {
    const [formData, setFormData] = useState<ProfileData>({
        name: currentName || '',
        image: currentImage || '',
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    logger.debug('[ProfileEditForm] Initialized', {
        hasCurrentName: !!currentName,
        hasCurrentImage: !!currentImage
    });

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Name is required';
        }
        if (formData.image && !formData.image.match(/^https?:\/\/.+/)) {
            newErrors.image = 'Please enter a valid URL starting with http:// or https://';
        }

        setErrors(newErrors);
        const isValid = Object.keys(newErrors).length === 0;
        logger.debug('[ProfileEditForm] Validation result', { isValid, errors: newErrors });
        return isValid;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) {
            logger.warn('[ProfileEditForm] Validation failed', { errors });
            return;
        }

        logger.startOperation('ProfileEditForm:submit');
        setLoading(true);

        try {
            await onSubmit({
                name: formData.name.trim(),
                image: (formData.image ?? '').trim() || undefined,
            });
            logger.endOperation('ProfileEditForm:submit');
        } catch (error) {
            logger.failOperation('ProfileEditForm:submit', error);
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
                <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                    id="profile-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? 'profile-name-error' : undefined}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none ${errors.name ? 'border-red-500' : 'border-gray-300'
                        }`}
                    placeholder="John Doe"
                />
                {errors.name && <p id="profile-name-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="assertive">{errors.name}</p>}
            </div>

            <div>
                <label htmlFor="profile-image" className="block text-sm font-medium text-gray-700 mb-1">Profile Image URL</label>
                <input
                    id="profile-image"
                    type="text"
                    value={formData.image}
                    onChange={(e) => handleChange('image', e.target.value)}
                    aria-invalid={!!errors.image}
                    aria-describedby={errors.image ? 'profile-image-error' : 'profile-image-help'}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none ${errors.image ? 'border-red-500' : 'border-gray-300'
                        }`}
                    placeholder="https://example.com/your-photo.jpg"
                />
                {errors.image && <p id="profile-image-error" className="mt-1 text-sm text-red-600" role="alert" aria-live="assertive">{errors.image}</p>}
                <p id="profile-image-help" className="mt-1 text-xs text-gray-600">Enter a URL to your profile photo</p>
            </div>

            {formData.image && !errors.image && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={formData.image}
                        alt="Preview"
                        className="w-12 h-12 rounded-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                    <span className="text-sm text-gray-600">Image preview</span>
                </div>
            )}

            <div className="flex gap-3 pt-4">
                <button
                    type="button"
                    onClick={() => {
                        logger.debug('[ProfileEditForm] Cancel clicked');
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
                    {loading ? 'Saving...' : 'Save Profile'}
                </button>
            </div>
        </form>
    );
}
