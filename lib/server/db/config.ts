import type { PoolConfig } from "pg";

type DatabaseEnv = Record<string, string | undefined>;

const DEFAULT_DATABASE_URL = "postgres://localhost:5432/pal";
const DEFAULT_POOL_MAX = 3;
const MAX_POOL_MAX = 10;

function trimmed(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

function postgresUsername(url: string, variable: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.username || !["postgres:", "postgresql:"].includes(parsed.protocol)) {
      throw new Error("invalid");
    }
    return decodeURIComponent(parsed.username);
  } catch {
    throw new Error(`${variable} must be a valid PostgreSQL URL.`);
  }
}

export function databasePoolMax(env: DatabaseEnv = process.env): number {
  const configured = trimmed(env.DATABASE_POOL_MAX);
  if (configured === undefined) {
    return DEFAULT_POOL_MAX;
  }
  if (!/^\d+$/.test(configured)) {
    throw new Error("DATABASE_POOL_MAX must be an integer from 1 through 10.");
  }
  const value = Number(configured);
  if (value < 1 || value > MAX_POOL_MAX) {
    throw new Error("DATABASE_POOL_MAX must be an integer from 1 through 10.");
  }
  return value;
}

export function createDatabasePoolConfig(
  url: string,
  env: DatabaseEnv = process.env,
): PoolConfig {
  return {
    connectionString: url,
    max: databasePoolMax(env),
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    application_name: "pal-web",
    ssl: isLocalhostDatabase(url)
      ? undefined
      : { rejectUnauthorized: !url.includes("sslmode=no-verify") },
  };
}

/**
 * Drizzle migrations use a separate owner credential in protected
 * environments. This prevents the web runtime from retaining DDL authority.
 */
export function resolveMigrationDatabaseUrl(
  env: DatabaseEnv = process.env,
): string {
  const runtimeUrl = trimmed(env.DATABASE_URL);
  const migrationUrl = trimmed(env.DATABASE_MIGRATION_URL);
  const protectedEnvironment = env.PAL_DB_ENV === "production";

  if (protectedEnvironment) {
    if (!runtimeUrl || !migrationUrl) {
      throw new Error(
        "Production migrations require DATABASE_URL and DATABASE_MIGRATION_URL.",
      );
    }
    if (
      postgresUsername(runtimeUrl, "DATABASE_URL") ===
      postgresUsername(migrationUrl, "DATABASE_MIGRATION_URL")
    ) {
      throw new Error(
        "Production runtime and migration URLs must use different database roles.",
      );
    }
  }

  return migrationUrl ?? runtimeUrl ?? DEFAULT_DATABASE_URL;
}

function isLocalhostDatabase(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}
