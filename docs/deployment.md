# Deploying MatchQuill

MatchQuill is a monorepo: a **Next.js frontend** (`frontend/`), a **FastAPI
backend** (`backend/`), and a **Chrome extension** (`extension/`, published to the
Web Store, not hosted).

This guide covers the **recommended production setup**:

| Piece | Host | Plan | Why |
|---|---|---|---|
| Frontend (Next.js) | **Vercel** | Pro (you already have it) | Best Next.js host; Pro is **required** because the app takes payments (commercial use is not allowed on Vercel Hobby) |
| Backend (FastAPI) | **Railway** | Hobby ($5/mo) | Runs the `backend/Dockerfile`, so **WeasyPrint PDF generation works** (it can't on Vercel's serverless Python runtime) |
| Postgres | **Neon** | Free | Managed Postgres; do **not** run it on Railway (a Railway Postgres alone is ~$18/mo and blows the $5 credit) |
| Redis | **Upstash** | Free | Cache + rate limiting |

**Realistic new spend: ~$5/mo** (Railway), on top of the Vercel Pro you already
pay. A low-traffic backend consumes ~$1–3 of Railway's included $5 usage credit.

> **Keep semantic matching OFF in production** unless you know you need it — it
> pulls in `torch` (~2 GB), which would blow both Railway's credit and any
> serverless size limit. It's off by default; leave `FEATURE_FLAGS` empty.

---

## Architecture: two domains, one product

```
Browser / Extension
   │
   ├── https://matchquill.com            → Vercel (Next.js frontend)
   │        │  server-side proxy + Prisma
   │        ▼
   └── https://<app>.up.railway.app/api/py → Railway (FastAPI backend)
            │
            ├── Neon (Postgres)
            └── Upstash (Redis)
```

The frontend and backend are on **different domains**, so:
- The backend **must allow the frontend origin via CORS** — handled in code
  (`backend/app/main.py` reads `FRONTEND_URL` / `NEXTAUTH_URL`); you just set
  those env vars on Railway.
- The backend **validates the NextAuth JWT**, so `NEXTAUTH_SECRET` must be the
  **same value on both** Vercel and Railway.

---

## Step 1 — Provision the data services

1. **Neon** → create a project, copy the `DATABASE_URL` (pooled connection
   string). Neon has a Vercel integration you can use instead of pasting manually.
2. **Upstash** → create a Redis database. Copy either the `REDIS_URL` or the
   REST pair (`UPSTASH_REDIS_RES_KV_REST_API_URL` + `..._TOKEN`).
3. **Groq** → get `GROQ_API_KEY` from console.groq.com.
4. (Optional) **Google OAuth** and **Stripe** keys.

---

## Step 2 — Deploy the backend to Railway

1. **New Project → Deploy from GitHub repo** → select `mohitmishra786/matchquill`.
2. In the service settings:
   - **Root Directory:** `backend`
   - **Builder:** Dockerfile (Railway auto-detects `backend/Dockerfile`).
   - **Health Check Path:** `/api/py/health`
   - Do **not** set a custom start command — the Dockerfile's `CMD` binds to
     Railway's injected `$PORT` automatically.
3. Add the backend **environment variables** (Step 4 table).
4. Deploy. Then **Settings → Networking → Generate Domain** to get the public
   URL, e.g. `https://matchquill-backend.up.railway.app`.
5. Verify:
   ```bash
   curl https://<your-railway-domain>/api/py/health     # expect JSON: "status":"healthy"
   ```

> The Dockerfile is verified to build and run: it installs WeasyPrint's native
> libraries (Pango/Cairo/HarfBuzz), binds to `$PORT`, and serves
> `/api/py/health`. PDF generation works here — that's the whole point of using
> Railway for the backend.

---

## Step 3 — Deploy the frontend to Vercel

1. **Add New → Project** → import `mohitmishra786/matchquill`.
2. **Root Directory: `frontend`** (this is important — it makes Vercel deploy the
   Next.js app as a normal project and **ignore** the repo-root `vercel.json`,
   which is only for the all-in-one single-project mode you are **not** using).
3. Framework preset: **Next.js** (auto-detected).
4. Add the frontend **environment variables** (Step 4 table).
5. Deploy, then run the database migration once (and after any schema change),
   locally with the production `DATABASE_URL` exported:
   ```bash
   cd frontend
   npx prisma migrate deploy
   ```
   > The `subscriptionTier` migration is hand-written — review it before running
   > it against the real database.
6. Verify the site loads and login works.

---

## Step 4 — Environment variables (exact names + where they go)

