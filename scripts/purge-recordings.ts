import { purgeExpiredRecordings } from "../lib/recording/store";
import { accountDatabase } from "../lib/account/database";
async function main() {
  try {
    console.log(
      `Deleted ${await purgeExpiredRecordings()} expired private recordings.`,
    );
  } catch {
    console.error(
      "Recording cleanup failed; retry after restoring private storage/database.",
    );
    process.exitCode = 1;
  } finally {
    await accountDatabase().end();
  }
}
void main();
