'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { createLogger } from '@/lib/logger';
import { useToast } from '@/components/ui/ToastProvider';
import { useSession } from 'next-auth/react';
import { generateBackendToken } from '@/lib/jwt';
import { sanitizeRichText, sanitizeText } from '@/lib/sanitization';

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
        <div className="min-h-screen bg-gray-50 pb-20">
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Image src="/logo.png" alt="CV-Wiz" width={32} height={32} className="rounded-lg" />
                        <h1 className="text-xl font-bold text-gray-900">AI Interview Prep</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-indigo-100">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Prepare for your next interview</h2>
                    <p className="text-gray-600 mb-6 text-sm">
                        Our AI analyzes your profile and the job description to generate the most likely interview questions you&apos;ll face.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Job Description (Optional)
                            </label>
                            <textarea
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm"
                                placeholder="Paste the job description here for better results..."
                            />
                        </div>
                        <button
                            onClick={generateQuestions}
                            disabled={loading || !candidateInfo}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-700 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Analyzing Profile & Generating...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-lg text-sm">5</span>
                            Customized Questions
                        </h2>
                        {questions.map((q, i) => (
                            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6">
                                    <h3 className="font-bold text-gray-900 text-lg mb-4">Q: {q.question}</h3>

                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">Suggested Answer Strategy</h4>
                                            <p className="text-gray-700 text-sm leading-relaxed bg-gray-50 p-4 rounded-xl italic">
                                                &ldquo;{q.suggested_answer}&rdquo;
                                            </p>
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">Key Points to Emphasize</h4>
                                            <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                {q.key_points.map((point, j) => (
                                                    <li key={j} className="flex items-start gap-2 text-xs font-medium text-gray-600 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                                                        <svg className="w-4 h-4 text-emerald-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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