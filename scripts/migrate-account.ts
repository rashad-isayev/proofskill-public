import { Pool } from "pg";

async function main() {
  const connectionString =
    process.env.APP_DATABASE_URL || process.env.AUTH_DATABASE_URL;
  if (!connectionString)
    throw new Error("Application database is not configured.");
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
  try {
    // Additive schema only. Never alter or reset Better Auth tables.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS proofskill_app_workspace (
        user_id text PRIMARY KEY,
        revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
        payload jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS proofskill_app_job (
        id text PRIMARY KEY, owner_id text NOT NULL, title text NOT NULL,
        team text NOT NULL, location text NOT NULL, description text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS proofskill_app_application (
        id text PRIMARY KEY, job_id text NOT NULL REFERENCES proofskill_app_job(id),
        candidate_id text NOT NULL, candidate_name text NOT NULL,
        candidate_email text NOT NULL, note text NOT NULL, evidence jsonb,
        status text NOT NULL DEFAULT 'submitted'
          CHECK(status IN ('submitted','in-review','follow-up','closed')),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(job_id,candidate_id)
      );
      CREATE INDEX IF NOT EXISTS proofskill_app_job_owner ON proofskill_app_job(owner_id);
      CREATE INDEX IF NOT EXISTS proofskill_app_application_candidate ON proofskill_app_application(candidate_id);
    `);
    console.log("ProofSkill account workspace schema is ready.");
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "Account migration failed. Check application database configuration.",
  );
  process.exitCode = 1;
});
