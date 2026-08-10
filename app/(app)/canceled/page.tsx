import Link from "next/link";

export const metadata = { title: "Canceled — Prediabetes Pal" };

export default async function CanceledPage({
  searchParams
}: {
  searchParams: Promise<{ invalid?: string }>;
}) {
  const invalid = (await searchParams)?.invalid === "1";
  return (
    <div className="app-content--narrow">
        <section className="surface-card hero-card">
          <p className="hero-eyebrow">Billing</p>
          <h1 className="page-title">
            {invalid
              ? "That link has expired"
              : "You're canceled — no charge coming"}
          </h1>
          <p className="page-copy">
            {invalid
              ? "For your security this cancel link has expired. You can still cancel in one tap from your account page."
              : "Your card will not be charged. Anything left of your free week keeps working until it ends, and you can restart whenever you like."}
          </p>
          <a className="primary-button link-button" href="/account">
            Go to your account
          </a>
        </section>

        <footer className="page-footer">
          <Link href="/check">Check a meal</Link>
          <Link href="/">Home</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </footer>
    </div>
  );
}
