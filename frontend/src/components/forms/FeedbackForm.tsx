'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { sanitizeFeedbackData } from '@/lib/sanitization';

export default function FeedbackForm() {
    const [rating, setRating] = useState<number>(5);
    const [comment, setComment] = useState<string>('');
    const [category, setCategory] = useState<string>('General');
    const [loading, setLoading] = useState<boolean>(false);
    const { success, error } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const sanitized = sanitizeFeedbackData({ rating, comment, category });
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sanitized),
            });
            if (res.ok) {
                success('Thank you for your feedback!');
                setComment('');
                setRating(5);
            } else {
                throw new Error('Failed to submit feedback');
            }
        } catch {
            error('Failed to submit feedback. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900">Send us feedback</h3>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border-gray-200 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                    <option>General</option>
                    <option>UI/UX</option>
                    <option>AI Suggestions</option>
                    <option>Bug Report</option>
                    <option>Feature Request</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                                rating >= star ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
                            }`}
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Comment</label>
                <textarea
                    required
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border-gray-200 text-sm focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                    placeholder="Tell us what you think..."
                />
            </div>
            <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
                {loading ? 'Submitting...' : 'Submit Feedback'}
            </button>
        </form>
    );
}