'use client';

/**
 * Templates Page
 * Resume template selection with previews
 */

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import TemplatePreview from '@/components/templates/TemplatePreview';
import { useToast } from '@/components/ui/ToastProvider';
import TemplatesSkeleton from '@/components/skeletons/TemplatesSkeleton';
import { createLogger } from '@/lib/logger';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';

const logger = createLogger({ component: 'TemplatesPage' });

const TEMPLATES = [
    {
        id: 'experience-skills-projects',
        name: 'Professional',
        description: 'Best for experienced professionals. Emphasizes work history and technical skills with selected projects.',
        sections: ['Experience', 'Skills', 'Projects', 'Education'],
        color: 'from-blue-500 to-indigo-600',
        category: 'Professional',
        bestFor: ['Executives', 'Managers', 'Senior Professionals'],
    },
    {
        id: 'education-research-skills',
        name: 'Academic',
        description: 'Ideal for academics, researchers, and recent graduates. Highlights education, publications, and research.',
        sections: ['Education', 'Publications', 'Research', 'Experience', 'Skills'],
        color: 'from-emerald-500 to-teal-600',
        category: 'Academic',
        bestFor: ['Professors', 'Researchers', 'PhD Candidates', 'Recent Graduates'],
    },
    {
        id: 'projects-skills-experience',
        name: 'Developer',
        description: 'Great for developers and makers. Leads with project portfolio and technical skills.',
        sections: ['Projects', 'Skills', 'Technologies', 'Experience', 'Education'],
        color: 'from-purple-500 to-pink-600',
        category: 'Technical',
        bestFor: ['Software Engineers', 'Web Developers', 'Freelancers'],
    },
    {
        id: 'compact-technical',
        name: 'Technical',
        description: 'Maximizes technical skill visibility. Compact layout for roles requiring specific expertise.',
        sections: ['Skills', 'Technologies', 'Experience', 'Projects', 'Certifications'],
        color: 'from-orange-500 to-red-600',
        category: 'Technical',
        bestFor: ['Data Scientists', 'DevOps Engineers', 'Cybersecurity Specialists'],
    },
    {
        id: 'creative-portfolio',
        name: 'Creative',
        description: 'Showcase your creative work with visual emphasis. Perfect for designers and artists.',
        sections: ['Portfolio', 'Skills', 'Experience', 'Education', 'Awards'],
        color: 'from-rose-500 to-pink-600',
        category: 'Creative',
        bestFor: ['Designers', 'Artists', 'Creative Directors', 'Marketing Professionals'],
    },
    {
        id: 'executive-leadership',
        name: 'Executive',
        description: 'Highlight leadership achievements and strategic impact. Board-ready format.',
        sections: ['Leadership Summary', 'Board Experience', 'Career Highlights', 'Education', 'Awards'],
        color: 'from-slate-600 to-slate-800',
        category: 'Professional',
        bestFor: ['CEOs', 'CFOs', 'Board Members', 'Senior Executives'],
    },
    {
        id: 'healthcare-medical',
        name: 'Healthcare',
        description: 'Specialized format for medical professionals with emphasis on certifications and clinical experience.',
        sections: ['Certifications', 'Clinical Experience', 'Education', 'Research', 'Skills'],
        color: 'from-cyan-500 to-blue-600',
        category: 'Professional',
        bestFor: ['Doctors', 'Nurses', 'Medical Researchers', 'Healthcare Administrators'],
    },
    {
        id: 'finance-analyst',
        name: 'Finance',
        description: 'Quantitative focus with emphasis on financial achievements and analytical skills.',
        sections: ['Financial Summary', 'Professional Experience', 'Education', 'Certifications', 'Skills'],
        color: 'from-green-500 to-emerald-600',
        category: 'Professional',
        bestFor: ['Financial Analysts', 'Accountants', 'Investment Bankers', 'CFOs'],
    },
    {
        id: 'minimalist-modern',
        name: 'Minimalist',
        description: 'Clean, modern design with maximum readability. ATS-friendly layout.',
        sections: ['Experience', 'Skills', 'Education', 'Projects'],
        color: 'from-gray-600 to-gray-800',
        category: 'Modern',
        bestFor: ['All Professionals', 'Career Changers', 'Recent Graduates'],
    },
    {
        id: 'international-multilingual',
        name: 'International',
        description: 'Multilingual support with international format standards. Ideal for global job seekers.',
        sections: ['Professional Summary', 'International Experience', 'Education', 'Languages', 'Skills'],
        color: 'from-indigo-500 to-purple-600',
        category: 'Global',
        bestFor: ['Expatriates', 'International Professionals', 'Multilingual Candidates'],
    },
];

