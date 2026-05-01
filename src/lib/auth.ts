import { auth, currentUser } from "@clerk/nextjs/server";
import { useFirebase, getCollection, createDoc } from "./firebase";

export async function getCurrentUser() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    throw new Error("Unauthorized");
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    throw new Error("Clerk user not found");
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
  const user = await prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: {
      clerkId,
      email,
      name,
    },
  });

  return user;
}

export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user.id;
}
