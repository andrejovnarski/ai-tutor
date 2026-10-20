import { loadEnv } from "vite";
import { deleteTestUsers } from "../helpers/cleanup";

export default async function setup() {
  await deleteTestUsers("@test.dev", loadEnv("test", process.cwd(), ""));
}
