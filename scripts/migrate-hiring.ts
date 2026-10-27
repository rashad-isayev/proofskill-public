import { Pool } from "pg";
import { candidateDDL } from "../lib/candidates/schema";
import { hiringDDL } from "../lib/hiring/schema";
import { recordingDDL } from "../lib/recording/schema";
async function main() {
  const pool = new Pool({
    connectionString:
      process.env.APP_DATABASE_URL || process.env.AUTH_DATABASE_URL,
    connectionTimeoutMillis: 5000,
    max: 1,
  });
  try {
    if (!process.env.APP_DATABASE_URL && !process.env.AUTH_DATABASE_URL)
      throw new Error("Missing database");
    await pool.query("BEGIN");
    await pool.query(hiringDDL);
    await pool.query(candidateDDL);
    await pool.query(recordingDDL);
    await pool.query("COMMIT");
    console.log("Additive hiring schema ready.");
  } catch {
    await pool.query("ROLLBACK").catch(() => undefined);
    console.error("Hiring migration failed. Check database configuration.");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
void main();
