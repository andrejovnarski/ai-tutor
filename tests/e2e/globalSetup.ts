import { deleteTestUsers } from "../helpers/cleanup";

// playwright.config.ts loads .env.local into process.env, as used by helpers/admin.ts.
export default async function setup() {
  await deleteTestUsers("@example.com");
}
