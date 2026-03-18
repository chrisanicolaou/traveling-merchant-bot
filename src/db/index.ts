import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";

const host = process.env.POSTGRES_HOST ?? "localhost";
const port = process.env.POSTGRES_PORT ?? "5432";
const user = process.env.POSTGRES_USER!;
const password = process.env.POSTGRES_PASSWORD!;
const database = process.env.POSTGRES_DB!;

const db = drizzle(
  `postgres://${user}:${password}@${host}:${port}/${database}`,
);
