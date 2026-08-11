import { SUPPORT_EMAIL } from "../../../lib/pal/contact";

export const metadata = {
  title: "Pantry Review — Prediabetes Pal",
  robots: { index: false, follow: false }
};

export default function PantryThanksPage() {
  return (
    <main className="page-shell">
      <div className="page-frame">
        <section className="surface-card hero-card">
          <p className="hero-eyebrow">Pantry Review</p>
          <h1 className="page-title">
            Payment received — your review is on its way
          </h1>
          <p className="page-copy">
            Your setup link is on its way to the email you used at checkout. It
            signs you in and walks you through the photo upload — about five
            minutes, whenever suits you. Nothing else to do here.
          </p>
          <p className="field-hint">
            No email after a minute? Check spam, or write to {SUPPORT_EMAIL} and
            we&apos;ll sort it out.
          </p>
        </section>
      </div>
    </main>
  );
}
