#!/usr/bin/env python3
"""Generate Alis-Adventure Production Plan PDF for management review."""

from pathlib import Path

from fpdf import FPDF


class ProductionPlanPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, "Alis-Adventure | Production Plan", align="R", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")

    def section_title(self, title: str):
        self.ln(4)
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(20, 60, 100)
        self.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(20, 60, 100)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def sub_title(self, title: str):
        self.ln(2)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(40, 40, 40)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def body_text(self, text: str):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def bullet(self, text: str):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        x = self.get_x()
        self.cell(6, 5.5, chr(149))
        self.multi_cell(0, 5.5, text)
        self.set_x(x)

    def table_row(self, cols: list[str], widths: list[int], header: bool = False):
        if header:
            self.set_font("Helvetica", "B", 9)
            self.set_fill_color(230, 240, 250)
        else:
            self.set_font("Helvetica", "", 9)
            self.set_fill_color(255, 255, 255)
        self.set_text_color(30, 30, 30)
        for col, w in zip(cols, widths):
            self.cell(w, 7, col, border=1, fill=header)
        self.ln()


def build_pdf(output_path: Path) -> None:
    pdf = ProductionPlanPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # Cover
    pdf.ln(30)
    pdf.set_font("Helvetica", "B", 28)
    pdf.set_text_color(20, 60, 100)
    pdf.cell(0, 14, "Production Plan", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.set_font("Helvetica", "", 18)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(0, 10, "Alis-Adventure Boat Marketplace", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)
    pdf.set_font("Helvetica", "", 12)
    pdf.cell(0, 8, "Prepared for: Management Review", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 8, "Date: July 2026", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(20)
    pdf.set_font("Helvetica", "I", 10)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        6,
        "This document outlines the production readiness, deployment strategy, timeline, "
        "and operational requirements for launching the Alis-Adventure platform to live customers.",
        align="C",
    )

    # 1. Executive Summary
    pdf.add_page()
    pdf.section_title("1. Executive Summary")
    pdf.body_text(
        "Alis-Adventure is a boat rental marketplace for St. Petersburg, FL, enabling customers "
        "to browse, book, and pay for hourly boat rentals and tour departures. The platform "
        "includes owner onboarding, Stripe payments with Connect payouts, admin operations, "
        "and renter accounts."
    )
    pdf.body_text(
        "Current maturity: Late MVP / pre-production. Core booking, payment, and admin flows "
        "are implemented. Docker-based deployment is ready. The recommended path is a phased "
        "production launch over 3-4 weeks, starting with a staging environment and ending with "
        "a monitored live release."
    )

    pdf.sub_title("Key Recommendation")
    pdf.bullet("Deploy using Docker Compose on a single VPS with Cloudflare for HTTPS")
    pdf.bullet("Launch in phases: Staging -> Soft launch (limited owners) -> Public launch")
    pdf.bullet("Estimated timeline to production: 3-4 weeks from go-ahead")
    pdf.bullet("Estimated monthly infrastructure cost: $50-150 (excluding Stripe fees)")

    # 2. Product Overview
    pdf.section_title("2. Product Overview")
    pdf.sub_title("Customer-Facing Features (Ready)")
    pdf.bullet("Boat marketplace: search, filters, detail pages, reviews")
    pdf.bullet("Instant hourly boat rentals with add-ons and captain selection")
    pdf.bullet("Tour/cruise calendar booking with ticket types and promos")
    pdf.bullet("Stripe checkout and payment confirmation")
    pdf.bullet("Renter accounts: register, login (password + Google), booking history, cancellations")
    pdf.bullet("WordPress embed support for existing website integration")

    pdf.sub_title("Business / Operations Features (Ready)")
    pdf.bullet("Super admin portal: listings, bookings, captains, promos, platform settings")
    pdf.bullet("Boat owner portal: manage listings, availability, Stripe Connect payouts")
    pdf.bullet("Listing review workflow (submit, approve, reject)")
    pdf.bullet("Configurable platform fees, tax, and cancellation policies")
    pdf.bullet("Optional booking confirmation emails via SMTP")

    # 3. Architecture
    pdf.section_title("3. Production Architecture")
    pdf.body_text(
        "The application uses a three-tier Docker stack designed for single-server deployment "
        "with horizontal scaling as a future option."
    )

    pdf.set_font("Courier", "", 8)
    pdf.set_text_color(40, 40, 40)
    arch = (
        "  [Users / WordPress] --> [Cloudflare HTTPS]\n"
        "           |\n"
        "           v\n"
        "  [nginx Web Container]  port 80/443\n"
        "     |-- serves React SPA (static)\n"
        "     |-- proxies /api --> FastAPI\n"
        "     |-- proxies /uploads --> FastAPI\n"
        "           |\n"
        "           v\n"
        "  [FastAPI API Container]  port 8000\n"
        "     |-- JWT auth, bookings, payments\n"
        "     |-- Stripe webhooks\n"
        "           |\n"
        "           v\n"
        "  [PostgreSQL 16]  +  [Uploads Volume]\n"
    )
    pdf.multi_cell(0, 4.5, arch)
    pdf.ln(4)

    pdf.sub_title("Technology Stack")
    widths = [45, 55, 80]
    pdf.table_row(["Layer", "Technology", "Notes"], widths, header=True)
    pdf.table_row(["Frontend", "React 18, Vite, TypeScript", "SPA with nginx in production"], widths)
    pdf.table_row(["Backend", "FastAPI, Python 3.12", "REST API, JWT auth"], widths)
    pdf.table_row(["Database", "PostgreSQL 16", "Managed or Docker volume"], widths)
    pdf.table_row(["Payments", "Stripe + Connect", "Live keys + webhooks required"], widths)
    pdf.table_row(["Auth", "JWT + Google OAuth", "Renter and owner sign-in"], widths)
    pdf.table_row(["CI", "GitHub Actions", "Tests + build on every PR"], widths)

    # 4. Phased Rollout
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
                "Run full smoke test checklist (see Section 8)",
                "Complete end-to-end test booking with Stripe test mode",
                "Verify admin login, owner onboarding, and Connect payouts",
                "Fix any environment or configuration issues",
            ],
        ),
        (
            "Phase 3: Soft Launch (Week 3)",
            [
                "Switch to Stripe live keys",
                "Onboard 2-3 pilot boat owners",
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

    # 5. Infrastructure Requirements
    pdf.section_title("5. Infrastructure Requirements")
    pdf.sub_title("Minimum Server Specs (Single VPS)")
    pdf.bullet("2 vCPU, 4 GB RAM, 80 GB SSD")
    pdf.bullet("Ubuntu 22.04 LTS or similar")
    pdf.bullet("Docker and Docker Compose installed")
    pdf.bullet("Ports: 80/443 open (or 8080 behind reverse proxy)")

    pdf.sub_title("External Services Required")
    widths = [50, 70, 60]
    pdf.table_row(["Service", "Purpose", "Cost Estimate"], widths, header=True)
    pdf.table_row(["VPS Hosting", "App + DB hosting", "$24-48/mo"], widths)
    pdf.table_row(["Domain + Cloudflare", "HTTPS, CDN, DNS", "$12/yr + free tier"], widths)
    pdf.table_row(["Stripe", "Payments + Connect payouts", "2.9% + $0.30/txn"], widths)
    pdf.table_row(["Google Cloud", "OAuth + Maps API", "Free tier likely"], widths)
    pdf.table_row(["SMTP (SendGrid/Mailgun)", "Booking emails", "$0-20/mo"], widths)

    pdf.sub_title("Data & Backups")
    pdf.bullet("PostgreSQL: daily pg_dump to off-server storage")
    pdf.bullet("Uploads volume: weekly snapshot (listing/captain photos)")
    pdf.bullet("Retention: 30 days minimum")

    # 6. Security
    pdf.add_page()
    pdf.section_title("6. Security Checklist")
    checklist = [
        "All secrets changed from defaults (DB password, JWT secret, admin password)",
        "APP_ENV=production (strict CORS, secret validation)",
        "HTTPS terminated at Cloudflare or load balancer",
        "Stripe webhook secret configured and verified",
        "FRONTEND_URL locked to production domain",
        "SEED_DEMO_DATA=false (no demo listings in production)",
        "Rate limiting enabled (120 requests/min per IP)",
        ".env files excluded from version control",
        "Admin JWT secret >= 32 characters",
    ]
    for item in checklist:
        pdf.bullet(item)

    # 7. Deployment Steps
    pdf.section_title("7. Deployment Steps (Summary)")
    pdf.body_text("Detailed steps are documented in PRODUCTION.md in the repository.")
    steps = [
        "Copy and fill environment files (.env, backend/.env, frontend/.env.production)",
        "Set POSTGRES_PASSWORD, Stripe live keys, admin secrets, FRONTEND_URL",
        "Run: docker compose up -d --build",
        "Verify health: GET /api/health returns OK",
        "Configure Stripe webhook: https://your-domain.com/api/webhooks/stripe",
        "Run post-deploy smoke tests (Section 8)",
    ]
    for i, step in enumerate(steps, 1):
        pdf.bullet(f"Step {i}: {step}")

    # 8. Smoke Tests
    pdf.section_title("8. Post-Deploy Smoke Tests")
    tests = [
        "Homepage loads with hero search and featured boats",
        "Boat browse and guest filter work",
        "Complete a test booking through Stripe checkout",
        "Webhook marks booking as paid",
        "Confirmation email received (if SMTP configured)",
        "Admin login at /admin",
        "Owner Stripe Connect onboarding completes",
    ]
    for test in tests:
        pdf.bullet(test)

    # 9. Known Gaps
    pdf.section_title("9. Known Gaps & Future Work")
    pdf.body_text(
        "These items do not block initial launch but should be planned for scale:"
    )
    gaps = [
        ("Database migrations", "No Alembic; schema changes use inline patches. Add before major schema changes."),
        ("File storage", "Uploads on local disk. Migrate to S3/CDN for multi-server deploys."),
        ("Observability", "No Sentry or structured logging. Add for production error tracking."),
        ("Rate limiting", "In-memory only. Redis needed for multiple API instances."),
        ("Automated backups", "Manual today. Schedule cron jobs or use managed DB backups."),
        ("CI/CD deploy", "CI runs tests only. Add deploy workflow for automated releases."),
    ]
    widths = [50, 130]
    pdf.table_row(["Gap", "Impact / Mitigation"], widths, header=True)
    for gap, impact in gaps:
        pdf.table_row([gap, impact], widths)

    # 10. Risks
    pdf.add_page()
    pdf.section_title("10. Risks & Mitigations")
    risks = [
        ("Stripe webhook failure", "Bookings stay unpaid. Mitigation: monitor webhook logs; manual confirm endpoint exists."),
        ("Single server downtime", "Site unavailable. Mitigation: health checks, restart policies, backup server plan."),
        ("Data loss", "Lost bookings/photos. Mitigation: daily DB backups, upload snapshots."),
        ("Schema change in prod", "Downtime or data issues. Mitigation: add Alembic before major changes."),
        ("Owner payout delays", "Connect onboarding incomplete. Mitigation: clear owner onboarding UX and support."),
    ]
    widths = [55, 125]
    pdf.table_row(["Risk", "Mitigation"], widths, header=True)
    for risk, mitigation in risks:
        pdf.table_row([risk, mitigation], widths)

    # 11. Timeline
    pdf.section_title("11. Timeline Summary")
    widths = [35, 70, 75]
    pdf.table_row(["Week", "Phase", "Deliverables"], widths, header=True)
    pdf.table_row(["Week 1", "Pre-production", "Server, domain, secrets, Stripe live"], widths)
    pdf.table_row(["Week 2", "Staging", "Deployed stack, smoke tests passed"], widths)
    pdf.table_row(["Week 3", "Soft launch", "2-3 pilot owners, live payments"], widths)
    pdf.table_row(["Week 4", "Public launch", "Full marketplace, backups, monitoring"], widths)

    # 12. Decision Points
    pdf.section_title("12. Decisions Needed from Management")
    decisions = [
        "Go-ahead date for production launch",
        "Hosting provider preference (DigitalOcean, AWS, Hetzner, etc.)",
        "Production domain name (e.g. alisadventure.com)",
        "Stripe account ownership (platform vs. business entity)",
        "Pilot owner list for soft launch",
        "Budget approval for hosting and third-party services (~$50-150/mo)",
        "Who owns on-call / production support after launch",
    ]
    for d in decisions:
        pdf.bullet(d)

    # 13. Conclusion
    pdf.section_title("13. Conclusion")
    pdf.body_text(
        "Alis-Adventure is feature-complete for an initial marketplace launch. The Docker-based "
        "deployment path is documented and tested in CI. With management approval, production "
        "can be reached in 3-4 weeks through a controlled phased rollout. The primary risks "
        "(payments, data, uptime) have clear mitigations. Post-launch, investment in migrations, "
        "observability, and object storage will support growth beyond the initial single-server setup."
    )

    pdf.output(str(output_path))


if __name__ == "__main__":
    out = Path(__file__).resolve().parent / "Alis-Adventure-Production-Plan.pdf"
    build_pdf(out)
    print(f"Generated: {out}")
