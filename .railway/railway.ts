import {
  defineRailway,
  github,
  postgres,
  preserve,
  project,
  service,
  volume
} from "railway/iac";

export default defineRailway(() => {
  const PostgresFOMu = postgres("Postgres-FOMu");
  const Postgres = postgres("Postgres");
  const PostgresD2oG = postgres("Postgres-D2oG");
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "sfo", sizeMB: 500 });
  const postgresVolumeYrjb = volume("postgres-volume-yrjb", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "sfo", sizeMB: 500 });
  const postgresVolumeUDrg = volume("postgres-volume-uDrg", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "sfo", sizeMB: 500 });
  const hourlyCrons = service("hourly-crons", {
    // ⛔ Repo slug, not display copy — legacy internal name per CLAUDE.md.
    // The GitHub repo is still tkiros/Revora; renaming this breaks the
    // service's source binding (and a slug cannot contain a space).
    source: github("tkiros/Revora", { branch: "main" }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile.cron"
    },
    start: "node scripts/run-hourly-crons.mjs",
    replicas: 1,
    deploy: { cronSchedule: "0 * * * *", restartPolicyType: "NEVER" },
    env: {
      // ⛔ MERGE-ORDER COUPLING (rename, 2026-08-10). This service builds from
      // `main`, and scripts/run-hourly-crons.mjs hardcodes CANONICAL_APP_URL,
      // whose validateCronConfig() THROWS invalid_app_url unless APP_URL is
      // byte-equal. So merging the rename to main redeploys the cron with the
      // new canonical URL while Railway may still hold the old APP_URL — that
      // mismatch kills all four hourly jobs (nudge, pantry-sweep,
      // trial-precharge, stripe-reconcile; the last is the SLO backstop for
      // missed Stripe webhooks). Apply this IaC value AND have
      // prediabetespal.com resolving to Vercel BEFORE merging to main.
      APP_URL: "https://prediabetespal.com",
      CRON_ENDPOINTS: preserve(),
      CRON_SECRET: preserve(),
    },
  });

  return project("revora", {
    resources: [PostgresFOMu, Postgres, PostgresD2oG, hourlyCrons, postgresVolume, postgresVolumeYrjb, postgresVolumeUDrg],
  });
});
