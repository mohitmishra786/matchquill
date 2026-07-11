# CV-Wiz API Documentation

## Backend (FastAPI) — base path `/api/py`

| Method | Path | Auth | Rate limit | Description |
|--------|------|------|------------|-------------|
| GET | `/` | No | default | Liveness |
| GET | `/health` | No | default | Health + redis |
| POST | `/compile` | Bearer JWT | 5/min, 30/hr | Compile tailored resume PDF |
| POST | `/cover-letter` | Bearer JWT | 5/min, 30/hr | Generate cover letter |
| POST | `/upload/resume` | Bearer JWT (DB-validated) | 10/min, 50/hr | Parse resume upload |
| POST | `/ai/enhance-bullet` | Bearer JWT (DB-validated) | 10/min, 60/hr | AI bullet rewrite |
| POST | `/ai/interview-prep` | Bearer JWT (DB-validated) | 5/min, 20/hr | Interview Q&A |
| POST | `/ai/suggest-skills` | Bearer JWT (DB-validated) | 10/min, 50/hr | Skill suggestions |

### Auth
Prefer `Authorization: Bearer <jwt>`. Body `authToken` is **deprecated**.

### Errors
JSON body typically `{ "detail": "..." }` or `{ "error": "...", "code": "..." }` for Next.js routes.

## Next.js App Router APIs — `/api/*`
- `/api/profile` — authenticated profile CRUD
- `/api/audit` — **admin only** audit logs
- `/api/ai/enhance-bullet` — session-authenticated proxy to backend AI
- `/api/public/profile/[id]` — public profile (preference-filtered)
