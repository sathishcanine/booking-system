#!/usr/bin/env python3
"""Generate Alis-Adventure Production Plan PDF for management review."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from pdf_base import BrandPDF


def build_pdf(output_path: Path) -> None:
    pdf = BrandPDF()
    pdf.doc_label = "Alis-Adventure | Production Plan"
    pdf.set_auto_page_break(auto=True, margin=20)

    pdf.cover_page(
        title="Production Plan",
        subtitle="Alis-Adventure Boat Marketplace",
        audience="Management Review",
        blurb=(
            "This document outlines production readiness, deployment strategy, phased rollout, "
            "infrastructure requirements, and operational checklists for launching the platform "
            "to live customers in St. Petersburg, FL."
        ),
        accent=(26, 95, 140),
    )

    pdf.add_page()
    pdf.section_title("1. Executive Summary")
    pdf.body_text(
        "Alis-Adventure is a boat rental marketplace enabling customers to browse, book, and pay "
        "for hourly boat rentals and tour departures. The platform includes owner onboarding, "
        "Stripe payments with Connect payouts, admin operations, and renter accounts."
    )
    pdf.body_text(
        "Current maturity: late MVP / pre-production. Core booking, payment, and admin flows are "
        "implemented. Docker-based deployment is ready. Recommended path: phased launch over "
        "3–4 weeks — staging, soft launch with pilot owners, then public release."
    )
    pdf.sub_title("Key Recommendations")
    pdf.bullet("Deploy using Docker Compose on a single VPS with Cloudflare for HTTPS")
    pdf.bullet("Launch in phases: Staging → Soft launch (limited owners) → Public launch")
    pdf.bullet("Estimated timeline to production: 3–4 weeks from go-ahead")
    pdf.bullet("Estimated monthly infrastructure cost: $50–150 (excluding Stripe fees)")

    pdf.section_title("2. Product Overview")
    pdf.sub_title("Customer-Facing Features (Ready)")
    for item in [
        "Boat marketplace: search, filters, detail pages, reviews",
        "Instant hourly boat rentals with add-ons and captain selection",
        "Tour/cruise calendar booking with ticket types and promos",
        "Stripe checkout and payment confirmation",
        "Renter accounts: register, login (password + Google), booking history, cancellations",
        "WordPress embed support for existing website integration",
    ]:
        pdf.bullet(item)

    pdf.sub_title("Business / Operations Features (Ready)")
    for item in [
        "Super admin portal: listings, bookings, captains, promos, platform settings",
        "Boat owner portal: manage listings, availability, Stripe Connect payouts",
        "Listing review workflow (submit, approve, reject)",
        "Configurable platform fees, tax, and cancellation policies",
        "Optional booking confirmation emails via SMTP",
    ]:
        pdf.bullet(item)

    pdf.section_title("3. Production Architecture")
    pdf.body_text(
        "The application uses a three-tier Docker stack designed for single-server deployment, "
        "with a clear path to horizontal scaling as traffic grows."
    )
    pdf.diagram_frame(
        "Deployment Topology",
        lambda c, x, y, w: c.draw_production_architecture(x, y, w),
        height_hint=120,
    )

    pdf.sub_title("Technology Stack")
    widths = [45, 55, 80]
    pdf.table_row(["Layer", "Technology", "Notes"], widths, header=True)
    for row in [
        ("Frontend", "React 18, Vite, TypeScript", "SPA with nginx in production"),
        ("Backend", "FastAPI, Python 3.12", "REST API, JWT auth"),
        ("Database", "PostgreSQL 16", "Managed or Docker volume"),
        ("Payments", "Stripe + Connect", "Live keys + webhooks required"),
        ("Auth", "JWT + Google OAuth", "Renter and owner sign-in"),
        ("CI", "GitHub Actions", "Tests + build on every PR"),
    ]:
        pdf.table_row(list(row), widths)

    pdf.add_page()
    pdf.section_title("4. Phased Rollout Plan")
    phases = [
        (
            "Phase 1: Pre-Production Setup (Week 1)",
            [
                "Provision VPS (DigitalOcean, Hetzner, or AWS EC2)",
                "Configure domain DNS and Cloudflare SSL",
                "Create production environment files with strong secrets",
                "Set up Stripe live account and webhook endpoint",
                "Configure SMTP for booking confirmation emails",
                "Set up Google OAuth and Maps API keys",
            ],
        ),
        (
            "Phase 2: Staging Deployment (Week 2)",
            [
                "Deploy Docker stack to staging server",
                "Run full smoke test checklist (Section 8)",
                "Complete end-to-end test booking with Stripe test mode",
                "Verify admin login, owner onboarding, and Connect payouts",
                "Fix any environment or configuration issues",
            ],
        ),
        (
            "Phase 3: Soft Launch (Week 3)",
            [
                "Switch to Stripe live keys",
                "Onboard 2–3 pilot boat owners",
                "Monitor bookings, webhooks, and error logs daily",
                "Validate cancellation and refund flows",
                "Gather owner and customer feedback",
            ],
        ),
        (
            "Phase 4: Public Launch (Week 4)",
            [
                "Open marketplace to all boat owners",
                "Enable marketing and SEO (sitemap already built)",
                "Set up automated database backups",
                "Document on-call procedures and escalation path",
                "Post-launch review after 2 weeks",
            ],
        ),
    ]
    for title, items in phases:
        pdf.sub_title(title)
        for item in items:
            pdf.bullet(item)

    pdf.section_title("5. Infrastructure Requirements")
    pdf.sub_title("Minimum Server Specs (Single VPS)")
    for item in [
        "2 vCPU, 4 GB RAM, 80 GB SSD",
        "Ubuntu 22.04 LTS or similar",
        "Docker and Docker Compose installed",
        "Ports: 80/443 open (or 8080 behind reverse proxy)",
    ]:
        pdf.bullet(item)

    pdf.sub_title("External Services Required")
    widths = [50, 70, 60]
    pdf.table_row(["Service", "Purpose", "Cost Estimate"], widths, header=True)
    for row in [
        ("VPS Hosting", "App + DB hosting", "$24–48/mo"),
        ("Domain + Cloudflare", "HTTPS, CDN, DNS", "$12/yr + free tier"),
        ("Stripe", "Payments + Connect payouts", "2.9% + $0.30/txn"),
        ("Google Cloud", "OAuth + Maps API", "Free tier likely"),
        ("SMTP (SendGrid/Mailgun)", "Booking emails", "$0–20/mo"),
    ]:
        pdf.table_row(list(row), widths)

    pdf.sub_title("Data & Backups")
    pdf.bullet("PostgreSQL: daily pg_dump to off-server storage")
    pdf.bullet("Uploads volume: weekly snapshot (listing/captain photos)")
    pdf.bullet("Retention: 30 days minimum")

    pdf.add_page()
    pdf.section_title("6. Security Checklist")
    for item in [
        "All secrets changed from defaults (DB password, JWT secret, admin password)",
        "APP_ENV=production (strict CORS, secret validation)",
        "HTTPS terminated at Cloudflare or load balancer",
        "Stripe webhook secret configured and verified",
        "FRONTEND_URL locked to production domain",
        "SEED_DEMO_DATA=false (no demo listings in production)",
        "Rate limiting enabled (120 requests/min per IP)",
        ".env files excluded from version control",
        "Admin JWT secret ≥ 32 characters",
    ]:
        pdf.bullet(item)

    pdf.section_title("7. Deployment Steps (Summary)")
    pdf.body_text("Detailed steps are documented in PRODUCTION.md in the repository.")
    for i, step in enumerate(
        [
            "Copy and fill environment files (.env, backend/.env, frontend/.env.production)",
            "Set POSTGRES_PASSWORD, Stripe live keys, admin secrets, FRONTEND_URL",
            "Run: docker compose up -d --build",
            "Verify health: GET /api/health returns OK",
            "Configure Stripe webhook: https://your-domain.com/api/webhooks/stripe",
            "Run post-deploy smoke tests (Section 8)",
        ],
        1,
    ):
        pdf.bullet(f"Step {i}: {step}")

    pdf.section_title("8. Post-Deploy Smoke Tests")
    for test in [
        "Homepage loads with hero search and featured boats",
        "Boat browse and guest filter work",
        "Complete a test booking through Stripe checkout",
        "Webhook marks booking as paid",
        "Confirmation email received (if SMTP configured)",
        "Admin login at /admin",
        "Owner Stripe Connect onboarding completes",
    ]:
        pdf.bullet(test)

    pdf.section_title("9. Known Gaps & Future Work")
    pdf.body_text("These items do not block initial launch but should be planned for scale:")
    widths = [50, 130]
    pdf.table_row(["Gap", "Impact / Mitigation"], widths, header=True)
    for gap, impact in [
        ("Database migrations", "No Alembic; inline patches. Add before major schema changes."),
        ("File storage", "Uploads on local disk. Migrate to S3/CDN for multi-server deploys."),
        ("Observability", "No Sentry or structured logging. Add for production error tracking."),
        ("Rate limiting", "In-memory only. Redis needed for multiple API instances."),
        ("Automated backups", "Manual today. Schedule cron jobs or use managed DB backups."),
        ("CI/CD deploy", "CI runs tests only. Add deploy workflow for automated releases."),
    ]:
        pdf.table_row([gap, impact], widths)

    pdf.add_page()
    pdf.section_title("10. Risks & Mitigations")
    widths = [55, 125]
    pdf.table_row(["Risk", "Mitigation"], widths, header=True)
    for risk, mitigation in [
        ("Stripe webhook failure", "Bookings stay unpaid. Monitor webhook logs; manual confirm endpoint exists."),
        ("Single server downtime", "Site unavailable. Health checks, restart policies, backup server plan."),
        ("Data loss", "Lost bookings/photos. Daily DB backups, upload snapshots."),
        ("Schema change in prod", "Downtime or data issues. Add Alembic before major changes."),
        ("Owner payout delays", "Connect onboarding incomplete. Clear owner onboarding UX and support."),
    ]:
        pdf.table_row([risk, mitigation], widths)

    pdf.section_title("11. Timeline Summary")
    widths = [35, 70, 75]
    pdf.table_row(["Week", "Phase", "Deliverables"], widths, header=True)
    for row in [
        ("Week 1", "Pre-production", "Server, domain, secrets, Stripe live"),
        ("Week 2", "Staging", "Deployed stack, smoke tests passed"),
        ("Week 3", "Soft launch", "2–3 pilot owners, live payments"),
        ("Week 4", "Public launch", "Full marketplace, backups, monitoring"),
    ]:
        pdf.table_row(list(row), widths)

    pdf.section_title("12. Decisions Needed from Management")
    for d in [
        "Go-ahead date for production launch",
        "Hosting provider preference (DigitalOcean, AWS, Hetzner, etc.)",
        "Production domain name (e.g. alisadventure.com)",
        "Stripe account ownership (platform vs. business entity)",
        "Pilot owner list for soft launch",
        "Budget approval for hosting and third-party services (~$50–150/mo)",
        "Who owns on-call / production support after launch",
    ]:
        pdf.bullet(d)

    pdf.section_title("13. Conclusion")
    pdf.body_text(
        "Alis-Adventure is feature-complete for an initial marketplace launch. The Docker-based "
        "deployment path is documented and tested in CI. With management approval, production "
        "can be reached in 3–4 weeks through a controlled phased rollout. Primary risks "
        "(payments, data, uptime) have clear mitigations. Post-launch investment in migrations, "
        "observability, and object storage will support growth beyond the initial single-server setup."
    )

    pdf.output(str(output_path))


if __name__ == "__main__":
    out = Path(__file__).resolve().parent / "Alis-Adventure-Production-Plan.pdf"
    build_pdf(out)
    print(f"Generated: {out}")
