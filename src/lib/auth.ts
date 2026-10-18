import { auth, currentUser } from "@clerk/nextjs/server";
import { useFirebase, getCollection, createDoc } from "./firebase";
import { UnauthorizedError } from "./errors";

export async function getCurrentUser() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    throw new UnauthorizedError("Unauthorized");
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    throw new UnauthorizedError("Clerk user not found");
  }

  const email = clerkUser.emailAddresses[0]?.emailAddress || `${clerkId}@financeai.app`;
  const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User";

  // ─── FIRESTORE PATH ────────────────────────────────────────────────────────
  if (useFirebase()) {
    const db = await getCollection("users");
    const snapshot = await db.where("clerkId", "==", clerkId).limit(1).get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as any;
    }

    // Create new user in Firestore
    const newUser = await createDoc("users", {
      clerkId,
      email,
      name,
    });
    return newUser;
  }

  // ─── PRISMA PATH (Fallback) ────────────────────────────────────────────────
  const { prisma } = await import("./prisma");
  let user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    // If a user exists with the same email, link clerkId to prevent P2002 unique constraint failure
    const existingByEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingByEmail) {
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { clerkId, name: name || existingByEmail.name },
      });
    } else {
      user = await prisma.user.create({
        data: {
          clerkId,
          email,
          name,
        },
      });
    }
  }

  return user;
}

export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user.id;
}