Set these in each platform's dashboard. **Never commit real secrets.** Full
annotated list lives in `.env.example`.

### On Vercel (frontend)

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon connection string | Prisma |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | **must match Railway's** |
| `NEXTAUTH_URL` | `https://matchquill.vercel.app` (or custom domain) | must match the live site origin |
| `BACKEND_URL` | `https://<railway-domain>/api/py` | **required** for resume upload / AI proxy — **never** `localhost` |
| `NEXT_PUBLIC_API_URL` | `https://<railway-domain>/api/py` | same Railway URL (browser + extension) — **never** `localhost` in production |
| `FRONTEND_URL` | same as `NEXTAUTH_URL` | |
| `GROQ_API_KEY` | Groq key | if any frontend route calls Groq directly |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash REST pair | optional frontend helpers |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth | optional |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID_PRO_MONTHLY` | Stripe | optional — see `monetization-decision.md` |

> **Common production failure:** omitting `BACKEND_URL` on Vercel makes the upload proxy call
> `https://<vercel-host>/api/py/...`, which returns the Next.js HTML 404 page and surfaces as
> `PARSE_ERROR` / "Invalid response from parsing service".

### On Railway (backend)

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | **same Neon string** as Vercel | |
| `REDIS_URL` | Upstash `redis://…` / `rediss://…` | cache + rate limiting |
| `GROQ_API_KEY` | Groq key | LLM inference |
| `NEXTAUTH_SECRET` | **same value as Vercel** | backend validates the auth JWT |
| `NEXTAUTH_URL` | `https://matchquill.vercel.app` (or custom domain) | CORS origin |
| `FRONTEND_URL` | same as `NEXTAUTH_URL` | CORS + profile fetch |
| `FRONTEND_API_URL` | same as `NEXTAUTH_URL` | backend fetches profile from Next.js |

> `PORT` is injected by Railway automatically — do **not** set it.
>
> Do **not** set `BACKEND_URL` or `NEXT_PUBLIC_API_URL` to `http://localhost:8000` on Railway —
> those are local-dev values. Railway does not call itself via `BACKEND_URL`; Vercel does.
> After deploy, open **Settings → Networking → Generate Domain**, then put that domain into
> **Vercel** `BACKEND_URL` and `NEXT_PUBLIC_API_URL` as `https://<domain>/api/py`.

---

## Step 5 — Custom domain

1. Buy `matchquill.com` (see `naming-decision.md` for the pre-purchase checklist).
2. **Vercel → Settings → Domains** → add `matchquill.com`, set the DNS records
   Vercel gives you.
3. Update `NEXTAUTH_URL` / `FRONTEND_URL` on **both** Vercel and Railway to the
   custom domain, and redeploy both.
4. (Optional) Give the Railway backend a custom subdomain like
   `api.matchquill.com` and update `BACKEND_URL` / `NEXT_PUBLIC_API_URL`
   accordingly.
5. **Repoint the extension** to `https://<backend-domain>/api/py` before
   publishing the Web Store listing.

---

## Function / resource limits to know

**Railway (Hobby)** — billed on actual usage; $5 credit included, then metered.
Keep Postgres/Redis on Neon/Upstash (not Railway) and semantic matching off to
stay near $5.

**Vercel (Pro)** — Next.js API routes: 4.5 MB request/response body cap (resume
uploads must stay under this; `MAX_UPLOAD_BYTES` defaults to 4 MB), 300s default
function duration (up to 800s available).

---

## Post-deploy checklist

- [ ] `curl https://<railway>/api/py/health` → healthy (Redis connected)
- [ ] Frontend loads on the real domain; login works (`NEXTAUTH_URL` matches exactly)
- [ ] `NEXTAUTH_SECRET` is identical on Vercel and Railway
- [ ] A resume compile returns tailored content **and** a PDF (WeasyPrint on Railway)
- [ ] `prisma migrate deploy` run against the Neon DB
- [ ] CORS works (no browser console CORS errors calling the backend)
- [ ] Stripe left disabled until account + webhook are set up and reviewed
- [ ] Extension repointed to the production backend URL

---

## Alternative: everything on one Vercel project

If you ever want to avoid the second host, the repo also contains a root
`vercel.json` configured for [Vercel Services](https://vercel.com/docs/services)
(frontend + backend in one project, `/api/py/*` routed to FastAPI). The catch:
FastAPI runs as a serverless function there, and **WeasyPrint PDF generation
does not work** on that runtime (JSON/text still works). Use that mode only if
you don't need server-side PDFs, or switch the backend service to
`"runtime": "container"` so it uses the Dockerfile. For full PDF support, the
Railway split above is simpler.
