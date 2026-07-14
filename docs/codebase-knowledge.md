# MatchQuill Codebase Knowledge Document

> **Last Updated**: 2026-01-31  
> **Repository**: `matchquill` (github.com/mohitmishra786/matchquill)  
> **Purpose**: Complete knowledge base for implementing features, fixing bugs, and refactoring safely

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [System Architecture](#2-system-architecture)
3. [Feature Catalog](#3-feature-catalog)
4. [Technical Deep Dive](#4-technical-deep-dive)
5. [Nuances & Gotchas](#5-nuances--gotchas)
6. [API Reference](#6-api-reference)
7. [Database Schema](#7-database-schema)
8. [Glossary](#8-glossary)

---

## 1. High-Level Overview

### 1.1 What is MatchQuill?

MatchQuill is a **career resume compiler** that uses AI to generate tailored resumes and cover letters for specific job applications. Unlike generic resume builders, it:

- **Extracts job descriptions** from job boards (LinkedIn, Indeed, etc.) via Chrome Extension
- **Scores profile relevance** using TF-IDF-like algorithms to select the best experiences, projects, and skills
- **Generates ATS-optimized PDFs** using WeasyPrint with strict 1-page limits
- **Never hallucinates** - only uses validated user data, rephrasing and highlighting without inventing

### 1.2 Target Users

- Job seekers applying to multiple positions
- Professionals wanting to tailor resumes per application
- Developers, academics, executives (via template system)

### 1.3 Core Value Proposition

> "Your past achievements are the raw code, and a job description is the target architecture. Our job is to compile one into the other."

### 1.4 Main Features

| Feature | Business Purpose | User Value |
|---------|------------------|------------|
| **Resume Compiler** | Generate job-specific resumes | Higher interview callback rates |
| **Cover Letter Generator** | AI-generated cover letters | Saves writing time, tailored content |
| **Chrome Extension** | One-click job extraction | Frictionless workflow |
| **Profile Management** | Centralized career data | Single source of truth |
| **Template System** | Role-optimized layouts | Professional presentation |
| **Interview Prep** | AI-generated Q&A | Better interview preparation |
| **GitHub Import** | Auto-import projects | Faster profile building |

---

## 2. System Architecture

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐                    ┌─────────────────────────────────┐│
│  │ Chrome Extension│                    │      Next.js Frontend           ││
│  │    (MV3)        │                    │      (React 19)                 ││
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
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────┤
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
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Frontend** | Next.js | 15.x | React framework with App Router |
| | React | 19.x | UI library |
| | TypeScript | 5.x | Type safety |
| | Tailwind CSS | 4.x | Styling |
| | Prisma | 6.x | ORM |
| | NextAuth.js | 5.x (beta) | Authentication |
| **Backend** | Python | 3.9+ | Runtime |
| | FastAPI | 0.109+ | API framework |
| | Pydantic | 2.x | Data validation |
| | WeasyPrint | latest | PDF generation |
| **AI/LLM** | Groq | API | LPU inference |
| | Model | llama-3.3-70b | Cover letters, enhancement |
| **Database** | PostgreSQL | 14+ | Primary data |
| | Redis | 7+ | Caching |
| **Extension** | Chrome Manifest | V3 | Browser extension |

### 2.3 Data Flow

#### Resume Compilation Flow

```
1. Chrome Extension extracts job description from job posting
2. Extension sends POST /api/compile with:
   - auth_token (JWT from NextAuth)
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

#### Authentication Flow

```
1. User logs in via NextAuth (Google OAuth or Credentials)
2. NextAuth creates JWT with user ID in 'sub' claim
3. JWT stored in browser (httpOnly cookie)
4. Chrome Extension extracts token from cookies
5. Token sent to FastAPI backend in Authorization header
6. Backend validates JWT with NEXTAUTH_SECRET
```

---

## 3. Feature Catalog

### 3.1 Authentication & User Management

**Purpose**: Secure user access and profile management

**Files**:
- [`frontend/src/lib/auth.ts`](frontend/src/lib/auth.ts:1) - NextAuth configuration
- [`frontend/src/app/api/auth/[...nextauth]/route.ts`](frontend/src/app/api/auth/[...nextauth]/route.ts:1) - Auth routes
- [`backend/app/middleware/auth.py`](backend/app/middleware/auth.py:1) - JWT validation

**Key Components**:
- Google OAuth provider
- Credentials provider (email/password with bcrypt)
- JWT session strategy
- Middleware for protected routes

**Database Models**:
- `User` - Core user data
- `Account` - OAuth account linking
- `Session` - Session management
- `VerificationToken` - Email verification

---

### 3.2 Profile Management

**Purpose**: CRUD operations for career data

**Files**:
- [`frontend/src/app/(protected)/profile/page.tsx`](frontend/src/app/(protected)/profile/page.tsx:1) - Profile UI
- [`frontend/src/app/api/profile/route.ts`](frontend/src/app/api/profile/route.ts:1) - Profile API
- [`frontend/src/components/forms/`](frontend/src/components/forms/) - Form components

**Sub-features**:

#### Experiences
- Company, title, location, dates
- Description and highlights (bullet points)
- Keywords for relevance matching
- Current position flag

#### Projects
- Name, description, URL
- Technologies used
- Highlights
- Date range

#### Education
- Institution, degree, field
- GPA, honors
- Date range

#### Skills
- Name, category, proficiency level
- Years of experience

#### Publications (Academic)
- Title, venue, authors
- DOI, abstract, date

---

### 3.3 Resume Compiler

**Purpose**: Generate tailored resumes based on job descriptions

**Files**:
- [`backend/app/routers/compile.py`](backend/app/routers/compile.py:1) - API endpoint
- [`backend/app/services/resume_compiler.py`](backend/app/services/resume_compiler.py:1) - Compilation logic
- [`backend/app/utils/relevance_scorer.py`](backend/app/utils/relevance_scorer.py:1) - Scoring algorithm
- [`backend/app/utils/pdf_generator.py`](backend/app/utils/pdf_generator.py:1) - PDF generation

**How It Works**:

1. **Receive Request**: `POST /api/compile` with job description and optional template
2. **Fetch Profile**: Call frontend `/api/profile` to get user data
3. **Score Items**: [`RelevanceScorer`](backend/app/utils/relevance_scorer.py:32) calculates relevance for each profile item
4. **Select Top Items**: Based on template configuration limits
5. **Generate PDF**: [`PDFGenerator`](backend/app/utils/pdf_generator.py:265) creates ATS-friendly PDF
6. **Cache Result**: Store in Redis for repeated requests

**Template Configurations**:

| Template | Max Exp | Max Proj | Max Skills | Section Order |
|----------|---------|----------|------------|---------------|
| `experience-skills-projects` | 3 | 2 | 12 | Exp → Skills → Proj → Edu |
| `education-research-skills` | 2 | 1 | 10 | Edu → Pub → Exp → Skills |
| `projects-skills-experience` | 2 | 4 | 10 | Proj → Skills → Exp → Edu |
| `compact-technical` | 2 | 2 | 15 | Skills → Exp → Proj → Edu |

**Relevance Scoring Algorithm**:

```python
# Key factors in scoring:
1. Keyword overlap (TF-IDF weighted)
2. Title match boost (2.0x)
3. Recency boost (1.2x for last 2 years)
4. Skill exact match boost (1.5x)
5. Required skills match (1.5x)
6. Normalization by description length
```

---

### 3.4 Cover Letter Generator

**Purpose**: AI-generated cover letters tailored to job descriptions

**Files**:
- [`backend/app/routers/cover_letter.py`](backend/app/routers/cover_letter.py:1) - API endpoint
- [`backend/app/services/cover_letter_generator.py`](backend/app/services/cover_letter_generator.py:1) - Generation logic
- [`backend/app/services/groq_client.py`](backend/app/services/groq_client.py:1) - LLM client

**How It Works**:

1. **Score Profile Items**: Same relevance scoring as resume compiler
2. **Select Top Items**: Most relevant experiences, projects, skills
3. **Format Prompt**: Structured candidate info with anti-hallucination constraints
4. **Call Groq API**: Generate cover letter with specified tone
5. **Return Result**: Cover letter text with metadata

**Tone Options**:
- `professional` (default)
- `enthusiastic`
- `formal`

**Anti-Hallucination Measures**:
- System prompt explicitly forbids inventing information
- Only uses provided candidate info
- Word count limits (100-1000)

---

### 3.5 Chrome Extension

**Purpose**: Extract job descriptions from job boards

**Files**:
- [`extension/manifest.json`](extension/manifest.json:1) - Extension manifest
- [`extension/content/job-extractor.js`](extension/content/job-extractor.js:1) - Content script
- [`extension/background/service-worker.js`](extension/background/service-worker.js:1) - Background script
- [`extension/popup/popup.js`](extension/popup/popup.js:1) - Popup UI

**Supported Job Boards**:
- LinkedIn
- Indeed
- Glassdoor
- Greenhouse
- Lever
- Generic (fallback selectors)

**Flow**:

1. User visits job posting page
2. Content script detects job board and extracts:
   - Job title
   - Company name
   - Job description
3. Data sent to background service worker
4. Badge shows "1" indicating job ready
5. User clicks extension popup
6. Popup shows job details with buttons to:
   - Compile resume
   - Generate cover letter
   - Download/view PDF

---

### 3.6 Interview Prep

**Purpose**: Generate interview questions and suggested answers

**Files**:
- [`frontend/src/app/(protected)/interview-prep/page.tsx`](frontend/src/app/(protected)/interview-prep/page.tsx:1) - UI
- [`backend/app/routers/ai.py`](backend/app/routers/ai.py:40) - API endpoint

**How It Works**:

1. Fetch user profile
2. Format candidate info (name, experience, skills)
3. Send to `/api/py/ai/interview-prep`
4. Groq LLM generates 5 relevant questions
5. Each question includes:
   - Question text
   - Suggested answer
   - 3 key points to emphasize

---

### 3.7 GitHub Import

**Purpose**: Import public repositories as projects

**Files**:
- [`frontend/src/components/GitHubImportModal.tsx`](frontend/src/components/GitHubImportModal.tsx:1) - UI
- [`frontend/src/app/api/integrations/github/route.ts`](frontend/src/app/api/integrations/github/route.ts:1) - API

**How It Works**:

1. User enters GitHub username
2. Frontend calls GitHub API for public repos
3. User selects repos to import
4. Repos converted to projects with:
   - Name, description, URL
   - Primary language as technology
   - Stars/forks as highlights

---

### 3.8 Template System

**Purpose**: Role-optimized resume layouts

**Files**:
- [`frontend/src/app/(protected)/templates/page.tsx`](frontend/src/app/(protected)/templates/page.tsx:1) - Template selection UI
- [`frontend/src/components/templates/TemplatePreview.tsx`](frontend/src/components/templates/TemplatePreview.tsx:1) - Preview component
- [`backend/app/services/resume_compiler.py`](backend/app/services/resume_compiler.py:19) - Template configs

**Available Templates**:

| ID | Name | Category | Best For |
|----|------|----------|----------|
| `experience-skills-projects` | Professional | Professional | Executives, Managers |
| `education-research-skills` | Academic | Academic | Professors, Researchers |
| `projects-skills-experience` | Developer | Technical | Software Engineers |
| `compact-technical` | Technical | Technical | Data Scientists, DevOps |
| `creative-portfolio` | Creative | Creative | Designers, Artists |
| `executive-leadership` | Executive | Professional | CEOs, Board Members |
| `healthcare-medical` | Healthcare | Professional | Medical Professionals |
| `finance-analyst` | Finance | Professional | Financial Analysts |
| `minimalist-modern` | Minimalist | Modern | All Professionals |

---

### 3.9 Resume Upload & Parsing

**Purpose**: Import existing resumes

**Files**:
- [`backend/app/routers/upload.py`](backend/app/routers/upload.py:1) - Upload endpoint
- [`backend/app/services/resume_parser.py`](backend/app/services/resume_parser.py:1) - Parsing logic

**Supported Formats**:
- PDF
- DOCX
- TXT
- MD

**Max Size**: 10MB

---

## 4. Technical Deep Dive

### 4.1 Project Structure

```
matchquill/
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── main.py            # Entry point
│   │   ├── config.py          # Settings
│   │   ├── routers/           # API endpoints
│   │   │   ├── compile.py
│   │   │   ├── cover_letter.py
│   │   │   ├── upload.py
│   │   │   └── ai.py
│   │   ├── services/          # Business logic
│   │   │   ├── resume_compiler.py
│   │   │   ├── cover_letter_generator.py
│   │   │   ├── profile_service.py
│   │   │   ├── groq_client.py
│   │   │   └── resume_parser.py
│   │   ├── models/            # Pydantic schemas
│   │   │   ├── user.py
│   │   │   ├── resume.py
│   │   │   └── cover_letter.py
│   │   ├── utils/             # Utilities
│   │   │   ├── logger.py
│   │   │   ├── redis_cache.py
│   │   │   ├── relevance_scorer.py
│   │   │   └── pdf_generator.py
│   │   └── middleware/        # Auth middleware
│   └── tests/                 # Pytest tests
├── frontend/                   # Next.js application
│   ├── src/
│   │   ├── app/               # App Router
│   │   │   ├── (auth)/        # Auth routes (login, register)
│   │   │   ├── (protected)/   # Protected routes
│   │   │   │   ├── dashboard/
│   │   │   │   ├── profile/
│   │   │   │   ├── templates/
│   │   │   │   ├── interview-prep/
│   │   │   │   └── settings/
│   │   │   └── api/           # API routes
│   │   ├── components/        # React components
│   │   ├── lib/               # Utilities
│   │   └── types/             # TypeScript types
│   └── prisma/
│       └── schema.prisma      # Database schema
├── extension/                  # Chrome Extension
│   ├── manifest.json
│   ├── background/
│   ├── content/
│   └── popup/
└── docs/                       # Documentation
```

### 4.2 Key Design Patterns

#### Dependency Injection (Backend)

```python
# backend/app/routers/compile.py
def get_profile_service() -> ProfileService:
    return ProfileService()

def get_resume_compiler() -> ResumeCompiler:
    return ResumeCompiler()

@router.post("/compile")
async def compile_resume(
    request: ResumeRequest,
    profile_service: ProfileService = Depends(get_profile_service),
    compiler: ResumeCompiler = Depends(get_resume_compiler),
) -> ResumeResponse:
    ...
```

#### Context Providers (Frontend)

```typescript
// frontend/src/app/layout.tsx
<SessionProvider>
  <ThemeProvider>
    <LanguageProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </LanguageProvider>
  </ThemeProvider>
</SessionProvider>
```

#### Structured Logging

Both frontend and backend use structured JSON logging with request correlation IDs.

**Backend** ([`backend/app/utils/logger.py`](backend/app/utils/logger.py:1)):
```python
logger.info("Profile fetched", {
    "request_id": request_id,
    "user_id": profile.id,
    "experiences_count": len(profile.experiences),
})
```

**Frontend** ([`frontend/src/lib/logger.ts`](frontend/src/lib/logger.ts:1)):
```typescript
logger.info('Profile fetched', {
    experiencesCount: data.experiences?.length,
    projectsCount: data.projects?.length,
});
```

### 4.3 Caching Strategy

Redis is used for caching compiled resumes and cover letters.

**Cache Key Generation** ([`backend/app/utils/redis_cache.py`](backend/app/utils/redis_cache.py:48)):
```python
def generate_cache_key(user_id: str, job_description: str, prefix: str = "resume") -> str:
    jd_hash = hashlib.sha256(job_description.encode()).hexdigest()[:16]
    return f"matchquill:{prefix}:{user_id}:{jd_hash}"
```

**TTL Values**:
- Default: 5 minutes (300s)
- Short: 1 minute (60s)
- Long: 1 hour (3600s)

---

## 5. Nuances & Gotchas

### 5.1 Critical Design Decisions

#### Zero Hallucination Policy

**Rule**: The system NEVER invents information. If data is missing, it's omitted.

**Implementation**:
- System prompts explicitly forbid hallucination
- Resume compiler only uses validated profile data
- Cover letter generator constrained to provided candidate info

**Why**: Prevents false claims on resumes which could lead to legal/firing issues.

#### 1-Page Resume Limit

**Rule**: All generated resumes are strictly 1 page.

**Implementation**: [`max_resume_pages`](backend/app/config.py:51) = 1 in settings

**Why**: Hiring managers spend ~6 seconds on initial scan; 1 page forces conciseness.

#### ATS Optimization

**Rules**:
- No tables, images, or complex formatting
- Standard fonts (Helvetica, Arial)
- Simple HTML structure
- Proper heading hierarchy

**Implementation**: [`BASE_CSS`](backend/app/utils/pdf_generator.py:18) in PDF generator

### 5.2 Authentication Nuances

#### JWT Token Sharing

The Chrome Extension needs to access the NextAuth JWT from the frontend. This is handled by:

1. Extension content script reads cookies
2. Token passed to background script
3. Background script includes token in API calls

**Security Note**: Token is the same JWT used by frontend, validated with `NEXTAUTH_SECRET`.

#### Backend-Frontend Auth

FastAPI backend validates JWT tokens using the same secret as NextAuth:

```python
# backend/app/middleware/auth.py
payload = jwt.decode(
    token,
    settings.nextauth_secret,
    algorithms=["HS256"],
)
```

### 5.3 Deployment Considerations

#### Vercel Monorepo

The project is deployed as a monorepo on Vercel:

- Frontend: Next.js app at root
- Backend: Python serverless functions in `/api`
- Rewrites: `/api/py/*` → `/api/index.py`

**Config**: [`vercel.json`](vercel.json:1)

#### Environment Variables

**Required in Production**:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` or `UPSTASH_REDIS_REST_API_URL` - Redis
- `NEXTAUTH_SECRET` / `AUTH_SECRET` - JWT signing
- `NEXTAUTH_URL` or `FRONTEND_URL` - CORS/origin
- `GROQ_API_KEY` - LLM API access

### 5.4 Common Pitfalls

1. **PDF Generation Fails Silently**: WeasyPrint requires system dependencies (GTK, Pango). If unavailable, PDF generation is skipped but API still returns JSON.

2. **Redis Connection Fails**: Cache operations fail silently; system continues without caching.

3. **CORS Issues**: In development, frontend and backend run on different ports. CORS is configured to allow all origins in dev.

4. **Template Mismatch**: Frontend and backend template lists must be kept in sync. Mismatches default to `experience-skills-projects`.

5. **Date Format Handling**: Frontend uses ISO strings, backend uses datetime objects. Pydantic handles conversion via `populate_by_name`.

### 5.5 Performance Considerations

1. **LLM Calls**: Groq API is fast (~500ms) but still the bottleneck. Results are cached.

2. **PDF Generation**: WeasyPrint can be slow for complex layouts. Keep templates simple.

3. **Profile Fetching**: Backend calls frontend API for profile data. This adds latency but ensures consistency.

4. **Relevance Scoring**: O(n*m) where n=profile items, m=JD tokens. Acceptable for typical profiles (<100 items).

---

## 6. API Reference

### 6.1 Backend Endpoints (FastAPI)

All endpoints prefixed with `/api/py` in production.

#### Resume Compilation

```http
POST /compile
Content-Type: application/json

{
  "authToken": "eyJ...",
  "jobDescription": "We are looking for a senior full-stack developer...",
  "template": "experience-skills-projects"  // optional
}
```

**Response**:
```json
{
  "success": true,
  "pdfBase64": "JVBERi0xLjQK...",
  "resumeJson": {
    "name": "John Doe",
    "email": "john@example.com",
    "experiences": [...],
    "projects": [...],
    "skills": [...],
    "template": "experience-skills-projects"
  },
  "error": null
}
```

#### Cover Letter Generation

```http
POST /cover-letter
Content-Type: application/json

{
  "authToken": "eyJ...",
  "jobDescription": "...",
  "tone": "professional",  // optional: professional, enthusiastic, formal
  "maxWords": 400  // optional: 100-1000
}
```

**Response**:
```json
{
  "success": true,
  "coverLetter": "Dear Hiring Manager...",
  "wordCount": 342,
  "modelUsed": "llama-3.3-70b-versatile",
  "profileFieldsUsed": ["experiences", "skills"],
  "error": null
}
```

#### AI Enhancement

```http
POST /ai/enhance-bullet
Content-Type: application/json

{
  "bullet": "Worked on the website",
  "jobDescription": "..."  // optional
}
```

**Response**:
```json
{
  "enhanced_bullet": "Developed and deployed responsive web applications serving 10K+ daily users"
}
```

#### Interview Prep

```http
POST /ai/interview-prep
Content-Type: application/json

{
  "candidate_info": "Name: John Doe...",
  "job_description": "..."  // optional
}
```

**Response**:
```json
{
  "questions": [
    {
      "question": "Tell me about your experience with React",
      "suggested_answer": "...",
      "key_points": ["Point 1", "Point 2", "Point 3"]
    }
  ]
}
```

#### Resume Upload

```http
POST /upload/resume
Content-Type: multipart/form-data

file: <binary>
file_type: "resume"  // or "cover-letter"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "name": "John Doe",
    "email": "john@example.com",
    "experiences": [...],
    "education": [...],
    "skills": [...]
  }
}
```

### 6.2 Frontend API Routes (Next.js)

#### Profile

```http
GET /api/profile
# Returns complete user profile with all relations

PUT /api/profile
# Update profile fields
```

#### Profile Sub-resources

```http
GET/POST /api/profile/experiences
PUT/DELETE /api/profile/experiences?id={id}

GET/POST /api/profile/projects
PUT/DELETE /api/profile/projects?id={id}

GET/POST /api/profile/educations
PUT/DELETE /api/profile/educations?id={id}

GET/POST /api/profile/skills
PUT/DELETE /api/profile/skills?id={id}

GET/POST /api/profile/cover-letter

GET/PUT /api/profile/settings

GET /api/profile/analytics
# Returns profile completeness and activity stats
```

#### Auth

```http
POST /api/auth/register
# Register new user with email/password

# All other auth routes handled by NextAuth
GET/POST /api/auth/[...nextauth]
```

#### Integrations

```http
POST /api/integrations/github
# Fetch GitHub repos for import
```

---

## 7. Database Schema

### 7.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER & AUTH                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐       ┌──────────────┐       ┌──────────────────────┐    │
│  │    User      │◄──────┤   Account    │       │   Session            │    │
│  │──────────────│       │──────────────│       │──────────────────────│    │
│  │ id (PK)      │       │ id (PK)      │       │ id (PK)              │    │
│  │ email (UQ)   │       │ userId (FK)  │       │ sessionToken (UQ)    │    │
│  │ passwordHash │       │ provider     │       │ userId (FK)          │    │
│  │ name         │       │ providerAccId│       │ expires              │    │
│  │ image        │       │ access_token │       └──────────────────────┘    │
│  └──────┬───────┘       └──────────────┘                                   │
│         │                                                                    │
│         │ 1:N                                                                │
│         ▼                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Experience  │  │   Project    │  │  Education   │  │    Skill     │    │
│  │──────────────│  │──────────────│  │──────────────│  │──────────────│    │
│  │ id (PK)      │  │ id (PK)      │  │ id (PK)      │  │ id (PK)      │    │
│  │ userId (FK)  │  │ userId (FK)  │  │ userId (FK)  │  │ userId (FK)  │    │
│  │ company      │  │ name         │  │ institution  │  │ name         │    │
│  │ title        │  │ description  │  │ degree       │  │ category     │    │
│  │ location     │  │ url          │  │ field        │  │ proficiency  │    │
│  │ startDate    │  │ technologies │  │ startDate    │  │ yearsExp     │    │
│  │ endDate      │  │ highlights   │  │ endDate      │  └──────────────┘    │
│  │ current      │  │ order        │  │ gpa          │                      │
│  │ description  │  └──────────────┘  │ honors       │                      │
│  │ highlights   │                    │ order        │                      │
│  │ keywords     │                    └──────────────┘                      │
│  │ order        │                                                           │
│  └──────────────┘                                                           │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │
│  │ Publication  │  │ CoverLetter  │  │ UserSettings │                      │
│  │──────────────│  │──────────────│  │──────────────│                      │
│  │ id (PK)      │  │ id (PK)      │  │ id (PK)      │                      │
│  │ userId (FK)  │  │ userId (FK)  │  │ userId (FK)  │                      │
│  │ title        │  │ content      │  │ selectedTemplate│                   │
│  │ venue        │  │ jobTitle     │  │ resumePreferences│                  │
│  │ authors      │  │ companyName  │  └──────────────┘                      │
│  │ date         │  └──────────────┘                                         │
│  │ doi          │                                                           │
│  │ abstract     │                                                           │
│  └──────────────┘                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Prisma Schema

See [`frontend/prisma/schema.prisma`](frontend/prisma/schema.prisma:1) for complete schema.

**Key Relationships**:
- User → Experiences (1:N, cascade delete)
- User → Projects (1:N, cascade delete)
- User → Educations (1:N, cascade delete)
- User → Skills (1:N, cascade delete)
- User → Publications (1:N, cascade delete)
- User → CoverLetters (1:N, cascade delete)
- User → UserSettings (1:1, cascade delete)

**Indexes**:
- All relation tables have `@@index([userId])`
- Skills have `@@unique([userId, name])` to prevent duplicates

---

## 8. Glossary

### 8.1 Domain Terms

| Term | Definition |
|------|------------|
| **ATS** | Applicant Tracking System - software used by employers to parse resumes |
| **Compilation** | Process of generating a tailored resume from profile + job description |
| **Hallucination** | When AI invents false information (strictly forbidden in MatchQuill) |
| **Job Description (JD)** | Text from job posting describing requirements and responsibilities |
| **Relevance Score** | Numeric score (0-∞) indicating how well a profile item matches a JD |
| **Template** | Predefined layout configuration for resume generation |
| **TF-IDF** | Term Frequency-Inverse Document Frequency - weighting algorithm |

### 8.2 Technical Terms

| Term | Definition |
|------|------------|
| **CUID** | Collision-resistant Unique Identifier - used for database IDs |
| **JWT** | JSON Web Token - authentication token format |
| **LPU** | Language Processing Unit - Groq's specialized AI hardware |
| **MV3** | Manifest V3 - Chrome Extension format |
| **Pydantic** | Python data validation library |
| **WeasyPrint** | HTML/CSS to PDF conversion library |

### 8.3 File/Module Reference

#### Backend Core

| File | Purpose |
|------|---------|
| [`backend/app/main.py`](backend/app/main.py:1) | FastAPI entry point, middleware setup |
| [`backend/app/config.py`](backend/app/config.py:1) | Environment configuration |
| [`backend/app/routers/compile.py`](backend/app/routers/compile.py:1) | Resume compilation endpoint |
| [`backend/app/routers/cover_letter.py`](backend/app/routers/cover_letter.py:1) | Cover letter endpoint |
| [`backend/app/services/resume_compiler.py`](backend/app/services/resume_compiler.py:1) | Compilation orchestration |
| [`backend/app/services/cover_letter_generator.py`](backend/app/services/cover_letter_generator.py:1) | Cover letter generation |
| [`backend/app/utils/relevance_scorer.py`](backend/app/utils/relevance_scorer.py:1) | TF-IDF scoring algorithm |
| [`backend/app/utils/pdf_generator.py`](backend/app/utils/pdf_generator.py:1) | PDF generation |
| [`backend/app/utils/logger.py`](backend/app/utils/logger.py:1) | Structured logging |
| [`backend/app/utils/redis_cache.py`](backend/app/utils/redis_cache.py:1) | Redis caching |

#### Frontend Core

| File | Purpose |
|------|---------|
| [`frontend/src/lib/auth.ts`](frontend/src/lib/auth.ts:1) | NextAuth configuration |
| [`frontend/src/lib/prisma.ts`](frontend/src/lib/prisma.ts:1) | Prisma client |
| [`frontend/src/lib/logger.ts`](frontend/src/lib/logger.ts:1) | Frontend logging |
| [`frontend/src/app/layout.tsx`](frontend/src/app/layout.tsx:1) | Root layout with providers |
| [`frontend/src/app/api/profile/route.ts`](frontend/src/app/api/profile/route.ts:1) | Profile API |
| [`frontend/prisma/schema.prisma`](frontend/prisma/schema.prisma:1) | Database schema |

#### Extension Core

| File | Purpose |
|------|---------|
| [`extension/manifest.json`](extension/manifest.json:1) | Extension manifest |
| [`extension/content/job-extractor.js`](extension/content/job-extractor.js:1) | Job extraction logic |
| [`extension/background/service-worker.js`](extension/background/service-worker.js:1) | Background coordination |
| [`extension/popup/popup.js`](extension/popup/popup.js:1) | Popup UI logic |

---

## Appendix A: Environment Setup

### Backend Development

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your values

# Run server
uvicorn app.main:app --reload --port 8000
```

### Frontend Development

```bash
cd frontend
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Run server
npm run dev
```

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

---

## Appendix B: Deployment Checklist

- [ ] Set all required environment variables
- [ ] Configure PostgreSQL database (Neon recommended)
- [ ] Configure Redis (Upstash recommended)
- [ ] Set up Groq API key
- [ ] Configure NextAuth secret
- [ ] Set CORS origins in vercel.json
- [ ] Enable Sentry for error tracking (optional)
- [ ] Test Chrome Extension with production API
- [ ] Verify PDF generation works in serverless environment

---

*End of Document*
