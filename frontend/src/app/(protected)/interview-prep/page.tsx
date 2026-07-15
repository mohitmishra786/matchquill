'use client';

import { useState, useEffect } from 'react';
import { createLogger } from '@/lib/logger';
import { useToast } from '@/components/ui/ToastProvider';
import { useSession } from 'next-auth/react';
import { generateBackendToken } from '@/lib/jwt';
import { sanitizeRichText, sanitizeText } from '@/lib/sanitization';
import { BrandMark } from '@/components/ui/BrandLogo';

const logger = createLogger({ component: 'InterviewPrepPage' });

interface Question {
    question: string;
    suggested_answer: string;
    key_points: string[];
}

interface Experience {
    title: string;
    company: string;
}

interface Skill {
    name: string;
}

export default function InterviewPrepPage() {
    const { error: toastError } = useToast();
    const { data: session } = useSession();
    const [jobDescription, setJobDescription] = useState('');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(false);
    const [candidateInfo, setCandidateInfo] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch('/api/profile');
                if (res.ok) {
                    const data = await res.json();
                    const info = `
Name: ${data.name}
Experience: ${data.experiences?.map((e: Experience) => `${e.title} at ${e.company}`).join(', ')}
Skills: ${data.skills?.map((s: Skill) => s.name).join(', ')}
`;
                    setCandidateInfo(info);
                }
            } catch (err) {
                logger.error('Failed to fetch profile for prep', { err });
            }
        };
        fetchProfile();
    }, []);

    const generateQuestions = async () => {
        setLoading(true);
        try {
            if (!session?.user?.id) {
                throw new Error('Not authenticated');
            }

            const backendToken = await generateBackendToken(session.user.id, session.user.email || undefined);

            const sanitizedJD = jobDescription.trim()
                ? sanitizeRichText(jobDescription)
                : undefined;

            const res = await fetch('/api/ai/interview-prep', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${backendToken}`,
                },
                body: JSON.stringify({
                    candidate_info: sanitizeText(candidateInfo),
                    job_description: sanitizedJD || undefined,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setQuestions(data.questions);
            } else {
                throw new Error(data.detail || 'Failed to generate questions');
            }
        } catch (err) {
            toastError('Failed to generate interview questions. Please try again.');
            logger.error('Interview prep error', { err });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen pb-20" style={{ background: 'var(--background)' }}>
            <header className="border-b sticky top-0 z-10" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BrandMark size={32} title="MatchQuill" className="rounded-lg" />
                        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-display)' }}>AI Interview Prep</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="rounded-2xl border p-6 mb-8" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--foreground)' }}>Prepare for your next interview</h2>
                    <p className="mb-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Our AI analyzes your profile and the job description to generate the most likely interview questions you&apos;ll face.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="job-description" className="block text-sm font-semibold mb-2" style={{ color: 'var(--foreground-secondary)' }}>
                                Job Description (Optional)
                            </label>
                            <textarea
                                id="job-description"
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 resize-none text-sm"
                                style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
                                placeholder="Paste the job description here for better results..."
                            />
                        </div>
                        <button
                            onClick={generateQuestions}
                            disabled={loading || !candidateInfo}
                            className="w-full py-3.5 min-h-[44px] font-semibold rounded-xl transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--primary-foreground)', borderTopColor: 'transparent' }} />
                                    Analyzing Profile & Generating...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    Generate Interview Prep
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {questions.length > 0 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                            <span
                                className="px-3 py-1 rounded-lg text-sm font-semibold"
                                style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)' }}
                            >
                                {questions.length}
                            </span>
                            Customized Questions
                        </h2>
                        {questions.map((q, i) => (
                            <div key={i} className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                                <div className="p-6">
                                    <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>Q: {q.question}</h3>

                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--primary)' }}>Suggested Answer Strategy</h4>
                                            <p className="text-sm leading-relaxed p-4 rounded-xl italic" style={{ color: 'var(--foreground-secondary)', background: 'var(--muted)' }}>
                                                &ldquo;{q.suggested_answer}&rdquo;
                                            </p>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--accent-green)' }}>Key Points to Emphasize</h4>
                                            <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                {q.key_points.map((point, j) => (
                                                    <li
                                                        key={j}
                                                        className="flex items-start gap-2 text-xs font-medium p-2 rounded-lg border"
                                                        style={{
                                                            color: 'var(--foreground-secondary)',
                                                            background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)',
                                                            borderColor: 'color-mix(in srgb, var(--accent-green) 25%, transparent)',
                                                        }}
                                                    >
                                                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--accent-green)' }} aria-hidden="true">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        {point}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}