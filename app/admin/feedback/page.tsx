import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { AdminFeedbackTable } from "../../../components/admin-feedback-table";
import { isAdmin } from "../../../lib/server/admin";
import { safeDecrypt } from "../../../lib/server/crypto";
import { getDb, schema } from "../../../lib/server/db";
import { getSessionInfo } from "../../../lib/server/session";

export const metadata = {
  title: "Safety queue — Prediabetes Pal",
  robots: { index: false, follow: false }
};

export default async function AdminFeedbackPage() {
  const session = await getSessionInfo();
  if (!isAdmin(session)) {
    notFound();
  }

  // Queued reports only, oldest-first (longest-waiting at the top). The check's
  // coarse `risk` joins in so a reviewer sees the verdict the user reacted to;
  // the private comment is decrypted here, for the founder only, and never
  // leaves the server as plaintext beyond this rendered page.
  const rows = await getDb()
    .select({
      id: schema.checkFeedback.id,
      checkId: schema.checkFeedback.checkId,
      helpful: schema.checkFeedback.helpful,
      reason: schema.checkFeedback.reason,
      commentCiphertext: schema.checkFeedback.commentCiphertext,
      createdAt: schema.checkFeedback.createdAt,
      risk: schema.checks.risk
    })
    .from(schema.checkFeedback)
    .innerJoin(schema.checks, eq(schema.checkFeedback.checkId, schema.checks.id))
    .where(and(eq(schema.checkFeedback.reviewStatus, "queued")))
    // Oldest-first: the longest-waiting report sits at the top of the queue.
    .orderBy(asc(schema.checkFeedback.createdAt));

  return (
    <main className="page-shell">
      <div className="page-frame admin-frame">
        <h1 className="page-title">Safety queue</h1>
        {rows.length === 0 ? (
          <p className="page-copy">Nothing queued for review.</p>
        ) : (
          <AdminFeedbackTable
            rows={rows.map((row) => ({
              id: row.id,
              checkId: row.checkId,
              helpful: row.helpful,
              reason: row.reason,
              comment: row.commentCiphertext
                ? safeDecrypt(row.commentCiphertext)
                : null,
              risk: row.risk,
              createdAt: row.createdAt.toISOString()
            }))}
          />
        )}
      </div>
    </main>
  );
}
