import Link from "next/link";

import { PaywallCard } from "../../../components/paywall-card";
import { TrialWall } from "../../../components/trial-wall";
import { paywallMode } from "../../../lib/server/pricing";

export const metadata = {
  title: "Premium — Revora",
  alternates: { canonical: "/subscribe" }
};

export default async function SubscribePage({
  searchParams
}: {
  searchParams: Promise<{ declined?: string }>;
}) {
  const trial = paywallMode() === "trial";
  const declined = (await searchParams)?.declined === "1";
  return (
    <div className="app-content--narrow">
        {trial ? (
          <TrialWall declined={declined} />
        ) : (
          <section className="surface-card hero-card">
            <p className="hero-eyebrow">Revora Premium</p>
            <h1 className="page-title">
              Keep your history and your daily coach
            </h1>
            <p className="page-copy">
              The check stays free, every day. Premium is the memory around it —
              your history everywhere, and progress you can see.
            </p>
            <PaywallCard />
          </section>
        )}

        <footer className="page-footer">
          <Link href="/">Home</Link>
          <Link href="/account">Account</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </footer>
    </div>
  );
}
