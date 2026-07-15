'use client';

import { useEffect, useState, use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Briefcase, FolderKanban, GraduationCap, ShieldAlert, Sparkles, User, Zap } from 'lucide-react';
import { UserProfile } from '@/types';

export default function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
    // Unwrap params using React.use()
    const { id } = use(params);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch(`/api/public/profile/${id}`);
                if (res.status === 404) throw new Error('Profile not found');
                if (res.status === 403) throw new Error('This profile is private');
                if (!res.ok) throw new Error('Failed to load profile');

                const data = await res.json();
                setProfile(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
                <div
                    className="animate-spin rounded-full h-10 w-10 border-2"
                    style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }}
                    role="status"
                    aria-label="Loading profile"
                />
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'var(--background)' }}>
                <div
                    className="p-1.5 rounded-[2rem] max-w-md w-full"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                    <div className="rounded-[calc(2rem-0.375rem)] p-8 text-center">
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                            style={{ background: 'var(--muted)' }}
                        >
                            <ShieldAlert size={26} strokeWidth={1.75} style={{ color: 'var(--muted-foreground)' }} />
                        </div>
                        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-display)' }}>
                            {error === 'This profile is private'
                                ? 'Private profile'
                                : error === 'Profile not found'
                                    ? 'Profile not found'
                                    : 'Something went wrong'}
                        </h1>
                        <p style={{ color: 'var(--muted-foreground)' }}>
                            {error === 'This profile is private'
                                ? 'The user has restricted access to this profile.'
                                : error === 'Profile not found'
                                    ? 'This profile does not exist or has been removed.'
                                    : 'We could not load this profile right now. Please try again.'}
                        </p>
                        {error !== 'This profile is private' && error !== 'Profile not found' && (
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="mt-6 inline-flex items-center justify-center px-6 py-3 min-h-[44px] font-semibold rounded-full transition-all hover:opacity-90"
                                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                            >
                                Try again
                            </button>
                        )}
                        <Link
                            href="/"
                            className="mt-3 inline-flex items-center justify-center px-6 py-3 min-h-[44px] font-semibold rounded-full transition-all hover:opacity-80"
                            style={{ color: 'var(--foreground-secondary)' }}
                        >
                            Go home
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--background)' }}>
            <div className="max-w-4xl mx-auto">
                {/* Header Card */}
                <div
                    className="p-1.5 rounded-[2rem] mb-6"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                    <div className="rounded-[calc(2rem-0.375rem)] overflow-hidden" style={{ background: 'var(--card)' }}>
                        <div className="h-32" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent-purple) 100%)' }} />
                        <div className="px-8 pb-8">
                            <div className="relative -mt-16 mb-4">
                                <div
                                    className="w-32 h-32 rounded-full border-4 overflow-hidden shadow-md"
                                    style={{ borderColor: 'var(--card)', background: 'var(--card)' }}
                                >
                                    {profile.image ? (
                                        <Image
                                            src={profile.image}
                                            alt={profile.name || 'Profile'}
                                            width={128}
                                            height={128}
                                            className="object-cover w-full h-full"
                                        />
                                    ) : (
                                        <div
                                            className="w-full h-full flex items-center justify-center text-4xl font-bold"
                                            style={{ background: 'var(--muted)', color: 'var(--primary)' }}
                                        >
                                            {profile.name?.trim()
                                                ? profile.name.trim()[0].toUpperCase()
                                                : <User size={40} strokeWidth={1.75} aria-hidden="true" />}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-display)' }}>
                                {profile.name}
                            </h1>
                            <p className="mt-1" style={{ color: 'var(--muted-foreground)' }}>
                                MatchQuill Profile
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Experience */}
                        {profile.experiences?.length > 0 && (
                            <div
                                className="p-1.5 rounded-[2rem]"
                                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                            >
                                <div className="rounded-[calc(2rem-0.375rem)] p-6">
                                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                                        <Briefcase size={20} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                                        Experience
                                    </h2>
                                    <div className="space-y-8">
                                        {profile.experiences.map((exp, i) => (
                                            <div
                                                key={exp.id || i}
                                                className="relative pl-8 border-l-2 last:pb-0"
                                                style={{ borderColor: 'var(--border)' }}
                                            >
                                                <div
                                                    className="absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2"
                                                    style={{ background: 'var(--muted)', borderColor: 'var(--primary)' }}
                                                />
                                                <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                                                    {exp.title}
                                                </h3>
                                                <div className="font-medium mb-1" style={{ color: 'var(--primary)' }}>
                                                    {exp.company}
                                                </div>
                                                <div className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
                                                    {new Date(exp.startDate).getFullYear()}
                                                    {exp.current
                                                        ? ' - Present'
                                                        : exp.endDate ? ` - ${new Date(exp.endDate).getFullYear()}` : ''}
                                                </div>
                                                {exp.description && (
                                                    <p className="text-sm whitespace-pre-line" style={{ color: 'var(--foreground-secondary)' }}>
                                                        {exp.description}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Projects */}
                        {profile.projects?.length > 0 && (
                            <div
                                className="p-1.5 rounded-[2rem]"
                                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                            >
                                <div className="rounded-[calc(2rem-0.375rem)] p-6">
                                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                                        <FolderKanban size={20} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                                        Projects
                                    </h2>
                                    <div className="grid gap-4">
                                        {profile.projects.map((proj, i) => (
                                            <div
                                                key={proj.id || i}
                                                className="rounded-xl p-4 border transition-colors"
                                                style={{ borderColor: 'var(--border)' }}
                                            >
                                                <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                                                    {proj.name}
                                                </h3>
                                                <p className="text-sm mt-2 line-clamp-3" style={{ color: 'var(--foreground-secondary)' }}>
                                                    {proj.description}
                                                </p>
                                                {proj.technologies && proj.technologies.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-3">
                                                        {proj.technologies.map((tech, j) => (
                                                            <span
                                                                key={j}
                                                                className="px-2 py-1 text-xs rounded-md"
                                                                style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                                                            >
                                                                {tech}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Skills */}
                        {profile.skills?.length > 0 && (
                            <div
                                className="p-1.5 rounded-[2rem]"
                                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                            >
                                <div className="rounded-[calc(2rem-0.375rem)] p-6">
                                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                                        <Zap size={20} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                                        Skills
                                    </h2>
                                    <div className="flex flex-wrap gap-2">
                                        {profile.skills.map((skill, i) => (
                                            <span
                                                key={skill.id || i}
                                                className="px-3 py-1.5 text-sm rounded-full font-medium"
                                                style={{ background: 'var(--muted)', color: 'var(--primary)' }}
                                            >
                                                {skill.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Education */}
                        {profile.educations?.length > 0 && (
                            <div
                                className="p-1.5 rounded-[2rem]"
                                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                            >
                                <div className="rounded-[calc(2rem-0.375rem)] p-6">
                                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                                        <GraduationCap size={20} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                                        Education
                                    </h2>
                                    <div className="space-y-6">
                                        {profile.educations.map((edu, i) => (
                                            <div key={edu.id || i}>
                                                <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                                                    {edu.institution}
                                                </h3>
                                                <div className="text-sm" style={{ color: 'var(--primary)' }}>
                                                    {edu.degree} in {edu.field}
                                                </div>
                                                <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                                                    {new Date(edu.startDate).getFullYear()} -{' '}
                                                    {edu.endDate ? new Date(edu.endDate).getFullYear() : 'Present'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="text-center">
                            <Link
                                href="/"
                                className="inline-flex items-center gap-2 text-sm transition-colors hover:opacity-80"
                                style={{ color: 'var(--muted-foreground)' }}
                            >
                                <Sparkles size={16} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                                Powered by MatchQuill
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
