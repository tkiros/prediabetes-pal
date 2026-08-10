import Link from "next/link";

export const metadata = { title: "Check your email — Prediabetes Pal" };

export default function CheckEmailPage() {
  return (
    <div className="app-content--narrow">
        <section className="surface-card hero-card">
          <p className="hero-eyebrow">One more step</p>
          <h1 className="page-title">Check your email</h1>
          <p className="page-copy">
            We sent you a sign-in link. Open it on this device to finish
            signing in. The link expires in 24 hours.
          </p>
          <p className="field-hint">
            Nothing arriving? Check your spam folder, or head back and try
            again.
          </p>
        </section>

        <footer className="page-footer">
          <Link href="/signin">Try again</Link>
          <Link href="/">Home</Link>
        </footer>
    </div>
  );
}
