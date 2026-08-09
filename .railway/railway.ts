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
    source: github("tkiros/Prediabetes Pal", { branch: "main" }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile.cron"
    },
    start: "node scripts/run-hourly-crons.mjs",
    replicas: 1,
    deploy: { cronSchedule: "0 * * * *", restartPolicyType: "NEVER" },
    env: {
      APP_URL: "https://prediabetespal.com",
      CRON_ENDPOINTS: preserve(),
      CRON_SECRET: preserve(),
    },
  });

  return project("revora", {
    resources: [PostgresFOMu, Postgres, PostgresD2oG, hourlyCrons, postgresVolume, postgresVolumeYrjb, postgresVolumeUDrg],
  });
});
