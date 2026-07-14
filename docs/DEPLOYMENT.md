# Deploying MatchQuill to Vercel

MatchQuill is a monorepo with three parts: a **Next.js frontend** (`frontend/`), a
**FastAPI backend** (`backend/`), and a **Chrome extension** (`extension/`, not
deployed to Vercel). This guide covers deploying the frontend + backend to a
**single Vercel project** on the **Pro plan**.

---

## 1. Architecture decision: one project, not two

**Recommendation: deploy frontend and backend together as ONE Vercel project.**

The repo is already configured for this using [Vercel Services](https://vercel.com/docs/services)
(`vercel.json` at the repo root). Both apps build separately but serve from one
domain through a single routing table:

- `/api/py/*` → FastAPI backend
- everything else → Next.js frontend

### Why one project (not two separate ones)

| | One project (Services) — recommended | Two projects (frontend + backend split) |
|---|---|---|
| Domain | Single domain, **same-origin** | Two domains, needs CORS setup |
| CORS | Not needed in prod (same origin) | Must configure `allow_origins` |
| Env vars | Defined once | Duplicated / cross-referenced |
| Cost (Pro) | One project's function usage | Same total usage, more moving parts |
| Config | Already done (`vercel.json`) | Would need restructuring |

Two separate projects is the older pattern and mainly useful for staying on the
free/Hobby tier. Since you have **Pro**, the single-project Services model is
simpler and costs the same (functions bill on active CPU + memory regardless of
how many projects they're split across).

> Vercel Services is in Beta but available on **all plans including Pro**. You
> select it by setting the project's framework preset to **"Services"** —
> Vercel reads `vercel.json` and provisions both services automatically.

---

## 2. ⚠️ Critical caveat: WeasyPrint PDF generation

The backend uses **WeasyPrint** to render resume PDFs. WeasyPrint depends on
native system libraries (Pango, Cairo, GDK-PixBuf) that are **not present in
Vercel's serverless Python runtime**. On the default serverless deploy:

- JSON tailoring, scoring, and cover-letter text generation **work fine**.
- **PDF generation may fail** at runtime.

You have three options:

1. **Ship JSON-only on Vercel serverless** (simplest). Resume/cover-letter
   *content* generation works; skip or defer server-side PDF. Good enough if the
   frontend renders/downloads output client-side.
2. **Run the backend service as a container on Vercel** — change the backend
   service in `vercel.json` from `"framework": "fastapi"` to
   `"runtime": "container"`, set `services.backend.root` to `"backend/"`, and
   reference the Dockerfile using its service-relative name `"Dockerfile"` (which
   installs the native libs). Keeps everything in one project. This is the
   recommended path if you need server-side PDFs. *(Not applied by default — it's
   a cost/behavior choice for you to make; container functions bill the same way
   but have different cold-start characteristics.)*
3. **Host the backend elsewhere** (Render / Railway / Fly.io) using
   `backend/Dockerfile`, and deploy only the frontend to Vercel (the two-project
   split). Only worth it if you specifically want the backend off Vercel.

**Decide this before launch** — it's the one thing most likely to surprise you.

---

## 3. Prerequisites (external services)

Provision these first and collect their connection strings/keys:

| Service | Purpose | Notes |
|---|---|---|
| **Postgres** (Neon recommended) | Primary database | Neon has a Vercel integration; free tier is fine to start |
| **Redis** (Upstash) | Cache + rate limiting | Use the Upstash REST pair or a `REDIS_URL` |
| **Groq** | LLM inference | `GROQ_API_KEY` from console.groq.com |
| **Google OAuth** (optional) | Social login | Add the Vercel domain to authorized redirect URIs |
| **Stripe** (optional) | Billing — see `docs/monetization-decision.md` | Needs account + Product/Price + webhook; **review before enabling** |

---

## 4. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (Production +
Preview). Full annotated list is in `.env.example`. The essentials:

**Required**
```dotenv
DATABASE_URL              # postgres connection string (Neon)
REDIS_URL                 # or the UPSTASH_REDIS_RES_KV_REST_API_URL/TOKEN pair
GROQ_API_KEY
NEXTAUTH_SECRET           # openssl rand -base64 32   (min 32 chars)
NEXTAUTH_URL              # https://<your-domain>   (your final domain)
```

**Same-origin URLs on Vercel** — these auto-resolve to `https://{VERCEL_URL}` when
unset, but set them explicitly once you have a custom domain:
```dotenv
FRONTEND_URL              # https://<your-domain>
NEXT_PUBLIC_API_URL       # https://<your-domain>/api/py   (used by the extension/client)
BACKEND_URL               # https://<your-domain>/api/py
```

**Optional**
```dotenv
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET      # OAuth
STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PRICE_ID_PRO_MONTHLY
FEATURE_FLAGS=semantic_matching              # only if you also install
                                             # backend/requirements-semantic.txt (see §7)
SENTRY_DSN
```

> Never commit real secrets. `.env` files are gitignored; set values in the Vercel
> dashboard or via `vercel env`.

---

## 5. Step-by-step deploy

1. **Buy + prepare the domain.** Purchase `<your-domain>` (see
   `docs/naming-decision.md` for the pre-purchase checklist). You can deploy on the
   auto-generated `*.vercel.app` domain first and add the custom domain later.

2. **Create the Vercel project.**
   - Vercel Dashboard → **Add New → Project** → import `mohitmishra786/matchquill`.
   - **Root Directory: repository root** (NOT `frontend/`). This is essential —
     `vercel.json` at the root wires up both services.
   - Framework preset: let Vercel detect Services from `vercel.json` (or set to
     "Other").

3. **Add environment variables** (§4) for Production and Preview.

4. **Run the database migration** against the production DB before promoting the
   deploy (one-time, and after any schema change). Locally, with the production
   `DATABASE_URL` exported:
   ```bash
   cd frontend
   npx prisma migrate deploy
   ```
   > The `subscriptionTier` migration from the monetization work needs this. It is
   > hand-written — review it before running against a real database.

5. **Trigger the deploy.** With the schema ready, trigger a deploy from Vercel
   Dashboard or push to the connected branch.

6. **Verify the deploy.**
   ```bash
   curl https://<your-domain>/api/py/health      # backend health (expect JSON: healthy)
   ```
   Open `https://<your-domain>/` for the frontend. Confirm login works
   (`NEXTAUTH_URL` must match the domain exactly).

7. **Attach the custom domain.** Vercel → Settings → Domains → add
   `<your-domain>`, follow the DNS instructions (Vercel provides the A/CNAME
   records), then update `NEXTAUTH_URL`/`FRONTEND_URL`/`NEXT_PUBLIC_API_URL` to the
   custom domain and redeploy.

8. **Point the Chrome extension** at production: set `NEXT_PUBLIC_API_URL` (and the
   extension's host permissions / config) to `https://<your-domain>/api/py` before
   publishing the Web Store listing.

---

## 6. Function limits on Pro (know these)

From [Vercel Functions limits](https://vercel.com/docs/functions/limitations):

- **Max duration:** 300s default for Fluid Compute, up to **800s** on Pro.
  `vercel.json` sets `maxDuration: 300` for the backend — fine as-is.
- **Memory:** up to 4 GB / 2 vCPU on Pro.
- **Request/response body:** **4.5 MB** max. Resume uploads must stay under this
  (`MAX_UPLOAD_BYTES` defaults to 4 MB — keep it there).
- **Python bundle size:** **500 MB** uncompressed. The default backend fits. Do
  **not** add `requirements-semantic.txt` (torch/sentence-transformers) to the
  default install — it blows past 500 MB and requires Large Functions (5 GB beta).
  See §7.

---

## 7. Optional: semantic matching in production

The embedding-based semantic layer is **off by default**. To enable it you must
both set `FEATURE_FLAGS=semantic_matching` **and** install
`backend/requirements-semantic.txt` (torch + sentence-transformers). On Vercel
that pushes the Python bundle past the 500 MB serverless limit, so it requires
either the **Large Functions** beta (`VERCEL_SUPPORT_LARGE_FUNCTIONS=1`, up to
5 GB) or the container runtime (§2, option 2). Cold-start also grows by the model
load (~10s). Leave it off unless you've validated cost/latency on your infra.

---

## 8. Post-deploy checklist

- [ ] `curl /api/py/health` returns healthy (DB + Redis connected)
- [ ] Login (credentials and/or Google OAuth) works on the real domain
- [ ] A resume compile returns tailored content
- [ ] PDF path decision made (§2) and verified working or intentionally deferred
- [ ] `prisma migrate deploy` run against production DB
- [ ] Custom domain attached; `NEXTAUTH_URL` matches it exactly
- [ ] Stripe left disabled until account + webhook are set up and reviewed
- [ ] Extension repointed to the production API URL
