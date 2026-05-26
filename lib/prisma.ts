// Singleton Prisma client.
//
// Why this pattern: Next.js's dev server hot-reloads modules whenever a file
// changes. Without caching, every reload would `new PrismaClient()` again,
// opening fresh DB connections each time. Neon's free tier has a connection
// cap (and a compute-hour budget) — exhausting either will break the app.
// In dev we stash the instance on `globalThis`; in prod a single module
// import is the only entry point so a plain export is enough.
//
// All app code should `import { prisma } from "@/lib/prisma"`.

import { PrismaClient } from "@/lib/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
