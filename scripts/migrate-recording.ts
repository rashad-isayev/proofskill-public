import { Pool } from "pg";
import { recordingDDL } from "../lib/recording/schema";
async function main() {
  const pool = new Pool({
    connectionString:
      process.env.APP_DATABASE_URL || process.env.AUTH_DATABASE_URL,
    connectionTimeoutMillis: 5000,
    max: 1,
  });
  try {
    await pool.query(recordingDDL);
    console.log("Additive recording schema ready.");
  } catch {
    console.error("Recording migration failed. Check database configuration.");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
void main();
