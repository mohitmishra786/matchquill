<!--
PROPOSED README — do not overwrite the repo's real README.md until reviewed.
This draft positions MatchQuill against the nearest open-source comparison,
srbhr/Resume-Matcher. Competitive claims are sourced in the "Prior art" section.
-->

<div align="center">

# MatchQuill

**The career compiler.** Read a job description straight off the page, then compile a
tailored, ATS-ready resume and cover letter from your real experience — inventing nothing.

Next.js frontend · FastAPI backend · Chrome MV3 extension · Groq generation · WeasyPrint PDF · Redis cache

</div>

---

## What it does

1. **Capture** — The Chrome extension (Manifest V3) extracts the job description locally from the
   page you are viewing. Supported boards and ATS front-ends include LinkedIn, Indeed, Glassdoor,
   Greenhouse, Lever, and Workday, with newly added Naukri, Wellfound, ZipRecruiter, Ashby,
   SmartRecruiters, iCIMS, and Workable.
2. **Score** — The backend scores your validated profile against the posting to decide which
   experiences, projects, and skills to lead with.
3. **Compile** — Groq-powered generation produces a tailored resume and cover letter, rendered to
   a clean, ATS-friendly PDF via WeasyPrint. Redis caches repeat generations.

## The three pillars

- **Local JD extraction.** You don't paste a job description into a scanner — the extension parses
  the posting where it lives and drives the compiler in one click.
- **Zero-hallucination compilation.** Generation is constrained to your actual, validated profile.
  MatchQuill rephrases, reorders, and highlights what you've genuinely done; it does not invent
  titles, metrics, or projects. (This is a design constraint on generated content, not an
  independently audited guarantee.)
- **Optional semantic matching.** On top of keyword relevance, an **optional** semantic layer uses
  sentence embeddings to recognize when your experience is phrased differently than the posting but
  means the same thing.
  > This layer is **off by default**, feature-flagged, and requires an optional install. Its
  > production performance is not yet independently verified. It is a capability, not a default-on
  > guarantee.

## Architecture

| Component | Stack | Role |
|---|---|---|
| Frontend | Next.js, Prisma, NextAuth | Profile, template, and generation UI |
| Backend | FastAPI, WeasyPrint, Groq, Redis | Scoring, generation, PDF, caching |
| Extension | Chrome Manifest V3, content scripts | Local job-description extraction |

## Prior art & how MatchQuill compares

The nearest open-source comparison is **[srbhr/Resume-Matcher](https://github.com/srbhr/Resume-Matcher)**
(resumematcher.fyi) — an excellent, popular, genuinely open-source ATS resume tool. Credit where
due: it runs **locally with 100+ LLMs** (including Ollama for fully local inference), has a
**semantic/embedding matching layer** at its core, ships ATS-friendly templates, and shares a
similar stack (Next.js + FastAPI). If you want a self-hostable, local-first resume matcher,
Resume-Matcher is a strong choice.

Two honest points of difference (both verified against its repo and docs, Sources below):

- **Real-time JD capture via a browser extension.** Resume-Matcher takes the job description by
  **manual paste** and does **not** ship a browser extension. MatchQuill's defining workflow is a
  Chrome MV3 extension that extracts the posting locally from the page across 13+ boards/ATS
  front-ends. This is our clearest, verified differentiator.
- **A zero-hallucination compilation constraint** as the framing of the generation step —
  grounding output in validated profile data rather than free-writing.

Where we are **not** differentiated, stated plainly: **semantic matching is not unique to
MatchQuill.** Resume-Matcher already does embedding-based semantic matching, and it is fully open
source and local-first. We present our semantic layer as an optional capability (off by default,
unverified in production), not as a category first.

## Status

- Domain **matchquill.com is intended but not yet confirmed purchased**, and the name's trademark
  is **not yet cleared**. See `docs/naming-decision.md`. Do not treat the name/domain as final.

---

## Sources

- srbhr/Resume-Matcher — local-first, 100+ LLMs, no browser extension, manual paste, Next.js + FastAPI stack: https://github.com/srbhr/Resume-Matcher
- Resume-Matcher's own explanation of its semantic/embedding matching layer: https://resumematcher.fyi/blog/how-resume-matching-algorithms-actually-work
- Resume-Matcher website (features, templates, local LLM support): https://resumematcher.fyi/
- Naming/domain/trademark status: `docs/naming-decision.md` (in this repo)
