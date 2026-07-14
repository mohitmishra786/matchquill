# MatchQuill — Homepage Value Proposition

> Status: launch draft. Product facts reflect the current codebase (Next.js frontend, FastAPI backend, Chrome MV3 extension, Groq generation, WeasyPrint PDF, Redis caching). Competitive framing is sourced — see **## Sources**.

---

## A note on the phrase we deliberately avoid: "AI resume builder"

We do **not** lead with "AI resume builder." It is the single most saturated phrase in this
category — Teal, Huntr, Jobscan, and dozens of smaller tools all describe themselves with
some variation of "AI resume builder / AI resume tool" (see Sources). Leading with it makes
MatchQuill indistinguishable from the pack and cedes the framing to incumbents who already
rank for the term. Instead we lead with the three things that are actually distinct about how
MatchQuill works: **local job-description extraction**, **zero-hallucination compilation**, and
an **optional semantic matching layer**.

---

## Primary value proposition (hero)

**Headline:**
> Compile your real experience into the job in front of you — without inventing a word of it.

**Subhead:**
> MatchQuill's browser extension reads the job description straight off the page, then compiles
> a tailored, ATS-ready resume and cover letter from your validated profile. It reorders,
> rephrases, and highlights your actual history — it never fabricates it.

**Primary CTA:** Add the extension · **Secondary CTA:** See how the compiler works

---

## Supporting sections

### 1. Capture the job from the page — no copy-paste

The MatchQuill Chrome extension (Manifest V3) extracts the job description locally from the page
you are already looking at, across a broad set of boards and ATS front-ends: LinkedIn, Indeed,
Glassdoor, Greenhouse, Lever, Workday, plus newly added support for Naukri, Wellfound,
ZipRecruiter, Ashby, SmartRecruiters, iCIMS, and Workable.

You do not paste a job description into a scanner. The extension parses the posting where it
lives and hands the structured requirements to the compiler in one click.

> Honesty note: Teal and Huntr also ship Chrome extensions — theirs are built primarily to
> *save jobs into a tracker*. MatchQuill's extension exists to *extract the JD and drive resume
> compilation*. The point of difference is what happens after capture, not that a capture
> extension exists at all.

### 2. Zero-hallucination compilation

Generic LLM resume tools can invent a job title, a metric, or a project to "fit" a posting.
That is a liability in an interview and with an honest applicant.

MatchQuill's generation is **constrained to your actual, validated profile data**. The compiler
rephrases, reorders, and highlights what you have genuinely done so the most relevant parts land
first — but it does not manufacture history you do not have. Think of your past achievements as
source code and the job description as the target architecture; MatchQuill compiles one into the
other. It never writes new source you didn't author.

> Scope note: "zero hallucination" describes the *constraint on generated content* — the model
> is grounded in your validated profile rather than free-writing. It is a design constraint, not
> an independently audited guarantee; we state it as how the system is built.

### 3. Relevance scoring, and an optional semantic layer

MatchQuill scores your profile against the job description to decide which experiences,
projects, and skills to lead with.

On top of keyword-level relevance, MatchQuill has an **optional semantic layer**:

> MatchQuill's relevance engine goes beyond keyword matching: an optional semantic layer uses
> sentence embeddings to recognize when a candidate's experience is phrased differently than the
> job posting but means the same thing.

> Important, and stated plainly: this semantic layer is **off by default**. It is feature-flagged
> and requires an optional install, and its production performance is not yet independently
> verified. We describe it as a capability MatchQuill can offer — not a default-on guarantee that
> ships turned on for every user. We will not claim benchmark numbers we have not measured.

### 4. ATS-ready output, built for the parser and the human

Generated resumes are produced as clean PDFs via WeasyPrint, avoiding the tables, images, and
non-standard layouts that trip up applicant tracking systems — while still reading well to a
human. Redis caching keeps repeat generations fast.

---

## One-line variants (for meta description / social)

- *Read the job off the page. Compile a resume from your real experience. Invent nothing.*
- *The career compiler: local JD extraction, zero-hallucination tailoring, optional semantic matching.*
- *Tailor your resume to the exact posting — grounded in what you've actually done.*

---

## Sources

- Jobscan — self-described AI/ATS resume tooling and paste-based scanner workflow: https://www.jobscan.co/ and https://www.jobscan.co/resume-scanner
- Jobscan is an analyzer, not a writer (context for our "compiler" framing): https://www.atsresumeai.com/compare/jobscan-review
- Teal — "AI resume builder" positioning, Chrome extension saves jobs to tracker: https://www.tealhq.com/ and https://www.tealhq.com/tools/job-tracker
- Huntr — Chrome extension, AI resume tailoring, tracker-first: https://www.loopcv.pro/directory/huntr/
- srbhr/Resume-Matcher — semantic/embedding matching exists in this category (so we do not claim it as unique) and the tool is paste-based with no browser extension: https://github.com/srbhr/Resume-Matcher and https://resumematcher.fyi/blog/how-resume-matching-algorithms-actually-work
