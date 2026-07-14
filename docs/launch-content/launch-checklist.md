# MatchQuill Launch Checklist

One-page checklist for launching **MatchQuill** (matchquill.com).

---

## ⛔ BLOCKERS — human action required before ANY public launch

Do not announce, register handles under, or spend on brand assets for this name until BOTH are cleared:

1. **Domain `matchquill.com` is NOT yet confirmed purchased.** The only signal on record is a WHOIS
   "No match" from 2026-07-14 (`docs/naming-decision.md`) — that is *not* a registrar reservation
   and can go stale in hours. A human must buy it at a real registrar (Cloudflare/Porkbun/Namecheap)
   **before** launch. Buy `quillfit.com` as a defensive backup in the same session.
2. **Trademark is NOT yet cleared.** Only web-search-level clearance was done; USPTO TESS/EUIPO/WIPO
   were not queried (see `docs/naming-decision.md`). A human must run at least a USPTO knockout search
   (ideally a TM attorney) in classes 9/35/42 before launch.

> Launch must not precede these two human actions. Everything below is blocked on them.

---

## Pre-launch (once blockers clear)

- [ ] Register `@matchquill` on X/Twitter, LinkedIn, Instagram, YouTube; claim `matchquill` GitHub org + npm name.
- [ ] Point matchquill.com at the app; verify SSL, OAuth callback URLs, and email domain (SPF/DKIM).
- [ ] Publish the Chrome extension to the Chrome Web Store (confirm no existing "MatchQuill" listing first) with screenshots + privacy policy describing local JD extraction.
- [ ] Swap in the proposed README (`docs/launch-content/README-proposed.md`) after review.
- [ ] Prepare demo GIF/video: extension extracting a real JD → tailored resume PDF in one click.
- [ ] Final copy review: no "AI resume builder" hero; semantic layer described as **optional / off by default / unverified** everywhere.
- [ ] Legal/honesty pass: no unsourced stats; "zero hallucination" framed as a design constraint.

## Product Hunt

- [ ] Draft tagline (avoid "AI resume builder"): e.g. *"Read the job off the page. Compile a resume from your real experience."*
- [ ] First comment: the three pillars (local JD extraction, zero-hallucination compilation, optional semantic matching) + honest note that semantic is off by default.
- [ ] 3–5 gallery images + demo video; line up a hunter; schedule for 12:01am PT, ideally Tue–Thu.
- [ ] Prepare answers conceding competitor strengths (Jobscan's ATS scoring, Teal/Huntr's tracking) — honesty plays well on PH.

## Reddit (read each sub's self-promo rules first; many ban direct launches)

- [ ] r/jobs — frame as a tool that helps tailor to a specific posting; expect skepticism, be transparent.
- [ ] r/cscareerquestions — highly anti-spam; only post if genuinely useful and rules allow; lead with the zero-hallucination angle.
- [ ] r/resumes — most on-topic; share the ATS-friendly PDF output; offer to answer questions, don't hard-sell.
- [ ] Optional: r/EngineeringResumes, r/jobsearchhacks — check rules.
- [ ] Do NOT copy-paste identical posts across subs; each needs native, rules-compliant framing.

## X/Twitter

- [ ] Launch thread: problem → the extension demo GIF → the three pillars → PH link.
- [ ] Explicitly state the semantic layer is optional/off-by-default (builds trust, avoids overclaim).
- [ ] Engage replies; retweet honest comparisons; tag relevant job-search/career communities.

## Post-launch

- [ ] Monitor Chrome Web Store reviews and extension error rates across the newly added boards (Naukri/Wellfound/ZipRecruiter/Ashby/SmartRecruiters/iCIMS/Workable).
- [ ] Track sign-ups vs. extension installs; watch Groq/Redis load and PDF generation latency.
- [ ] Collect testimonials; only publish metrics you can actually measure (no fabricated stats).

---

## Sources

- Name/domain/trademark status and the human verification checklist: `docs/naming-decision.md` (in this repo)
- Category saturation of "AI resume builder" (rationale for avoiding it): https://www.tealhq.com/ , https://www.jobscan.co/ , https://www.loopcv.pro/directory/huntr/
