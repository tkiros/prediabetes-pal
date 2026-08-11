import { describe, expect, it } from "vitest";

import {
  createDatabasePoolConfig,
  databasePoolMax,
  resolveMigrationDatabaseUrl,
} from "../../../lib/server/db/config";

describe("database runtime and migration boundaries", () => {
  it("keeps each serverless instance on a small, bounded pool", () => {
    expect(databasePoolMax({})).toBe(3);
    expect(databasePoolMax({ DATABASE_POOL_MAX: "1" })).toBe(1);
    expect(databasePoolMax({ DATABASE_POOL_MAX: "10" })).toBe(10);
    expect(() => databasePoolMax({ DATABASE_POOL_MAX: "0" })).toThrow(/1 through 10/);
    expect(() => databasePoolMax({ DATABASE_POOL_MAX: "11" })).toThrow(/1 through 10/);
    expect(() => databasePoolMax({ DATABASE_POOL_MAX: "3.5" })).toThrow(/1 through 10/);
  });

  it("bounds connection establishment and idle retention", () => {
    const config = createDatabasePoolConfig(
      "postgres://app:secret@db.example/pal",
      {},
    );

    expect(config).toMatchObject({
      max: 3,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
      application_name: "pal-web",
      ssl: { rejectUnauthorized: true },
    });
    expect(
      createDatabasePoolConfig("postgres://app:secret@localhost/pal", {}).ssl,
    ).toBeUndefined();
  });

  it("requires distinct runtime and owner roles for production migrations", () => {
    expect(() =>
      resolveMigrationDatabaseUrl({ PAL_DB_ENV: "production" }),
    ).toThrow(/require DATABASE_URL and DATABASE_MIGRATION_URL/);

    expect(() =>
      resolveMigrationDatabaseUrl({
        PAL_DB_ENV: "production",
        DATABASE_URL: "postgres://owner:runtime@db.example/pal",
        DATABASE_MIGRATION_URL: "postgres://owner:migrate@db.example/pal",
      }),
    ).toThrow(/different database roles/);

    const migrationUrl = "postgres://owner:migrate@db.example/pal";
    expect(
      resolveMigrationDatabaseUrl({
        PAL_DB_ENV: "production",
        DATABASE_URL: "postgres://prediabetespal_app:runtime@db.example/pal",
        DATABASE_MIGRATION_URL: migrationUrl,
      }),
    ).toBe(migrationUrl);
  });

  it("keeps local development compatible with one credential", () => {
    expect(resolveMigrationDatabaseUrl({})).toBe(
      "postgres://localhost:5432/pal",
    );
    expect(
      resolveMigrationDatabaseUrl({
        DATABASE_URL: "postgres://local:local@localhost/pal",
      }),
    ).toBe("postgres://local:local@localhost/pal");
  });
});
