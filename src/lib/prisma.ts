import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const USE_FIREBASE = process.env.USE_FIREBASE === "true";

// Prisma client initialization setup that supports Accelerate.
const prismaClientSingleton = () => {
  // SAFETY: Do not even instantiate Prisma if we are in Firebase mode.
  if (USE_FIREBASE) {
    return null as any;
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  }).$extends(withAccelerate());
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

// Ensures a single PrismaClient instance across Next.js hot-reloads in dev.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

const internalPrisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = internalPrisma;

/**
 * STRICT MODE GUARD:
 * If USE_FIREBASE=true, this proxy will throw a fatal error on any attempt to access Prisma.
 * This ensures zero accidental leakage to SQL.
 */
export const prisma = new Proxy({} as any, {
  get(_, prop) {
    if (USE_FIREBASE) {
      throw new Error(`[FATAL] Prisma usage blocked in Firebase mode. Attempted to access property: ${String(prop)}`);
    }
    return (internalPrisma as any)[prop];
  },
});
