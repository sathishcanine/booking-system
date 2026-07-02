import { FormEvent, useState } from "react";
import { submitContactInquiry } from "../api";
import { showToast } from "../toast";

const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://facebook.com", icon: "f" },
  { label: "X", href: "https://x.com", icon: "𝕏" },
  { label: "YouTube", href: "https://youtube.com", icon: "▶" },
  { label: "Instagram", href: "https://instagram.com", icon: "◎" },
] as const;

export default function SiteFooter() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setSubmitting(true);
    setError("");
    try {
      await submitContactInquiry({
        first_name: String(data.get("firstName") || "").trim(),
        last_name: String(data.get("lastName") || "").trim(),
        email: String(data.get("email") || "").trim(),
        phone: String(data.get("phone") || "").trim(),
        message: String(data.get("message") || "").trim() || undefined,
      });
      showToast("Thanks — we'll be in touch soon.");
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <footer className="site-footer" aria-label="Contact">
      <div className="site-footer-grid">
        <section className="site-footer-form-panel" aria-labelledby="site-footer-form-heading">
          <h2 id="site-footer-form-heading" className="visually-hidden">
            Contact us
          </h2>
          {error && <p className="site-footer-error">{error}</p>}
          <form className="site-footer-form" onSubmit={onSubmit}>
            <div className="site-footer-form-row">
              <label className="site-footer-field">
                <span>
                  First name <span className="site-footer-required">*</span>
                </span>
                <input name="firstName" type="text" autoComplete="given-name" required />
              </label>
              <label className="site-footer-field">
                <span>
                  Last name <span className="site-footer-required">*</span>
                </span>
                <input name="lastName" type="text" autoComplete="family-name" required />
              </label>
            </div>

            <div className="site-footer-form-row">
              <label className="site-footer-field">
                <span>
                  Email <span className="site-footer-required">*</span>
                </span>
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label className="site-footer-field">
                <span>
                  Phone <span className="site-footer-required">*</span>
                </span>
                <input name="phone" type="tel" autoComplete="tel" required />
              </label>
            </div>

            <label className="site-footer-field site-footer-field--full">
              <span>Message</span>
              <textarea name="message" rows={3} />
            </label>

            <button type="submit" className="site-footer-submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send message"}
              <span aria-hidden>→</span>
            </button>
          </form>
        </section>

        <section className="site-footer-contact-panel" aria-labelledby="site-footer-contact-heading">
          <p className="site-footer-contact-eyebrow">
            <span className="site-footer-contact-line" aria-hidden />
            Our contact
          </p>
          <h2 id="site-footer-contact-heading">Have Any Questions?</h2>
          <p className="site-footer-social-label">Follow our socials</p>
          <div className="site-footer-socials">
            {SOCIAL_LINKS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="site-footer-social-link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.label}
              >
                {item.icon}
              </a>
            ))}
          </div>
        </section>
      </div>
    </footer>
  );
}
