# Coastal Cruises — Custom Booking System

Site-specific booking for your WordPress tour business (FareHarbor-style UI), built with **React**, **FastAPI (Python)**, **SQLite/PostgreSQL**, and **Stripe**.

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [First-time setup](#first-time-setup)
3. [Run locally (development)](#run-locally-development)
4. [Test the booking flow](#test-the-booking-flow)
5. [Stripe setup](#stripe-setup)
6. [Environment variables](#environment-variables)
7. [Production build](#production-build)
8. [WordPress embed](#wordpress-embed)
9. [Useful commands](#useful-commands)
10. [Troubleshooting](#troubleshooting)
11. [Project layout](#project-layout)

---

## Prerequisites

Install these before you start:

| Tool | Version | Check |
|------|---------|--------|
| **Python** | 3.10+ | `python3 --version` |
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **Stripe CLI** (for local payments) | latest | `stripe --version` |

Optional for production:

- PostgreSQL (instead of SQLite)
- A Stripe account ([dashboard.stripe.com](https://dashboard.stripe.com))

---

## First-time setup

Run these steps **once** after cloning or downloading the project.

### Step 1 — Backend (Python API)

```bash
cd /Users/sathishkumar/Documents/BookingSystem/backend

# Create virtual environment
python3 -m venv .venv

# Activate it (macOS / Linux)
source .venv/bin/activate

# Windows (Command Prompt)
# .venv\Scripts\activate.bat

# Windows (PowerShell)
# .venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Create environment file from template
cp .env.example .env
```

Edit `backend/.env` and add your Stripe **test** keys (see [Stripe setup](#stripe-setup) below).

The database is created and seeded automatically the **first time** you start the API.

### Step 2 — Frontend (React UI)

Open a **new terminal** (keep the backend terminal for later):

```bash
cd /Users/sathishkumar/Documents/BookingSystem/frontend

npm install
```

No `.env` is required for local dev — Vite proxies `/api` to `http://127.0.0.1:8000`.

### Step 3 — Stripe CLI (for payments)

Install the Stripe CLI if you have not already:

- macOS: `brew install stripe/stripe-cli/stripe`
- Other: [https://stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)

Log in:

```bash
stripe login
```

---

## Run locally (development)

You need **three terminals** running at the same time.

### Terminal 1 — Backend API

```bash
cd /Users/sathishkumar/Documents/BookingSystem/backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

You should see:

```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

- API docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Health check: [http://127.0.0.1:8000/api/config](http://127.0.0.1:8000/api/config)
- Calendar data: [http://127.0.0.1:8000/api/calendar](http://127.0.0.1:8000/api/calendar)

On first start, the console prints `Database seeded.` Sample tours for the current week are loaded.

### Terminal 2 — Frontend (React)

```bash
cd /Users/sathishkumar/Documents/BookingSystem/frontend
npm run dev
```

Open in your browser:

**[http://localhost:5173](http://localhost:5173)**

The dev server proxies API requests from `/api/*` to the backend on port `8000`.

### Terminal 3 — Stripe webhooks

```bash
stripe listen --forward-to localhost:8000/api/webhooks/stripe
```

Copy the **webhook signing secret** from the output (starts with `whsec_`) into `backend/.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx
```

**Restart Terminal 1** (backend) after updating `.env` so the new secret is loaded.

---

## Test the booking flow

1. Open [http://localhost:5173](http://localhost:5173) — you should see the **weekly calendar** with tour cards.
2. Click any card (e.g. **Dolphin Watching & Island Sunset**).
3. Select ticket quantities (Adults / Children).
4. Fill in contact details and check both **required** acknowledgment boxes.
5. Click **Continue to payment**.
6. Use a Stripe test card:
   - Card number: `4242 4242 4242 4242`
   - Expiry: any future date (e.g. `12 / 34`)
   - CVC: any 3 digits (e.g. `123`)
   - ZIP: any 5 digits
7. Click **Book and pay** — you should land on the success page with a booking reference.

**Demo promo code:** `SAVE10` ($10 off, applied before tax).

**Waitlist:** Pick a slot marked **Waitlist** (or nearly full) and check “Join waitlist” — no payment is taken.

---

## Stripe setup

### 1. Get API keys

1. Go to [Stripe Dashboard → Developers → API keys](https://dashboard.stripe.com/test/apikeys).
2. Copy **Publishable key** (`pk_test_...`) and **Secret key** (`sk_test_...`).
3. Add them to `backend/.env`:

```env
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxx
STRIPE_SECRET_KEY=sk_test_xxxxxxxx
```

### 2. Webhook secret (local)

With `stripe listen` running (Terminal 3), copy the `whsec_...` value into:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx
```

### 3. Webhook secret (production)

In Stripe Dashboard → **Developers → Webhooks → Add endpoint**:

- URL: `https://your-api-domain.com/api/webhooks/stripe`
- Events: `payment_intent.succeeded`
- Copy the signing secret into your production `.env`.

---

## Environment variables

All backend settings live in `backend/.env` (copy from `backend/.env.example`).

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | No | `sqlite:///./bookings.db` | SQLite file in `backend/`. Use Postgres URL in production. |
| `STRIPE_SECRET_KEY` | Yes (for payments) | — | Stripe secret key (`sk_test_` or `sk_live_`) |
| `STRIPE_PUBLISHABLE_KEY` | Yes (for payments) | — | Stripe publishable key (`pk_test_` or `pk_live_`) |
| `STRIPE_WEBHOOK_SECRET` | Yes (for confirmations) | — | From `stripe listen` or Stripe Dashboard webhook |
| `FRONTEND_URL` | No | `http://localhost:5173` | Allowed CORS origin for your React app |
| `TAX_RATE_PERCENT` | No | `13.0` | Tax applied after promo discount |
| `BOOKING_HOLD_MINUTES` | No | `15` | How long seats are held during checkout |
| `SITE_TIMEZONE` | No | `America/New_York` | Display timezone label (use proper TZ in prod) |

**Example `backend/.env` for local development:**

```env
DATABASE_URL=sqlite:///./bookings.db
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_from_stripe_listen
FRONTEND_URL=http://localhost:5173
TAX_RATE_PERCENT=13.0
BOOKING_HOLD_MINUTES=15
SITE_TIMEZONE=America/New_York
```

**Frontend (optional)** — only needed when the API is on a different host:

Create `frontend/.env`:

```env
VITE_API_URL=https://api.yoursite.com
```

Then rebuild: `npm run build`.

---

## Production build

### Build the React app

```bash
cd /Users/sathishkumar/Documents/BookingSystem/frontend
npm run build
```

Output is in `frontend/dist/` (upload to your web server or WordPress uploads folder).

### Run the API in production

```bash
cd /Users/sathishkumar/Documents/BookingSystem/backend
source .venv/bin/activate
pip install -r requirements.txt

# Example with gunicorn (install first: pip install gunicorn)
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

Use a process manager (systemd, PM2, Docker) and HTTPS in front of the API.

### Reset / re-seed the database

The calendar is **monthly** and seeds the **current month** with sample tours. To refresh demo data:

```bash
cd backend
rm -f bookings.db
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

On startup you should see: `Database seeded with monthly calendar data.`

---

## WordPress embed

### Option A — iframe (simplest)

1. Deploy the built React app to e.g. `https://book.yoursite.com`.
2. In WordPress, add a **Custom HTML** block:

```html
<iframe
  src="https://book.yoursite.com"
  width="100%"
  height="1200"
  style="border:0; min-height: 80vh;"
  title="Book a cruise"
></iframe>
```

3. Point `VITE_API_URL` at your production API when building the frontend.

### Option B — Shortcode plugin

1. Run `npm run build` in `frontend/`.
2. Upload everything inside `frontend/dist/` to  
   `wp-content/uploads/coastal-booking/`.
3. Copy `wordpress/coastal-booking-shortcode.php` into a small custom plugin or your theme’s `functions.php`.
4. On any page, add the shortcode: `[coastal_booking]`

Ensure your API allows CORS from your WordPress domain (`FRONTEND_URL` in `.env`).

### Option C — Subpath on same domain

If React is served at `yoursite.com/book/`:

1. Set `basename` in `frontend/src/main.tsx`:

```tsx
<BrowserRouter basename="/book">
```

2. Rebuild and configure your web server to serve `dist/index.html` for `/book/*`.

---

## Useful commands

### Backend

| Command | Description |
|---------|-------------|
| `source .venv/bin/activate` | Activate Python virtual environment |
| `pip install -r requirements.txt` | Install / update Python packages |
| `uvicorn app.main:app --reload --port 8000` | Run API with auto-reload (dev) |
| `python -c "from app.seed import seed; seed()"` | Manually re-run database seed |

### Frontend

| Command | Description |
|---------|-------------|
| `npm install` | Install Node dependencies |
| `npm run dev` | Start dev server at http://localhost:5173 |
| `npm run build` | Production build → `frontend/dist/` |
| `npm run preview` | Preview production build locally |

### Stripe

| Command | Description |
|---------|-------------|
| `stripe login` | Log in to Stripe CLI |
| `stripe listen --forward-to localhost:8000/api/webhooks/stripe` | Forward webhooks to local API |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **“Could not load schedule”** on calendar | Backend is not running. Start Terminal 1 (`uvicorn` on port 8000). |
| **Calendar is empty** | Delete `backend/bookings.db` and restart API to re-seed. Use the month/year dropdowns to navigate. |
| **Old weekly view / missing features** | Pull latest code, delete `bookings.db`, re-seed. Calendar uses `GET /api/calendar/month?year=2026&month=5`. |
| **Payment form does not appear** | Set `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` in `backend/.env` and restart API. |
| **Payment succeeds but seats not confirmed** | Run `stripe listen` (Terminal 3) and set `STRIPE_WEBHOOK_SECRET` in `.env`, then restart API. |
| **`ImportError: cannot import name 'UTC'`** | Use Python 3.10+ (project uses `timezone.utc` compatibility shim). |
| **CORS errors in browser** | Add your frontend URL to `FRONTEND_URL` in `backend/.env`. |
| **Port 8000 already in use** | Stop the other process or run `uvicorn app.main:app --reload --port 8001` and update Vite proxy in `frontend/vite.config.ts`. |
| **Port 5173 already in use** | Run `npm run dev -- --port 5174` |

---

## What you get

| Screen | Route | Description |
|--------|--------|-------------|
| Monthly calendar | `/` | Full month grid (MON–SUN), month/year picker, “Show X more”, spots left, waitlist, call-to-book, branded cards |
| Book & checkout | `/book/:slotId` | Tickets, promo, surveys, contact, Stripe payment, summary |
| Confirmation | `/success/:reference` | After payment or waitlist signup |

## Architecture

```
WordPress page  →  embeds React build (shortcode / iframe)
       ↓
React (Vite)    →  /api/* proxy to Python
       ↓
FastAPI         →  SQLAlchemy + SQLite (swap to Postgres in prod)
       ↓
Stripe          →  PaymentIntent + webhook → confirm seats
```

## Edge cases handled

| Case | Behavior |
|------|----------|
| **Double booking** | Row lock on slot + pending holds counted; webhook rechecks capacity |
| **Checkout timeout** | 15‑min hold (`BOOKING_HOLD_MINUTES`); expired holds release seats |
| **Sold out** | Card shows status; checkout can join waitlist (no charge) |
| **Low stock** | Orange “N spots left” when ≤ 8 remain |
| **Promo codes** | Server-side validation; discount before tax |
| **Payment failure** | Stripe Elements error; booking stays `pending` until hold expires |
| **Required acks** | API rejects without public trip + route checkboxes |
| **Past departures** | Blocked at booking time |

## Admin panel (manage tours & schedule)

Staff can manage the catalog without editing the database or re-running seed.

1. Add to `backend/.env` (see `backend/.env.example`):

```env
ADMIN_PASSWORD=your-secure-password
ADMIN_API_KEY=generate-a-long-random-string
```

2. Restart the API, then open **[http://localhost:5173/admin/login](http://localhost:5173/admin/login)**.

3. Sign in with `ADMIN_PASSWORD`. The app stores the API token in your browser.

| Admin section | What you can do |
|---------------|-----------------|
| **Dashboard** | Overview counts |
| **Tours & tickets** | Create/edit/delete tours; add ticket types (Adult, Child, Group, FL resident, etc.) with prices |
| **Departures** | Schedule slots on the calendar; capacity, promos, call-to-book, SkyBeach brand banner, bulk-create dates |
| **Promo codes** | Create codes like `SAVE10` |
| **Bookings** | View reservations; cancel bookings |

Public calendar at `/` updates immediately when you add departures.

---

## Production checklist

- [ ] PostgreSQL + backups
- [ ] HTTPS + Stripe live keys
- [ ] Webhook endpoint on HTTPS (`payment_intent.succeeded`)
- [x] Admin UI at `/admin` (set `ADMIN_PASSWORD` + `ADMIN_API_KEY` in production)
- [ ] Email confirmations after payment
- [ ] Refund/cancel policy in Stripe Dashboard
- [ ] Store slot times in UTC; display in `SITE_TIMEZONE`

## Project layout

```
BookingSystem/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI routes
│   │   ├── models.py         # SQLAlchemy models
│   │   ├── seed.py           # Sample tours & slots
│   │   └── services/         # Booking, Stripe, availability
│   ├── requirements.txt
│   ├── .env.example
│   └── .env                  # You create this (not in git)
├── frontend/
│   ├── src/
│   │   ├── pages/            # Calendar, Booking, Success
│   │   └── components/
│   ├── package.json
│   └── dist/                 # Created by npm run build
├── wordpress/
│   └── coastal-booking-shortcode.php
└── README.md
```

This is **one business, one catalog** — not multi-tenant. Extend models only as your cruises need.
