import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // The `sessions` table is owned and migrated by connect-pg-simple
  // (express-session store). It is not declared in our drizzle schema and
  // must NOT be touched by drizzle-kit — otherwise drizzle would propose
  // either dropping it or "renaming" some unrelated table into it.
  tablesFilter: ["!sessions"],
});
