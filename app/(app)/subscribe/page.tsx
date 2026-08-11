import Link from "next/link";

import { PaywallCard } from "../../../components/paywall-card";
import { TrialWall } from "../../../components/trial-wall";
import { paywallMode } from "../../../lib/server/pricing";
import { getSessionInfo } from "../../../lib/server/session";

export const metadata = {
  title: "Premium — Prediabetes Pal",
  alternates: { canonical: "/subscribe" }
};

export default async function SubscribePage({
  searchParams
}: {
  searchParams: Promise<{ declined?: string }>;
}) {
  const trial = paywallMode() === "trial";
  const declined = (await searchParams)?.declined === "1";
  // A signed-in user already told us their email at sign-in — prefill it
  // (still editable: a different email may be trial-eligible). Session
  // resolution failing just leaves the field blank, as for guests.
  const session = await getSessionInfo().catch(() => null);
  return (
    <div className="app-content--narrow">
        {trial ? (
          <TrialWall declined={declined} initialEmail={session?.email ?? ""} />
        ) : (
          <section className="surface-card hero-card">
            <p className="hero-eyebrow">Prediabetes Pal Premium</p>
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
