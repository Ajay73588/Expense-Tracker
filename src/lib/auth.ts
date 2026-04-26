import { prisma } from "./prisma";

/**
 * Demo-mode auth. In production this would verify a Clerk session and return
 * the user bound to that clerkId. For local/demo runs we always return the seeded
 * demo user so the app is usable out of the box without auth setup.
 *
 * TODO (production): replace with Clerk `auth()` from `@clerk/nextjs/server`,
 * and throw `UnauthorizedError` when no session is present.
 */
export async function getCurrentUser() {
  const user = await prisma.user.findFirst({ where: { email: "demo@financeai.app" } });
  if (!user) {
    throw new Error(
      "Demo user not found. Run `npm run setup` to initialize the database and seed data."
    );
  }
  return user;
}

export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user.id;
}
