import { purgeExpiredRecordings } from "../lib/recording/store";
import { accountDatabase } from "../lib/account/database";
async function main() {
  let stopping = false;
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.on(signal, () => {
      stopping = true;
    });
  while (!stopping) {
    try {
      const n = await purgeExpiredRecordings();
      if (n) console.log(`Deleted ${n} expired recordings.`);
    } catch {
      console.error(
        "Private recording cleanup failed; retrying after one minute.",
      );
    }
    // Short waits permit prompt process shutdown; expiration is checked every minute.
    for (let i = 0; i < 60 && !stopping; i++)
      await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  await accountDatabase().end();
}
void main();
