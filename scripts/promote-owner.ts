/**
 * Production helper: promotes an existing Supabase-auth account to studio owner.
 * Usage: DATA_DRIVER=supabase node --import tsx scripts/promote-owner.ts owner@example.com
 */
import { getStore } from "../src/lib/data/get-store";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node --import tsx scripts/promote-owner.ts <email>");
    process.exit(1);
  }
  const store = getStore();
  await store.ready();
  const user = await store.getUserByEmail(email);
  if (!user) throw new Error(`No studio user found for ${email}. Register first, then promote.`);
  await store.setUserRole(user.id, "owner");
  console.log(`Promoted ${user.email} to owner.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
