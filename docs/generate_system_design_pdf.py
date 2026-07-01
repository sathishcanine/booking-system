#!/usr/bin/env python3
"""Generate Alis-Adventure System Design document PDF for engineering review."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from pdf_base import BrandPDF


def build_pdf(output_path: Path) -> None:
    pdf = BrandPDF()
    pdf.doc_label = "Alis-Adventure | System Design"
    pdf.set_auto_page_break(auto=True, margin=20)

    pdf.cover_page(
        title="System Design",
        subtitle="Alis-Adventure Boat Marketplace",
        audience="Engineering Review",
        blurb=(
            "Architecture, data model, request flows, and scaling considerations for the "
            "Alis-Adventure platform — based on the codebase as of this review."
        ),
        accent=(15, 52, 96),
    )

    pdf.add_page()
    pdf.section_title("1. System Overview")
    pdf.body_text(
        "Alis-Adventure is a multi-tenant boat marketplace. Organizations (boat owners / tour "
        "operators) list Activities (boats), booked either as scheduled departures (tours with "
        "ticketed Slots) or instant hourly rentals. Renters browse, book, and pay via Stripe; "
        "owners manage listings and receive payouts via Stripe Connect; a super admin operates "
        "the platform."
    )
    pdf.sub_title("Primary User Roles")
    pdf.bullet("Renter — browses boats, books tours/rentals, manages own bookings")
    pdf.bullet("Owner — lists boats, manages availability/pricing, Stripe Connect payouts")
    pdf.bullet("Super Admin — approves listings, manages fees/policies, views all bookings")
    pdf.sub_title("Design Goals")
    pdf.bullet("Single-server deployability (Docker Compose) with path to horizontal scaling")
    pdf.bullet("Strict tenant isolation: owners only see their organization's data")
    pdf.bullet("Payment correctness: bookings confirm on verified Stripe events; holds expire")
    pdf.bullet("One booking engine for both scheduled tours and instant rentals")

    pdf.section_title("2. High-Level Architecture")
    pdf.diagram_frame(
        "Runtime Topology",
        lambda c, x, y, w: c.draw_system_architecture(x, y, w),
        height_hint=120,
    )
    pdf.body_text(
        "The API is a single FastAPI process (backend/app/main.py) composed of feature routers. "
        "There is no message queue or cache layer today; state lives in PostgreSQL and the "
        "uploads volume, and Stripe is the only external integration in the payment path."
    )

    pdf.section_title("3. Component Breakdown")
    pdf.sub_title("Frontend (React 18 + Vite + TypeScript)")
    for item in [
        "Public marketplace: search, boat detail, destinations, booking/checkout (pages/)",
        "Renter portal: account, history, cancellations, reviews, saved boats (renter/)",
        "Owner portal: listings, availability, Connect onboarding, earnings (pages/owner/)",
        "Admin portal: listing review, bookings, promos, captains, settings (admin/)",
        "Static build served by nginx in production; dev server proxies to API",
    ]:
        pdf.bullet(item)

    pdf.sub_title("Backend Routers (backend/app/routers)")
    widths = [35, 30, 130]
    pdf.table_row(["Router", "Prefix", "Responsibility"], widths, header=True)
    for row in [
        ("auth.py", "/api/auth", "Register/login (password, Google), JWT issuance"),
        ("boats.py", "/api/boats", "Search, detail, reviews, rental quotes, profiles"),
        ("marketplace.py", "/api", "Search config, destinations, sitemap.xml"),
        ("rentals.py", "/api/rentals", "Instant hourly rental booking + summary"),
        ("renter.py", "/api/renter", "Renter bookings, cancellations, reviews, saved boats"),
        ("connect.py", "/api/connect", "Stripe Connect onboarding + status for owners"),
        ("admin.py", "/api/admin", "Owner + super-admin console, earnings, settings"),
    ]:
        pdf.table_row(list(row), widths)
    pdf.body_text(
        "Root endpoints in main.py handle scheduled-departure booking, calendar grid, promo "
        "validation, cancellation policy, health check, and Stripe webhooks."
    )

    pdf.sub_title("Backend Services (backend/app/services)")
    for item in [
        "booking.py / availability.py / calendar_grid.py — holds, capacity, calendar",
        "boat_search.py / boat_catalog.py / boat_detail.py / boat_rental.py — marketplace queries",
        "pricing.py / fees.py / promo.py — price computation, platform fee, tax, discounts",
        "cancellation.py — refund tiers from PlatformSettings policy",
        "stripe_service.py / connect.py — PaymentIntents, webhooks, Connect accounts",
        "email_service.py — optional SMTP confirmations; listing_uploads.py — photo storage",
        "google_auth.py — Google ID token verification for social login",
    ]:
        pdf.bullet(item)

    pdf.add_page()
    pdf.section_title("4. Data Model")
    pdf.body_text(
        "PostgreSQL via SQLAlchemy ORM (backend/app/models.py). Organization is the tenant "
        "boundary; almost every other table hangs off it directly or via Activity."
    )
    pdf.diagram_frame(
        "Entity Relationships",
        lambda c, x, y, w: c.draw_data_model(x, y, w),
        height_hint=130,
    )
    pdf.sub_title("Notable Modeling Choices")
    pdf.bullet(
        "One Activity entity models tours and rentals; booking_kind on Booking distinguishes flows"
    )
    pdf.bullet(
        "Every Booking references a Slot — instant rentals use a synthetic slot, not a separate table"
    )
    pdf.bullet("Money stored as integer cents throughout")
    pdf.bullet(
        "List fields (amenities, photo_urls) stored as serialized text columns, not normalized tables"
    )
    pdf.bullet(
        "No Alembic: schema evolves via inline patches in seed.py — acceptable now, risky at scale"
    )

    pdf.section_title("5. Auth, Authorization & Multi-Tenancy")
    for item in [
        "JWT auth for renter, owner, super_admin (platform_auth.py)",
        "Renter tokens: 7-day expiry; admin/owner: 30-minute expiry + brute-force lockout",
        "tenant.py re-hydrates role/org from DB on every request — JWT claims not trusted alone",
        "Owners scoped to organization_id in admin queries; super_admin has own/overall scope",
        "CORS restricted to FRONTEND_URL in production",
    ]:
        pdf.bullet(item)

    pdf.section_title("6. Key Request Flows")

    pdf.sub_title("6.1 Scheduled Tour Booking")
    pdf.diagram().draw_flow_pipeline(
        10,
        pdf.get_y(),
        [
            "Pick slot",
            "Create hold",
            "Stripe checkout",
            "Card payment",
            "Webhook PAID",
            "Hold expires",
        ],
        width=190,
    )
    pdf.set_y(pdf.get_y() + 2)
    for step in [
        "POST /api/bookings creates PENDING booking and increments Slot.booked_count",
        "POST /api/bookings/{ref}/checkout returns Stripe client_secret",
        "Webhook payment_intent.succeeded is source of truth for PAID status",
        "Unpaid holds past hold_expires_at release capacity automatically",
    ]:
        pdf.bullet(step)

    pdf.sub_title("6.2 Instant Boat Rental")
    pdf.diagram().draw_flow_pipeline(
        10,
        pdf.get_y(),
        ["Rental quote", "POST /rentals", "PaymentIntent", "Webhook PAID"],
        width=190,
    )
    pdf.set_y(pdf.get_y() + 2)
    pdf.bullet("GET /api/boats/{slug}/rental-quote computes hourly price, fees, tax")
    pdf.bullet("POST /api/rentals creates booking_kind=rental + PaymentIntent")
    pdf.bullet("Same Stripe webhook confirms payment as tour bookings")

    pdf.sub_title("6.3 Owner Onboarding (Stripe Connect)")
    pdf.diagram().draw_flow_pipeline(
        10,
        pdf.get_y(),
        ["Onboard API", "Stripe KYC", "Redirect back", "account.updated"],
        width=190,
    )
    pdf.set_y(pdf.get_y() + 2)
    pdf.bullet("POST /api/connect/onboard creates/links Stripe Express account")
    pdf.bullet("Owner completes Stripe-hosted KYC; webhooks sync payout flags")
    pdf.bullet("owner_payout_cents accrued per booking; transfer via Connect, not in-app ledger")

    pdf.sub_title("6.4 Listing Review Workflow")
    pdf.body_text(
        "Activity.listing_status: DRAFT → PENDING_REVIEW → PUBLISHED (or DELISTED). Owner "
        "submits; super admin approves/rejects. Public search requires PUBLISHED + is_active."
    )

    pdf.add_page()
    pdf.section_title("7. Non-Functional Characteristics")
    pdf.sub_title("Security")
    for item in [
        "Security headers middleware (HSTS, X-Frame-Options, X-Content-Type-Options)",
        "Rate limiting middleware — in-memory, configurable per-minute cap",
        "Passwords hashed; Stripe webhook signature verified before trusting events",
        "Production secrets must override defaults (see PRODUCTION.md)",
    ]:
        pdf.bullet(item)
    pdf.sub_title("Reliability")
    for item in [
        "Booking holds auto-expire to prevent locked capacity from abandoned checkouts",
        "Docker health checks on db/api/web with restart: unless-stopped",
        "Stripe webhook is source of truth for payment state, not client redirect",
    ]:
        pdf.bullet(item)
    pdf.sub_title("Current Bottlenecks")
    for item in [
        "Single FastAPI process — no horizontal scaling yet",
        "In-memory rate limiting breaks with multiple API instances (needs Redis)",
        "Local disk uploads — not shareable across instances, no CDN",
        "No background queue — webhooks and email run inline in the request",
    ]:
        pdf.bullet(item)

    pdf.section_title("8. Technology Stack")
    widths = [45, 55, 80]
    pdf.table_row(["Layer", "Technology", "Notes"], widths, header=True)
    for row in [
        ("Frontend", "React 18, Vite, TypeScript", "SPA, nginx in prod"),
        ("Backend", "FastAPI, Python 3.12, SQLAlchemy", "Routers + services"),
        ("Database", "PostgreSQL 16 (SQLite dev)", "Docker volume or managed"),
        ("Payments", "Stripe + Connect", "PaymentIntents, webhooks, Express"),
        ("Auth", "JWT + Google OAuth", "Renter/owner/admin flows"),
        ("Infra", "Docker Compose, nginx", "web · api · db"),
        ("CI", "GitHub Actions", "pytest, typecheck, build"),
    ]:
        pdf.table_row(list(row), widths)

    pdf.section_title("9. Scaling & Evolution Roadmap")
    widths = [55, 125]
    pdf.table_row(["Concern", "Recommended Next Step"], widths, header=True)
    for row in [
        ("Schema evolution", "Introduce Alembic before breaking schema changes"),
        ("File storage", "S3/Cloud Storage + CDN for multi-instance deploys"),
        ("Rate limiting", "Redis-backed limiter for multiple API instances"),
        ("Background work", "Task queue (Celery/RQ) for webhooks and email"),
        ("Observability", "Sentry + metrics/tracing per route"),
        ("API scaling", "Multiple uvicorn workers behind nginx; review DB pooling"),
        ("Read scaling", "Postgres read replica for admin analytics if needed"),
    ]:
        pdf.table_row(list(row), widths)

    pdf.section_title("10. Summary")
    pdf.body_text(
        "Monolithic FastAPI + PostgreSQL with React SPA frontend, separated into routers and "
        "services by feature, with Organization as the tenant boundary. Architecture is "
        "appropriately simple for the current stage — clear seams exist (services, webhook "
        "entry point, pricing layer) for queues, caches, and object storage without a rewrite."
    )

    pdf.output(str(output_path))


if __name__ == "__main__":
    out = Path(__file__).resolve().parent / "Alis-Adventure-System-Design.pdf"
    build_pdf(out)
    print(f"Generated: {out}")
