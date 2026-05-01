/**
 * Firebase Admin SDK singleton + Firestore helper utilities.
 *
 * Usage:
 *   import { db, getCollection, createDoc, queryByUserId, updateDoc, deleteDoc } from "@/lib/firebase";
 *
 * Toggle via USE_FIREBASE env var:
 *   USE_FIREBASE=true  → routes through Firestore
 *   USE_FIREBASE=false → caller falls back to Prisma (services handle this)
 */

import admin from "firebase-admin";
import type { App } from "firebase-admin/app";
import { getFirestore, Firestore, FieldValue } from "firebase-admin/firestore";
import { createLogger } from "./logger";

const log = createLogger("Firebase");

// ─── Singleton initializer ───────────────────────────────────────────────────

function initFirebaseApp(): App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Next.js reads \n literally from .env — replace escaped newlines.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    log.warn(
      "Firebase env vars missing (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY). " +
        "Firestore will not be available."
    );
    // Return a stub app so callers fail gracefully instead of crashing.
    return admin.initializeApp({ projectId: "not-configured" });
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

// ─── Exported instances ───────────────────────────────────────────────────────

// Use globalThis to prevent duplicate initializations in Next.js hot-reload.
const globalForFirebase = globalThis as unknown as {
  _firebaseApp: App | undefined;
  _firestoreDb: Firestore | undefined;
};

if (!globalForFirebase._firebaseApp) {
  globalForFirebase._firebaseApp = initFirebaseApp();
}
if (!globalForFirebase._firestoreDb) {
  globalForFirebase._firestoreDb = getFirestore(globalForFirebase._firebaseApp);
}

export const db: Firestore = globalForFirebase._firestoreDb;

// ─── Feature flag helper ──────────────────────────────────────────────────────

/** Returns true when Firebase/Firestore should be used instead of Prisma. */
export function useFirebase(): boolean {
  return process.env.USE_FIREBASE === "true";
}

// ─── Firestore helper utilities ───────────────────────────────────────────────

/** Get a typed CollectionReference. */
export function getCollection(name: string) {
  return db.collection(name);
}

/**
 * Create a new document in a collection.
 * Returns the created document data including its Firestore-generated `id`.
 */
export async function createDoc<T extends object>(
  collectionName: string,
  data: T
): Promise<T & { id: string }> {
  const now = new Date().toISOString();
  const payload = { ...data, createdAt: now, updatedAt: now };
  const ref = await db.collection(collectionName).add(payload);
  return { ...payload, id: ref.id } as T & { id: string };
}

/**
 * Query all (non-deleted) documents in a collection belonging to a userId.
 * Optionally pass extra `where` clauses as { field, op, value } tuples.
 */
export async function queryByUserId<T extends { id: string }>(
  collectionName: string,
  userId: string,
  filters: Array<{ field: string; op: FirebaseFirestore.WhereFilterOp; value: unknown }> = []
): Promise<T[]> {
  let q: FirebaseFirestore.Query = db
    .collection(collectionName)
    .where("userId", "==", userId);

  for (const f of filters) {
    q = q.where(f.field, f.op, f.value);
  }

  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

/**
 * Update fields on an existing document.
 * Automatically sets `updatedAt`.
 */
export async function updateDoc(
  collectionName: string,
  docId: string,
  patch: Record<string, unknown>
): Promise<void> {
  await db
    .collection(collectionName)
    .doc(docId)
    .update({ ...patch, updatedAt: new Date().toISOString() });
}

/**
 * Hard-delete a document by id.
 */
export async function deleteDoc(
  collectionName: string,
  docId: string
): Promise<void> {
  await db.collection(collectionName).doc(docId).delete();
}

/**
 * Soft-delete a document by setting `deletedAt`.
 */
export async function softDeleteDoc(
  collectionName: string,
  docId: string
): Promise<void> {
  await db
    .collection(collectionName)
    .doc(docId)
    .update({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
}

/**
 * Fetch a single document by userId + an arbitrary equality filter (e.g. id match guard).
 * Returns null if not found.
 */
export async function findFirstByUserId<T extends { id: string }>(
  collectionName: string,
  userId: string,
  extraFilters: Array<{ field: string; op: FirebaseFirestore.WhereFilterOp; value: unknown }> = []
): Promise<T | null> {
  const results = await queryByUserId<T>(collectionName, userId, extraFilters);
  return results[0] ?? null;
}

export { FieldValue };
