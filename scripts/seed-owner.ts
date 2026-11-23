/**
 * Local development only: creates the owner account.
 * Usage: DATA_DRIVER=local npx tsx scripts/seed-owner.ts owner@example.com 'your-password'
 * Supabase owners are created through Authentication →Invite user, then promoted in SQL.
 */
import { localStore } from "../src/lib/data/local";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 8) {
    console.error("Usage: npx tsx scripts/seed-owner.ts <email> <password-min-8-chars>");
    process.exit(1);
  }
  await localStore.ready();
  let user = await localStore.getUserByEmail(email);
  if (!user) {
    user = await localStore.createUser({ name: "Studio Owner", email, password, role: "owner" });
  } else {
    await localStore.setUserRole(user.id, "owner");
    await localStore.setPassword(user.id, password);
  }
  let customer = await localStore.getCustomerByUserId(user.id);
  if (!customer) {
    customer = await localStore.createCustomer({ userId: user.id, name: "Studio Owner", email, phone: "" });
  }
  console.log(`Owner ready: ${email} (${user.role}), customer id ${customer.id}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
