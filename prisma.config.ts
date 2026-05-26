// Prisma 6 config. We load `.env.local` (Next.js's env file) so we don't have
// to keep a duplicate `.env` in sync. All Prisma CLI commands — db push,
// generate, studio, migrate — read env vars from here.
import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  // Prisma 6 requires `datasource.url` here even though schema.prisma also
  // declares it — db push / migrate read this one. The `directUrl` for Neon
  // stays in schema.prisma where it's already wired up.
  datasource: {
    url: env("DATABASE_URL"),
  },
});
