import { getMigrations } from "better-auth/db/migration";
import { createAuth } from "../lib/auth/config";

async function main() {
  const { auth, pool } = createAuth();
  try {
    const migrations = await getMigrations(auth.options);
    const tables = migrations.toBeCreated.map((table) => table.table);
    const columns = [
      ...migrations.toBeAdded,
      ...migrations.toBeAddedIndexes,
    ].map((table) => table.table);
    if (
      [...tables, ...columns].some(
        (table) => !table.startsWith("proofskill_auth_"),
      )
    ) {
      throw new Error(
        "Refusing to migrate tables outside the ProofSkill auth namespace.",
      );
    }
    await migrations.runMigrations();
    console.log("ProofSkill authentication schema is ready.");
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "Authentication migration failed. Check the dedicated database and configuration.",
  );
  process.exitCode = 1;
});
