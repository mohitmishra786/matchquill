/**
 * AI Interview Prep API Route
 * POST /api/ai/interview-prep - Generate interview questions based on profile and job description
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createRequestLogger, getOrCreateRequestId, logAuthOperation } from '@/lib/logger';
import Groq from 'groq-sdk';

/** Lazy Groq client so `next build` succeeds without GROQ_API_KEY at collect time. */
function getGroq(): Groq {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error('GROQ_API_KEY is not set. Configure it before using AI routes.');
    }
    return new Groq({ apiKey });
}

interface InterviewQuestion {
    question: string;
    suggested_answer: string;
    key_points: string[];
}

/**
 * POST /api/ai/interview-prep
 * Generate personalized interview questions using AI
 */
export async function POST(request: NextRequest) {
    const requestId = getOrCreateRequestId(request.headers);
    const logger = createRequestLogger(requestId);

    logger.startOperation('interview-prep:generate');

    try {
        logger.info('Authenticating user for interview prep', { requestId });
        const session = await auth();

        if (!session?.user?.id) {
            logger.warn('Interview prep failed - no session', { requestId });
            logAuthOperation('interview-prep:unauthorized', undefined, false);
            return NextResponse.json(
                { error: 'Unauthorized', requestId },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        logger.info('User authenticated', { requestId, userId });
        logAuthOperation('interview-prep:authenticated', userId, true);

        const body = await request.json();
        const { candidate_info, job_description } = body;

        if (!candidate_info) {
            logger.warn('Interview prep failed - no candidate info', { requestId, userId });
            return NextResponse.json(
                { error: 'Candidate info is required', requestId },
                { status: 400 }
            );
        }

        logger.info('Generating interview questions', {
            requestId,
            userId,
            hasJobDescription: !!job_description,
        });

        const prompt = `You are an expert interview coach. Based on the candidate's profile and ${job_description ? 'the job description provided' : 'general interview preparation'}, generate 5 personalized interview questions that the candidate is most likely to face.

Candidate Profile:
${candidate_info}

${job_description ? `Job Description:\n${job_description}` : ''}

For each question, provide:
1. The interview question
2. A suggested answer strategy (not a scripted answer, but how to approach it)
3. 3 key points the candidate should emphasize

Return ONLY a valid JSON object in this exact format:
{
    "questions": [
        {
            "question": "The interview question",
            "suggested_answer": "A strategy for answering this question effectively",
            "key_points": ["Key point 1", "Key point 2", "Key point 3"]
        }
    ]
}

Generate exactly 5 questions. Return ONLY the JSON, no markdown formatting.`;

        const response = await getGroq().chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert interview coach who helps candidates prepare for job interviews. Provide practical, actionable advice. Return valid JSON only.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.7,
            max_tokens: 4000,
        });

        let content = response.choices[0]?.message?.content?.trim() || '';

        // Clean up markdown formatting if present
        if (content.startsWith('```')) {
            content = content.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
        }

        let result: { questions: InterviewQuestion[] };
        try {
            result = JSON.parse(content);
        } catch {
            logger.error('Failed to parse AI response', { requestId, userId, content });
            return NextResponse.json(
                { error: 'Failed to generate questions', requestId },
                { status: 500 }
            );
        }

        logger.info('Interview questions generated successfully', {
            requestId,
            userId,
            questionsCount: result.questions?.length || 0,
        });

        logger.endOperation('interview-prep:generate');

        return NextResponse.json(result);
    } catch (error) {
        logger.failOperation('interview-prep:generate', error);
        logger.error('Interview prep error details', {
            requestId,
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            errorMessage: error instanceof Error ? error.message : String(error),
        });

        // Keep provider/config details server-side only (already logged above).
        return NextResponse.json(
            {
                error: 'Internal server error',
                requestId,
                detail: 'AI provider temporarily unavailable',
            },
            { status: 500 }
        );
    }
}
