import { notFound } from "next/navigation";

import { isVideoEngineEnabled } from "../../lib/video-engine/dashboard";
import { VideoEngineDashboard } from "./dashboard-client";

export const runtime = "nodejs";
export const metadata = {
  title: "Video Engine — Prediabetes Pal",
  robots: { index: false, follow: false },
};

// Dev-only tool: shells out to `claude` + `git`. 404 anywhere that isn't
// pure-local dev (see isVideoEngineEnabled — fail-closed on any VERCEL_ENV).
export default function VideoEnginePage() {
  if (!isVideoEngineEnabled(process.env)) notFound();
  return <VideoEngineDashboard />;
}
