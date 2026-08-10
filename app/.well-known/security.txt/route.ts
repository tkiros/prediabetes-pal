import { SUPPORT_EMAIL } from "../../../lib/pal/contact";

export const dynamic = "force-dynamic";

const CANONICAL_URL = "https://prediabetespal.com/.well-known/security.txt";
const EXPIRY_WINDOW_MS = 180 * 24 * 60 * 60 * 1000;

type SecurityTxtDeps = {
  now?: () => Date;
};

/** RFC 9116 security contact, generated per request so Expires never goes stale. */
export function createSecurityTxtHandler(deps: SecurityTxtDeps = {}) {
  const now = deps.now ?? (() => new Date());

  return function GET() {
    const expires = new Date(now().getTime() + EXPIRY_WINDOW_MS).toISOString();
    const body = [
      `Contact: mailto:${SUPPORT_EMAIL}?subject=Security%20report`,
      `Expires: ${expires}`,
      "Preferred-Languages: en",
      `Canonical: ${CANONICAL_URL}`,
      "",
    ].join("\n");

    return new Response(body, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=86400",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  };
}

export const GET = createSecurityTxtHandler();
