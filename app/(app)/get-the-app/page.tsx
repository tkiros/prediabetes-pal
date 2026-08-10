import Link from "next/link";

import { storeWaitlistUrl } from "../../../lib/waitlist";

export const metadata = {
  title: "Get Revora on your phone — Revora",
  alternates: { canonical: "/get-the-app" }
};

export default function GetTheAppPage() {
  const androidWaitlist = storeWaitlistUrl("android");
  const iosWaitlist = storeWaitlistUrl("ios");
  return (
    <div className="app-content--narrow">
        <section className="surface-card hero-card">
          <p className="hero-eyebrow">On your phone</p>
          <h1 className="page-title">Revora already works on your phone</h1>
          <p className="page-copy">
            The web app installs to your home screen and works like an app —
            no store, no download, same checks.
          </p>
          <h2 className="section-title">Android (Chrome)</h2>
          <p className="page-copy">
            Open Revora in Chrome, tap the menu (⋮), then &quot;Add to Home
            screen&quot;, then Add.
          </p>
          <h2 className="section-title">iPhone (Safari)</h2>
          <p className="page-copy">
            Open Revora in Safari, tap Share, then &quot;Add to Home
            Screen&quot;, then Add.
          </p>
          <h2 className="section-title">Prefer the store version?</h2>
          <p className="page-copy">
            The Google Play and App Store versions are coming soon. Join your
            platform&apos;s waitlist and we&apos;ll email you once when it
            ships. Nothing else, ever.
          </p>
          <div className="field-stack">
            {androidWaitlist ? (
              <a
                className="recheck-button link-button"
                href={androidWaitlist}
                data-testid="waitlist-android"
              >
                Google Play — join the Android waitlist
              </a>
            ) : (
              <p className="field-hint">Google Play — coming soon.</p>
            )}
            {iosWaitlist ? (
              <a
                className="recheck-button link-button"
                href={iosWaitlist}
                data-testid="waitlist-ios"
              >
                App Store — join the iPhone waitlist
              </a>
            ) : (
              <p className="field-hint">App Store — coming soon.</p>
            )}
          </div>
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
