# Production deployment checklist

Use this guide when deploying AlisAdventure to a live environment.

## 1. Environment

Copy the example files and fill in real secrets:

```bash
cp .env.docker.example .env
cp backend/.env.production.example backend/.env
cp frontend/.env.production.example frontend/.env.production
```

Edit all three files before starting containers.

### Root `.env` (Docker Compose)

| Variable | Notes |
|----------|--------|
| `POSTGRES_PASSWORD` | **Required** — strong password for the database |
| `POSTGRES_USER` / `POSTGRES_DB` | Defaults: `booking` / `bookings` |
| `VITE_*` | Frontend build-time vars (see below) |
| `WEB_PORT` | Host port for the web UI (default `8080`) |

### Backend `backend/.env`

| Variable | Notes |
|----------|--------|
| `APP_ENV=production` | Enables strict CORS and admin secret checks |
| `SEED_DEMO_DATA=false` | Skips demo boats, slots, and reviews |
| `FRONTEND_URL` | Public site URL, e.g. `https://alisadventure.com` |
| `STRIPE_*` | Live Stripe keys and webhook secret |
| `ADMIN_PASSWORD` | Strong password (not `changeme`) |
| `ADMIN_JWT_SECRET` | At least 32 random characters |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | Platform owner login |

`DATABASE_URL`, `APP_ENV`, and `SEED_DEMO_DATA` are set by Docker Compose and override `backend/.env`.

Optional backend variables:

| Variable | Notes |
|----------|--------|
| `SMTP_*` | Sends booking confirmation emails after payment |
| `GOOGLE_CLIENT_ID` | Renter Google Sign-In |
| `RATE_LIMIT_PER_MINUTE` | Default `120`; set `0` to disable |

### Frontend `frontend/.env.production`

| Variable | Notes |
|----------|--------|
| `VITE_API_URL` | Leave empty when nginx proxies `/api` on the same host |
| `VITE_GOOGLE_CLIENT_ID` | Must match backend `GOOGLE_CLIENT_ID` |
| `VITE_GOOGLE_MAPS_API_KEY` | Optional map picker for owner listings |

## 2. Database

- **PostgreSQL** is used in Docker (`psycopg2-binary` in `requirements.txt`).
- On first boot the API runs schema migrations and platform bootstrap (org, super admin, settings) via `seed()` — demo listings are **not** created when `SEED_DEMO_DATA=false`.
- Back up the `pgdata` volume regularly.

## 3. Stripe webhooks

Point Stripe to:

```
https://your-domain.com/api/webhooks/stripe
```

Events: `payment_intent.succeeded`, `account.updated` (Connect).

For local testing use the Stripe CLI (see README).

## 4. Docker (recommended)

```bash
# After editing .env, backend/.env, and frontend/.env.production (step 1)
docker compose up -d --build
```

- **Web UI:** http://localhost:8080 (or `WEB_PORT` from `.env`)
- **API** (internal): `http://api:8000` — proxied by nginx at `/api` and `/uploads`
- **Postgres:** `db:5432` (volume `pgdata`)
- **Uploads:** volume `uploads` (listing photos, captain photos)

Health checks:

- API: `GET /api/health` (also used by Compose)
- Database: `pg_isready`

Put TLS in front of the `web` service (Cloudflare, ALB, or nginx with certificates). The stack serves HTTP on port 80 inside the container.

## 5. Manual deploy (without Docker)

**Backend:**

```bash
cd backend
cp .env.production.example .env   # edit secrets
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Use a managed PostgreSQL `DATABASE_URL` — not SQLite.

**Frontend:**

```bash
cd frontend
cp .env.production.example .env.production   # edit if needed
npm ci
npm run build
# Serve dist/ with nginx; proxy /api and /uploads to the API (see frontend/nginx.conf)
```

## 6. Security checklist

- [ ] `POSTGRES_PASSWORD` and all secrets changed from examples
- [ ] `APP_ENV=production`
- [ ] Strong `ADMIN_PASSWORD` and `ADMIN_JWT_SECRET` (≥ 32 chars)
- [ ] `FRONTEND_URL` matches your real domain (CORS locked in production)
- [ ] HTTPS terminated at load balancer or reverse proxy
- [ ] Stripe webhook secret configured
- [ ] `.env` files not committed to git
- [ ] Uploads volume backed up (S3 migration is future work)
- [ ] Rate limiting enabled (`RATE_LIMIT_PER_MINUTE=120`)

## 7. Post-deploy smoke test

1. Open homepage — hero search, popular boats load
2. Browse boats — guest filter works
3. Complete a test booking with Stripe test/live mode
4. Confirm webhook marks booking paid
5. Check confirmation email (if SMTP configured)
6. Admin login at `/admin`
7. Owner Connect onboarding (if using payouts)

## 8. CI

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR:

- Backend: `pytest`
- Frontend: TypeScript check + production build

## 9. Known gaps (future work)

- Alembic versioned migrations (today: inline SQLite/Postgres column patches in `seed.py`)
- S3/object storage for uploads
- Sentry / structured logging
- Automated backup jobs for Postgres and uploads
- Redis-backed rate limiting for multi-instance API deploys
