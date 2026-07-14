# MatchQuill Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐                    ┌─────────────────────────────────┐│
│  │ Chrome Extension│                    │      Next.js Frontend           ││
│  │    (MV3)        │                    │      (React 18)                 ││
│  │                 │                    │                                 ││
│  │ • Job Extractor │                    │ • Landing Page                  ││
│  │ • Service Worker│                    │ • Auth (Login/Register)         ││
│  │ • Popup UI      │                    │ • Profile Dashboard             ││
│  │                 │                    │ • Template Selection            ││
│  └────────┬────────┘                    └──────────────┬──────────────────┘│
│           │                                            │                    │
└───────────┼────────────────────────────────────────────┼────────────────────┘
            │                                            │
            │ REST API                                   │ REST API
            ▼                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         FastAPI Backend                                  ││
│  │                                                                          ││
│  │  ┌─────────────────┐  ┌───────────────────┐  ┌───────────────────────┐ ││
│  │  │ /api/compile    │  │ /api/cover-letter │  │ /api/templates        │ ││
│  │  │                 │  │                   │  │                       │ ││
│  │  │ Resume Compiler │  │ Cover Letter Gen  │  │ Template Config       │ ││
│  │  └────────┬────────┘  └─────────┬─────────┘  └───────────────────────┘ ││
│  │           │                     │                                       ││
│  │           ▼                     ▼                                       ││
│  │  ┌─────────────────────────────────────────────┐                        ││
│  │  │            Services Layer                    │                        ││
│  │  │                                              │                        ││
│  │  │  ┌─────────────┐  ┌──────────────────────┐  │                        ││
│  │  │  │ Relevance   │  │ Cover Letter         │  │                        ││
│  │  │  │ Scorer      │  │ Generator            │  │                        ││
│  │  │  │             │  │                      │  │                        ││
│  │  │  │ • TF-IDF    │  │ • Prompt Builder     │  │                        ││
│  │  │  │ • Boosting  │  │ • Groq Client        │  │                        ││
│  │  │  └─────────────┘  └──────────────────────┘  │                        ││
│  │  │                                              │                        ││
│  │  │  ┌─────────────┐  ┌──────────────────────┐  │                        ││
│  │  │  │ PDF         │  │ Profile Service       │  │                        ││
│  │  │  │ Generator   │  │                      │  │                        ││
│  │  │  │             │  │ • Fetch User Data    │  │                        ││
│  │  │  │ • WeasyPrint│  │ • Validate Profile   │  │                        ││
│  │  │  └─────────────┘  └──────────────────────┘  │                        ││
│  │  └──────────────────────────────────────────────┘                        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │   PostgreSQL     │  │   Redis Cache    │  │      Groq LLM API        │  │
│  │   (Neon)         │  │   (Upstash)      │  │                          │  │
│  │                  │  │                  │  │                          │  │
│  │ • User Accounts  │  │ • Session Cache  │  │ • llama-3.3-70b          │  │
│  │ • Experiences    │  │ • Resume Cache   │  │ • Cover Letter Gen       │  │
│  │ • Projects       │  │ • Rate Limiting  │  │                          │  │
│  │ • Skills         │  │                  │  │                          │  │
│  │ • Education      │  │                  │  │                          │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Resume Compilation Flow

```
1. Browser Extension extracts job description from job posting
2. Extension sends POST /api/compile with:
   - user_id (from auth)
   - job_description
   - template (optional)

3. Backend:
   a. Fetches user profile from Next.js /api/profile
   b. RelevanceScorer analyzes job description keywords
   c. Scores each profile item (experience, project, skill)
   d. Selects top-N items based on template config
   e. Generates PDF with WeasyPrint (1-page limit)
   f. Caches result in Redis

4. Extension receives PDF (base64) and displays in popup
```

### Cover Letter Flow

```
1. User requests cover letter from extension
2. POST /api/cover-letter with job details

3. Backend:
   a. Fetches user profile
   b. RelevanceScorer selects most relevant items
   c. Builds structured prompt with ONLY user data
   d. Calls Groq API (prevents hallucination)
   e. Returns ATS-friendly cover letter

4. Extension displays result
```

## Key Design Decisions

### 1. No LLM Hallucination

Cover letters use strict prompts that only reference actual user data:

```python
prompt = """
Use ONLY the following facts. Do NOT invent anything.

Candidate: {name}
Email: {email}
Experiences: {experiences}
...

Write a cover letter for: {job_title} at {company}
"""
```

### 2. Relevance Scoring

TF-IDF-inspired algorithm with boosts:
- **Recency boost (1.2x)**: Current/recent positions score higher
- **Title match boost (2.0x)**: Exact job title matches
- **Keyword density**: More matching keywords = higher score

**Optional semantic layer:** `RelevanceScorer` can additionally blend in
embedding-based (sentence-transformer) cosine similarity, which catches
paraphrased/semantically-equivalent phrasing that shares no keywords with the
job description (e.g. "led cross-functional teams" vs. a JD asking for
"project management experience"). This is gated behind the
`semantic_matching` feature flag (`FEATURE_FLAGS=semantic_matching`, see
`app/config.py`) and is **off by default** — the keyword/TF-IDF score above is
always computed and always usable on its own. When enabled, semantic
similarity is added as a bounded bonus on top of the keyword score (never a
replacement); embeddings are cached (MD5-keyed, size-bounded, in-process) so
each JD/profile-item text is embedded at most once. The backend
(`sentence-transformers/all-MiniLM-L6-v2`, an optional dependency — see
`backend/requirements-semantic.txt`) degrades to a no-op if the dependency
isn't installed or fails to load, so keyword scoring is never at risk. This
does not change any API response shape: callers still consume
`RelevanceScorer.select_top_items()`, which returns the same profile item
models as before.

### 3. Template System

Templates define section priority and limits:

| Template | Max Exp | Max Proj | Max Skills | Primary Sections |
|----------|---------|----------|------------|------------------|
| Professional | 3 | 2 | 12 | Experience → Skills → Projects |
| Academic | 2 | 1 | 10 | Education → Publications |
| Developer | 2 | 4 | 10 | Projects → Skills → Experience |
| Technical | 2 | 2 | 15 | Skills → Experience → Projects |

### 4. ATS-Friendly PDFs

WeasyPrint generates clean PDFs:
- Standard fonts (Helvetica, Arial, Times)
- Simple CSS (no complex layouts)
- Machine-readable text
- Strict 1-page enforcement

## Security

- JWT authentication via NextAuth.js
- CORS restricted to known origins
- Environment variables for secrets
- No sensitive data in client storage

## Caching Strategy

Redis caches compiled resumes for 5 minutes:
- Key: `resume:{user_id}:{hash(job_description)}`
- Repeated requests return cached result
- Invalidated on profile update
