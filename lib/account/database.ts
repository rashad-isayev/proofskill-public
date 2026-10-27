import "server-only";
import { Pool } from "pg";

let pool: Pool | undefined;
export function accountDatabase() {
  const connectionString =
    process.env.APP_DATABASE_URL || process.env.AUTH_DATABASE_URL;
  if (!connectionString) throw new Error("Account database is not configured.");
  return (pool ??= new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  }));
}