export default function TemplatesPage() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data: session, status } = useSession();
    const { success, error: toastError } = useToast();
    const [selectedTemplate, setSelectedTemplate] = useState('experience-skills-projects');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebouncedValue(searchQuery, 250);

    useEffect(() => {
        // Load current setting
        setLoading(true);
        fetch('/api/profile/settings')
            .then((res) => res.json())
            .then((data) => {
                if (data.selectedTemplate) {
                    setSelectedTemplate(data.selectedTemplate);
                }
            })
            .catch((err) => {
                logger.error('Failed to load settings', { err });
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch('/api/profile/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ selectedTemplate }),
            });
            success('Template preference saved successfully');
        } catch (error) {
            logger.error('Failed to save template', { error });
            toastError('Failed to save template preference');
        } finally {
            setSaving(false);
        }
    };

    const filteredTemplates = useMemo(() => {
        const q = debouncedSearch.toLowerCase();
        return TEMPLATES.filter((template) => {
            const matchesSearch =
                !q ||
                template.name.toLowerCase().includes(q) ||
                template.description.toLowerCase().includes(q) ||
                template.bestFor?.some((role) => role.toLowerCase().includes(q));

            const matchesCategory = filterCategory === 'All' || template.category === filterCategory;

            return matchesSearch && matchesCategory;
        });
    }, [debouncedSearch, filterCategory]);

    if (status === 'loading' || loading) {
        return <TemplatesSkeleton />;
    }

    return (
        <div className="min-h-screen" style={{ background: 'var(--background)' }}>
            {/* Using global Navbar - no duplicate header */}
            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-4 py-8">
                {/* Save button moved to top of content */}
                <div className="flex justify-end mb-6">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 sm:px-5 sm:py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 text-sm sm:text-base"
                    >
                        {saving ? 'Saving...' : 'Save Selection'}
                    </button>
                </div>
                <div className="text-center mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Choose Your Template</h1>
                    <p className="text-gray-600 mt-2 text-sm sm:text-base">
                        Select the resume layout that best highlights your strengths
                    </p>
                </div>

                {/* Filter Controls */}
                <div className="mb-6 bg-white rounded-xl shadow-sm p-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <div className="flex-1 w-full">
                            <label htmlFor="template-search" className="sr-only">Search templates</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    id="template-search"
                                    type="text"
                                    placeholder="Search templates..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="All">All Categories</option>
                                <option value="Professional">Professional</option>
                                <option value="Academic">Academic</option>
                                <option value="Technical">Technical</option>
                                <option value="Creative">Creative</option>
                                <option value="Modern">Modern</option>
                                <option value="Global">Global</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                    {filteredTemplates.length > 0 ? (
                        filteredTemplates.map((template) => (
                            <TemplatePreview
                                key={template.id}
                                {...template}
                                selected={selectedTemplate === template.id}
                                onSelect={setSelectedTemplate}
                            />
                        ))
                    ) : (
                        <div className="col-span-2 text-center py-12">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-1">No templates found</h3>
                            <p className="text-gray-500">Try adjusting your search or filter to find what you&apos;re looking for.</p>
                        </div>
                    )}
                </div>

                {/* Preview Section */}
                <div className="mt-12 bg-white rounded-2xl shadow-sm p-8 text-center">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        {TEMPLATES.find((t) => t.id === selectedTemplate)?.name} Template Selected
                    </h2>
                    <p className="text-gray-600 mb-6">
                        This template will be used when generating resumes from the browser extension
                    </p>
                    <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Install the CV-Wiz browser extension to generate tailored resumes
                    </div>
                </div>
            </main>
        </div>
    );
}
